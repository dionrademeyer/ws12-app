-- Sprint 2 QA round 1: removing a consent link withdraws the consent, the app language is
-- saved to the account, profile edits are one checked call, and province codes are enforced
-- (Product Bible 3.3, 3.4 and 3.19, docs/api-contract.md).
--
-- Privileges: Supabase gives anon and authenticated execute on every new function by default.
-- Every function created here therefore gets its own revoke at the end of this file, and a
-- grant only when the app is meant to call it. A function that is replaced with
-- "create or replace" keeps the privileges it already had. Add any new function to the
-- expected list in supabase/tests/rls.test.ts.

-- ---------------------------------------------------------------------------
-- Province codes (Product Bible 3.4)
-- ---------------------------------------------------------------------------

alter table public.profiles add constraint profiles_province_check
  check (province in ('EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC'));

-- ---------------------------------------------------------------------------
-- The app language (Product Bible 3.3: saved before consent)
-- ---------------------------------------------------------------------------

-- Creates the profile and the learner role. Only the app language is read from sign-up
-- metadata, and only when it is exactly 'en' or 'af'; anything else gives 'en'. Google name
-- and picture are never copied (Product Bible 2.3).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text := 'en';
begin
  if jsonb_typeof(new.raw_user_meta_data -> 'language') = 'string'
    and new.raw_user_meta_data ->> 'language' in ('en', 'af')
  then
    v_language := new.raw_user_meta_data ->> 'language';
  end if;

  insert into public.profiles (id, language) values (new.id, v_language);
  insert into public.user_roles (user_id, role) values (new.id, 'learner');
  return new;
end;
$$;

-- Saves the language chosen on Welcome or in Settings. Allowed before consent, because the
-- language is needed to show the age and consent screens.
create function public.set_language(p_language text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if p_language is null or p_language not in ('en', 'af') then
    raise exception 'invalid_input';
  end if;

  update public.profiles set language = p_language where id = v_uid;

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Removing a link that consent created withdraws the consent (Product Bible 3.3)
-- ---------------------------------------------------------------------------

-- Either side may remove a link. When the parent removes a link that their consent created,
-- that consent is withdrawn as well, with the same effect as withdraw_consent(): unless
-- another consent is given, the learner's data processing stops. A consent request still
-- waiting on the removed link is closed and its stored contact deleted, so it cannot bring
-- the link back later.
create or replace function public.remove_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_parent_id uuid;
  v_consent_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  update public.parent_links
  set status = 'removed', removed_at = now()
  where id = p_link_id and status <> 'removed' and v_uid in (learner_id, parent_id)
  returning parent_id into v_parent_id;

  if not found then
    raise exception 'not_found';
  end if;

  if v_parent_id = v_uid then
    for v_consent_id in
      update public.parental_consents
      set status = 'withdrawn', withdrawn_at = now()
      where link_id = p_link_id and parent_user_id = v_uid and status = 'given'
      returning id
    loop
      perform public.write_audit('withdraw_consent', v_consent_id::text);
    end loop;
  end if;

  for v_consent_id in
    update public.parental_consents
    set status = 'declined', closed_at = now()
    where link_id = p_link_id and status = 'pending'
    returning id
  loop
    delete from public.consent_contacts where consent_id = v_consent_id;
  end loop;

  perform public.write_audit('remove_link', p_link_id::text);
end;
$$;

-- The caller's pending and active links. The other person's first name is shown only for a
-- parent, or for a learner who has consent. For the parent only, consent_id is the request to
-- answer with give_consent() on a pending link, or the given consent that created an active
-- link, which the parent can end with withdraw_consent().
create or replace function public.my_family()
returns table (
  link_id uuid,
  other_user_id uuid,
  other_first_name text,
  relation text,
  status text,
  waiting_on_me boolean,
  consent_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  return query
  select
    family.id,
    family.other_id,
    case
      when family.relation = 'parent' or public.has_consent_for(family.other_id) then o.first_name
    end,
    family.relation,
    family.status,
    family.status = 'pending' and case
      when not public.has_consent_for(family.learner_id) then family.parent_id = v_uid
      else family.initiated_by <> v_uid
    end,
    case
      when family.parent_id = v_uid and family.status = 'pending' then (
        select c.id
        from public.parental_consents c
        where c.link_id = family.id
          and c.status = 'pending'
          and public.consent_request_expires_at(c.requested_at) > now()
        order by c.requested_at desc
        limit 1
      )
      when family.parent_id = v_uid and family.status = 'active' then (
        select c.id
        from public.parental_consents c
        where c.link_id = family.id and c.parent_user_id = v_uid and c.status = 'given'
        order by c.given_at desc
        limit 1
      )
    end
  from (
    select
      l.id,
      l.learner_id,
      l.parent_id,
      l.initiated_by,
      l.status,
      l.created_at,
      case when l.learner_id = v_uid then l.parent_id else l.learner_id end as other_id,
      case when l.learner_id = v_uid then 'parent' else 'child' end as relation
    from public.parent_links l
    where v_uid in (l.learner_id, l.parent_id) and l.status in ('pending', 'active')
  ) family
  join public.profiles o on o.id = family.other_id
  order by family.created_at, family.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile field checks shared by save_onboarding() and update_profile()
-- ---------------------------------------------------------------------------

-- 1 to 60 characters after trimming, no control characters.
create function public.profile_first_name(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first_name text := public.onboarding_text(p_value, 60);
begin
  if v_first_name is null then
    raise exception 'invalid_input';
  end if;
  return v_first_name;
end;
$$;

-- The number 11 or 12.
create function public.profile_grade(p_value jsonb)
returns smallint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' or p_value #>> '{}' not in ('11', '12') then
    raise exception 'invalid_input';
  end if;
  return (p_value #>> '{}')::smallint;
end;
$$;

-- Null, or the id of a school in the list.
create function public.profile_school_id(p_value jsonb)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'string'
    or p_value #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    raise exception 'invalid_input';
  end if;
  v_school_id := (p_value #>> '{}')::uuid;
  if not exists (select 1 from public.schools s where s.id = v_school_id) then
    raise exception 'invalid_input';
  end if;
  return v_school_id;
end;
$$;

-- One of the nine province codes.
create function public.profile_province(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null
    or jsonb_typeof(p_value) <> 'string'
    or p_value #>> '{}' not in ('EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC')
  then
    raise exception 'invalid_input';
  end if;
  return p_value #>> '{}';
end;
$$;

-- Up to 20 objects with exactly code (a known subject, no repeats) and target_mark (null or a
-- whole number 0 to 100).
create function public.profile_subjects(
  p_value jsonb,
  out subject_ids uuid[],
  out target_marks smallint[]
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_subject_id uuid;
  v_target smallint;
begin
  subject_ids := '{}';
  target_marks := '{}';
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 20 then
    raise exception 'invalid_input';
  end if;

  for v_item in select e from jsonb_array_elements(p_value) e loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ?& array['code', 'target_mark'])
      or exists (
        select 1 from jsonb_object_keys(v_item) k where k not in ('code', 'target_mark')
      )
      or jsonb_typeof(v_item -> 'code') <> 'string'
    then
      raise exception 'invalid_input';
    end if;

    v_subject_id := null;
    select s.id into v_subject_id from public.subjects s where s.code = v_item ->> 'code';
    if v_subject_id is null or v_subject_id = any (subject_ids) then
      raise exception 'invalid_input';
    end if;

    v_target := null;
    if jsonb_typeof(v_item -> 'target_mark') <> 'null' then
      if jsonb_typeof(v_item -> 'target_mark') <> 'number'
        or v_item ->> 'target_mark' !~ '^[0-9]{1,3}$'
        or (v_item ->> 'target_mark')::integer > 100
      then
        raise exception 'invalid_input';
      end if;
      v_target := (v_item ->> 'target_mark')::smallint;
    end if;

    subject_ids := subject_ids || v_subject_id;
    target_marks := target_marks || v_target;
  end loop;
end;
$$;

-- Up to 2 objects with exactly kind (trial or final, no repeats) and date (a real YYYY-MM-DD
-- date from last year to three years ahead). The trial must be before the final.
create function public.profile_exam_dates(p_value jsonb, out kinds text[], out dates date[])
language plpgsql
stable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_date date;
  v_this_year integer := extract(year from now() at time zone 'Africa/Johannesburg')::integer;
begin
  kinds := '{}';
  dates := '{}';
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 2 then
    raise exception 'invalid_input';
  end if;

  for v_item in select e from jsonb_array_elements(p_value) e loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ?& array['kind', 'date'])
      or exists (select 1 from jsonb_object_keys(v_item) k where k not in ('kind', 'date'))
      or jsonb_typeof(v_item -> 'kind') <> 'string'
      or v_item ->> 'kind' not in ('trial', 'final')
      or v_item ->> 'kind' = any (kinds)
      or jsonb_typeof(v_item -> 'date') <> 'string'
      or v_item ->> 'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then
      raise exception 'invalid_input';
    end if;
    begin
      v_date := to_date(v_item ->> 'date', 'YYYY-MM-DD');
    exception
      when others then
        raise exception 'invalid_input';
    end;
    if to_char(v_date, 'YYYY-MM-DD') <> v_item ->> 'date'
      or extract(year from v_date) not between v_this_year - 1 and v_this_year + 3
    then
      raise exception 'invalid_input';
    end if;
    kinds := kinds || (v_item ->> 'kind');
    dates := dates || v_date;
  end loop;

  if cardinality(kinds) = 2
    and dates[array_position(kinds, 'trial')] >= dates[array_position(kinds, 'final')]
  then
    raise exception 'invalid_input';
  end if;
end;
$$;

-- Replaces a learner's subjects and targets with checked values.
create function public.replace_learner_subjects(
  p_learner_id uuid,
  p_subject_ids uuid[],
  p_target_marks smallint[]
)
returns void
language sql
set search_path = ''
as $$
  delete from public.learner_subjects
  where learner_id = p_learner_id and subject_id <> all (p_subject_ids);

  insert into public.learner_subjects (learner_id, subject_id, target_mark)
  select p_learner_id, chosen.subject_id, chosen.target_mark
  from unnest(p_subject_ids, p_target_marks) as chosen (subject_id, target_mark)
  on conflict (learner_id, subject_id) do update set target_mark = excluded.target_mark;
$$;

-- Replaces a learner's trial and final dates (not per-subject dates) with checked values.
create function public.replace_learner_exam_dates(
  p_learner_id uuid,
  p_kinds text[],
  p_dates date[]
)
returns void
language sql
set search_path = ''
as $$
  delete from public.learner_exam_dates
  where learner_id = p_learner_id and subject_id is null and kind <> all (p_kinds);

  insert into public.learner_exam_dates (learner_id, kind, subject_id, starts_on)
  select p_learner_id, chosen.kind, null, chosen.starts_on
  from unnest(p_kinds, p_dates) as chosen (kind, starts_on)
  on conflict (learner_id, kind, subject_id) do update set starts_on = excluded.starts_on;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding and profile edits
-- ---------------------------------------------------------------------------

-- Saves the five onboarding steps in one go (Product Bible 3.4). Needs consent. Every field is
-- checked; an answer with a missing, extra or wrong field is refused as a whole.
create or replace function public.save_onboarding(p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_keys constant text[] := array[
    'first_name',
    'grade',
    'school_id',
    'school_name_other',
    'province',
    'subjects',
    'exam_dates',
    'study_days',
    'study_bands',
    'goal',
    'career_interests'
  ];
  v_weekdays constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_first_name text;
  v_grade smallint;
  v_school_id uuid;
  v_school_other text;
  v_province text;
  v_subject_ids uuid[];
  v_targets smallint[];
  v_kinds text[];
  v_dates date[];
  v_days smallint[];
  v_bands text[];
  v_goal text;
  v_careers text[];
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if not public.has_consent_for(v_uid) then
    raise exception 'consent_required';
  end if;

  if p_answers is null
    or jsonb_typeof(p_answers) <> 'object'
    or octet_length(p_answers::text) > 20000
    or not (p_answers ?& v_keys)
    or exists (select 1 from jsonb_object_keys(p_answers) k where k <> all (v_keys))
  then
    raise exception 'invalid_input';
  end if;

  -- Step 1: about you
  v_first_name := public.profile_first_name(p_answers -> 'first_name');
  v_grade := public.profile_grade(p_answers -> 'grade');
  v_school_id := public.profile_school_id(p_answers -> 'school_id');
  v_school_other := public.onboarding_text(p_answers -> 'school_name_other', 120);
  if v_school_id is not null and v_school_other is not null then
    raise exception 'invalid_input';
  end if;
  v_province := public.profile_province(p_answers -> 'province');

  -- Steps 2 and 3: subjects, targets and exam dates
  select s.subject_ids, s.target_marks into v_subject_ids, v_targets
  from public.profile_subjects(p_answers -> 'subjects') s;
  select e.kinds, e.dates into v_kinds, v_dates
  from public.profile_exam_dates(p_answers -> 'exam_dates') e;

  -- Step 4: study time
  v_days := array(
    select array_position(v_weekdays, chosen.weekday)::smallint
    from unnest(public.onboarding_choices(p_answers -> 'study_days', v_weekdays)) as chosen (weekday)
    order by 1
  );
  v_bands := public.onboarding_choices(
    p_answers -> 'study_bands',
    array['morning', 'afternoon', 'evening', 'late']
  );

  -- Step 5: goal and career interests
  v_goal := public.onboarding_text(p_answers -> 'goal', 200);
  v_careers := public.onboarding_choices(
    p_answers -> 'career_interests',
    array[
      'engineering',
      'health',
      'business',
      'law',
      'education',
      'technology',
      'science',
      'creative',
      'trades',
      'agriculture',
      'not_sure'
    ]
  );

  update public.profiles
  set
    first_name = v_first_name,
    grade = v_grade,
    school_id = v_school_id,
    school_name_other = v_school_other,
    province = v_province,
    onboarding_step = 5,
    onboarded_at = coalesce(onboarded_at, now())
  where id = v_uid;

  perform public.replace_learner_subjects(v_uid, v_subject_ids, v_targets);
  perform public.replace_learner_exam_dates(v_uid, v_kinds, v_dates);

  insert into public.learner_preferences (learner_id, study_days, study_times, career_interests)
  values (v_uid, v_days, v_bands, v_careers)
  on conflict (learner_id) do update
  set
    study_days = excluded.study_days,
    study_times = excluded.study_times,
    career_interests = excluded.career_interests;

  -- The first goal is added once; later goals are managed on the Goals screen.
  if v_goal is not null and not exists (select 1 from public.goals g where g.learner_id = v_uid) then
    insert into public.goals (learner_id, type, title) values (v_uid, 'academic', v_goal);
  end if;

  perform public.write_audit('save_onboarding', v_uid::text);
end;
$$;

-- Saves a Profile edit in one go (Product Bible 3.19). Needs consent. Only the keys sent are
-- changed, each with the same checks as save_onboarding(); any wrong or unknown key refuses
-- the whole edit. school_id and school_name_other are one choice: sending either one sets
-- both, and a key left out counts as null. subjects and exam_dates replace the whole list.
create function public.update_profile(p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_keys constant text[] := array[
    'first_name',
    'grade',
    'school_id',
    'school_name_other',
    'province',
    'subjects',
    'exam_dates'
  ];
  v_profile public.profiles%rowtype;
  v_subject_ids uuid[];
  v_targets smallint[];
  v_kinds text[];
  v_dates date[];
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if not public.has_consent_for(v_uid) then
    raise exception 'consent_required';
  end if;

  if p_changes is null
    or jsonb_typeof(p_changes) <> 'object'
    or p_changes = '{}'::jsonb
    or octet_length(p_changes::text) > 20000
    or exists (select 1 from jsonb_object_keys(p_changes) k where k <> all (v_keys))
  then
    raise exception 'invalid_input';
  end if;

  select * into v_profile from public.profiles p where p.id = v_uid for update;
  if v_profile.id is null then
    raise exception 'not_found';
  end if;

  if p_changes ? 'first_name' then
    v_profile.first_name := public.profile_first_name(p_changes -> 'first_name');
  end if;
  if p_changes ? 'grade' then
    v_profile.grade := public.profile_grade(p_changes -> 'grade');
  end if;
  if p_changes ?| array['school_id', 'school_name_other'] then
    v_profile.school_id := public.profile_school_id(p_changes -> 'school_id');
    v_profile.school_name_other := public.onboarding_text(p_changes -> 'school_name_other', 120);
    if v_profile.school_id is not null and v_profile.school_name_other is not null then
      raise exception 'invalid_input';
    end if;
  end if;
  if p_changes ? 'province' then
    v_profile.province := public.profile_province(p_changes -> 'province');
  end if;
  if p_changes ? 'subjects' then
    select s.subject_ids, s.target_marks into v_subject_ids, v_targets
    from public.profile_subjects(p_changes -> 'subjects') s;
  end if;
  if p_changes ? 'exam_dates' then
    select e.kinds, e.dates into v_kinds, v_dates
    from public.profile_exam_dates(p_changes -> 'exam_dates') e;
  end if;

  update public.profiles
  set
    first_name = v_profile.first_name,
    grade = v_profile.grade,
    school_id = v_profile.school_id,
    school_name_other = v_profile.school_name_other,
    province = v_profile.province
  where id = v_uid;

  if p_changes ? 'subjects' then
    perform public.replace_learner_subjects(v_uid, v_subject_ids, v_targets);
  end if;
  if p_changes ? 'exam_dates' then
    perform public.replace_learner_exam_dates(v_uid, v_kinds, v_dates);
  end if;

  perform public.write_audit('update_profile', v_uid::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges for the functions created in this file
-- ---------------------------------------------------------------------------

revoke execute on function
  public.set_language(text),
  public.update_profile(jsonb),
  public.profile_first_name(jsonb),
  public.profile_grade(jsonb),
  public.profile_school_id(jsonb),
  public.profile_province(jsonb),
  public.profile_subjects(jsonb),
  public.profile_exam_dates(jsonb),
  public.replace_learner_subjects(uuid, uuid[], smallint[]),
  public.replace_learner_exam_dates(uuid, text[], date[])
from public, anon, authenticated;

grant execute on function
  public.set_language(text),
  public.update_profile(jsonb)
to authenticated;
