-- Sprint 2: identity, parental consent, parent linking, My Library and payments
-- (Product Bible 2.3, 3.3, 3.17, 3.18, 6.3, 9.2 and docs/api-contract.md).
-- Every client function raises one of the stable error codes from docs/api-contract.md as its
-- message, so the app can show a translated message.

-- ---------------------------------------------------------------------------
-- Shared rules: contact hashing, consent window, consent policy version
-- ---------------------------------------------------------------------------

-- The one normalisation rule for an email or phone contact. The edge functions use the same
-- rule (supabase/functions/_shared/contact.ts) and a test checks that both give the same hash.
create function public.normalize_contact(p_contact text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(p_contact, E' \t\n\r\f\x0B'));
$$;

-- sha256 of the normalised contact, as lowercase hex.
create function public.contact_hash(p_contact text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(public.normalize_contact(p_contact), 'UTF8')), 'hex');
$$;

-- A consent request can be answered for 30 days (Product Bible 3.3).
create function public.consent_request_expires_at(p_requested_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select p_requested_at + interval '30 days';
$$;

-- The consent text version a parent agrees to. It changes when Didi approves the final
-- consent wording; the edge functions send the same value (_shared/contact.ts).
create function public.consent_policy_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'draft-2026-11';
$$;

-- ---------------------------------------------------------------------------
-- Consent for any user, used by policies, functions and triggers
-- ---------------------------------------------------------------------------

create function public.has_consent_for(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.age_declarations a where a.user_id = p_user_id and a.is_adult
  )
  or exists (
    select 1
    from public.parental_consents c
    where c.learner_id = p_user_id and c.status = 'given'
  );
$$;

create or replace function public.has_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_consent_for(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------

-- Declined ("This is not my child") and expired requests are closed, and the link a consent
-- created is kept so that withdrawing the consent can remove that link.
alter table public.parental_consents drop constraint parental_consents_status_check;
alter table public.parental_consents add constraint parental_consents_status_check
  check (status in ('pending', 'given', 'withdrawn', 'declined', 'expired'));
alter table public.parental_consents
  add column link_id uuid references public.parent_links (id) on delete set null,
  add column closed_at timestamptz;

create index parental_consents_pending_idx on public.parental_consents (requested_at)
  where status = 'pending';
create index parental_consents_link_idx on public.parental_consents (link_id);

create index entitlements_granted_for_idx on public.entitlements (granted_for_learner_id);
create index purchases_unclaimed_email_idx on public.purchases (lower(buyer_email))
  where buyer_user_id is null;

-- Every try at an invite code, so wrong codes can be rate limited (Product Bible 6.3 rule 11).
create table public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null
);

create index invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at desc);

alter table public.invite_attempts enable row level security;

-- Server only: no client may read or write invite attempts.
create policy invite_attempts_no_client_access on public.invite_attempts
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- Storage: a private bucket for My Library files (Product Bible 3.17 and 6.3 rule 7).
-- There is deliberately no storage policy for this bucket, so clients cannot list or read
-- it. Downloads use short-lived signed links from the library-download edge function.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('library', 'library', false)
    on conflict (id) do update set public = false;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Google name and picture stay out of the database until consent (Product Bible 2.3)
-- ---------------------------------------------------------------------------

-- Supabase Auth may refresh user metadata from Google on every sign-in. Until the account has
-- consent (an adult declaration or a parent's consent), name and picture keys are removed
-- before the row is stored. The email stays, because sign-in needs it.
create function public.strip_profile_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_consent_for(new.id) then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - array[
      'full_name',
      'name',
      'given_name',
      'family_name',
      'nickname',
      'preferred_username',
      'user_name',
      'avatar_url',
      'picture'
    ];
  end if;
  return new;
end;
$$;

create trigger strip_profile_metadata
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.strip_profile_metadata();

-- ---------------------------------------------------------------------------
-- Parent purchases (Product Bible 9.2, proposed and still open with Didi)
-- ---------------------------------------------------------------------------

-- The one place that decides who an entitlement covers. Proposed rule: the owner, a learner it
-- was bought for, and otherwise the owner's first active linked learner. To change the rule
-- (for example to every linked child, or to the parent only) change this function only.
create function public.entitlement_covers(
  p_owner_id uuid,
  p_granted_for_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id = p_owner_id
    or p_user_id = p_granted_for_id
    or (
      p_granted_for_id is null
      and p_user_id = (
        select l.learner_id
        from public.parent_links l
        where l.parent_id = p_owner_id and l.status = 'active'
        order by l.activated_at, l.id
        limit 1
      )
    ),
    false
  );
$$;

-- Highest active tier for a user. The candidate rows (own, bought for them, or owned by a
-- linked parent) use indexes; entitlement_covers() then applies the rule.
create function public.tier_rank_for(p_user_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(public.tier_rank(e.tier)), 0)::smallint
  from public.entitlements e
  where e.status = 'active'
    and (
      e.user_id = p_user_id
      or e.granted_for_learner_id = p_user_id
      or e.user_id in (
        select l.parent_id
        from public.parent_links l
        where l.learner_id = p_user_id and l.status = 'active'
      )
    )
    and public.entitlement_covers(e.user_id, e.granted_for_learner_id, p_user_id);
$$;

create or replace function public.my_tier_rank()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select public.tier_rank_for((select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Sprint 1 functions, now raising stable error codes
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    new.updated_at := now();
    return new;
  end if;

  if new.is_demo is distinct from old.is_demo then
    raise exception 'profiles.is_demo can only be set by the server' using errcode = '42501';
  end if;

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'profile id and created_at cannot change' using errcode = '42501';
  end if;

  if (
    new.first_name,
    new.grade,
    new.school_id,
    new.province,
    new.school_name_other,
    new.onboarding_step,
    new.onboarded_at
  ) is distinct from (
    old.first_name,
    old.grade,
    old.school_id,
    old.province,
    old.school_name_other,
    old.onboarding_step,
    old.onboarded_at
  ) and not public.has_consent() then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.declare_age(p_is_adult boolean)
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
  if p_is_adult is null then
    raise exception 'invalid_input';
  end if;

  insert into public.age_declarations (user_id, is_adult) values (v_uid, p_is_adult)
  on conflict (user_id) do nothing;

  if not found then
    raise exception 'not_allowed';
  end if;

  perform public.write_audit('declare_age', v_uid::text);
end;
$$;

create or replace function public.claim_parent_role()
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
  if not exists (
    select 1 from public.age_declarations a where a.user_id = v_uid and a.is_adult
  ) then
    raise exception 'not_allowed';
  end if;

  insert into public.user_roles (user_id, role) values (v_uid, 'parent')
  on conflict do nothing;

  perform public.write_audit('claim_parent_role', v_uid::text);
end;
$$;

-- Called by the request-consent edge function with the caller's session. The contact itself is
-- encrypted and stored by the edge function through store_consent_contact().
create or replace function public.request_consent(p_contact_hash text, p_policy_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_consent_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if not exists (
    select 1 from public.age_declarations a where a.user_id = v_uid and not a.is_adult
  ) then
    raise exception 'not_allowed';
  end if;
  if coalesce(p_contact_hash, '') !~ '^[0-9a-f]{64}$'
    or p_policy_version is distinct from public.consent_policy_version()
  then
    raise exception 'invalid_input';
  end if;
  if (
    select count(*)
    from public.parental_consents c
    where c.learner_id = v_uid and c.requested_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.parental_consents (learner_id, contact_hash, policy_version)
  values (v_uid, p_contact_hash, p_policy_version)
  returning id into v_consent_id;

  perform public.write_audit('request_consent', v_consent_id::text);
  return v_consent_id;
end;
$$;

-- Closes a pending request that is past its 30 days and deletes the stored contact.
create function public.close_expired_consent(p_consent_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.parental_consents
  set status = 'expired', closed_at = now()
  where id = p_consent_id and status = 'pending';

  delete from public.consent_contacts where consent_id = p_consent_id;
$$;

-- Checks shared by the parent consent page, give and decline: a signed-in adult whose
-- verified email hashes to the contact the learner entered. Returns the caller's email hash.
create function public.verified_contact_hash_of_caller()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if not exists (
    select 1 from public.age_declarations a where a.user_id = v_uid and a.is_adult
  ) then
    raise exception 'not_allowed';
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed_at
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_confirmed_at is null then
    raise exception 'email_not_verified';
  end if;
  return public.contact_hash(v_email);
end;
$$;

-- A parent gives consent for a pending request sent to their verified email. This also links
-- the parent and learner: an existing pending or removed link becomes active, otherwise a new
-- active link is made. The stored contact is deleted.
create or replace function public.give_consent(p_consent_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_consent public.parental_consents%rowtype;
  v_caller_hash text;
  v_link_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  select * into v_consent from public.parental_consents c where c.id = p_consent_id for update;

  if v_consent.id is null then
    raise exception 'not_found';
  end if;
  if v_consent.learner_id = v_uid then
    raise exception 'not_allowed';
  end if;
  if v_consent.status = 'expired'
    or (
      v_consent.status = 'pending'
      and public.consent_request_expires_at(v_consent.requested_at) <= now()
    )
  then
    raise exception 'consent_expired';
  end if;
  if v_consent.status <> 'pending' then
    raise exception 'not_allowed';
  end if;
  if not exists (
    select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'parent'
  ) then
    raise exception 'not_allowed';
  end if;

  v_caller_hash := public.verified_contact_hash_of_caller();
  if v_caller_hash <> v_consent.contact_hash then
    raise exception 'contact_mismatch';
  end if;

  insert into public.parent_links (learner_id, parent_id, status, initiated_by, activated_at)
  values (v_consent.learner_id, v_uid, 'active', v_consent.learner_id, now())
  on conflict on constraint parent_links_learner_parent_key do update
  set status = 'active', activated_at = now(), removed_at = null
  returning id into v_link_id;

  update public.parental_consents
  set status = 'given', parent_user_id = v_uid, given_at = now(), link_id = v_link_id
  where id = p_consent_id;

  delete from public.consent_contacts where consent_id = p_consent_id;

  perform public.write_audit('give_consent', p_consent_id::text);
  return v_link_id;
end;
$$;

-- Withdrawing consent (proposed, pending Didi, Product Bible 3.3): the consent becomes
-- withdrawn and the parent link it created is removed. If no other consent is given, the
-- learner's data processing stops until consent is given again.
create or replace function public.withdraw_consent(p_consent_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  update public.parental_consents
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_consent_id and parent_user_id = v_uid and status = 'given'
  returning link_id into v_link_id;

  if not found then
    raise exception 'not_found';
  end if;

  if v_link_id is not null then
    update public.parent_links
    set status = 'removed', removed_at = now()
    where id = v_link_id and status <> 'removed';
  end if;

  perform public.write_audit('withdraw_consent', p_consent_id::text);
end;
$$;

-- The side that did not start the link accepts it. A learner under 18 without consent is
-- linked only when the parent gives consent through give_consent().
create or replace function public.accept_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_learner_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  select l.learner_id into v_learner_id
  from public.parent_links l
  where l.id = p_link_id
    and l.status = 'pending'
    and v_uid in (l.learner_id, l.parent_id)
    and l.initiated_by <> v_uid
  for update;

  if v_learner_id is null then
    raise exception 'not_found';
  end if;
  if not public.has_consent_for(v_learner_id) then
    raise exception 'consent_required';
  end if;

  update public.parent_links
  set status = 'active', activated_at = now()
  where id = p_link_id;

  perform public.write_audit('accept_link', p_link_id::text);
end;
$$;

create or replace function public.remove_link(p_link_id uuid)
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

  update public.parent_links
  set status = 'removed', removed_at = now()
  where id = p_link_id and status <> 'removed' and v_uid in (learner_id, parent_id);

  if not found then
    raise exception 'not_found';
  end if;

  perform public.write_audit('remove_link', p_link_id::text);
end;
$$;

create or replace function public.parent_learner_summary(p_learner_id uuid)
returns table (
  current_streak integer,
  last_active_on date,
  minutes_last_7_days integer,
  tasks_done_last_7_days integer,
  lessons_completed_last_7_days integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if not exists (
    select 1
    from public.parent_links l
    where l.learner_id = p_learner_id and l.parent_id = auth.uid() and l.status = 'active'
  ) then
    raise exception 'not_allowed';
  end if;

  return query
  select
    coalesce((select s.current_length from public.streaks s where s.learner_id = p_learner_id), 0),
    (select s.last_active_on from public.streaks s where s.learner_id = p_learner_id),
    coalesce((
      select sum(a.minutes)::integer
      from public.study_activity a
      where a.learner_id = p_learner_id and a.activity_on > v_today - 7
    ), 0),
    (
      select count(*)::integer
      from public.study_tasks t
      where t.learner_id = p_learner_id
        and t.completed_at is not null
        and (t.completed_at at time zone 'Africa/Johannesburg')::date > v_today - 7
    ),
    (
      select count(*)::integer
      from public.lesson_progress p
      where p.learner_id = p_learner_id
        and p.completed_at is not null
        and (p.completed_at at time zone 'Africa/Johannesburg')::date > v_today - 7
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Account state and onboarding
-- ---------------------------------------------------------------------------

-- Drives routing after sign-in: age question, consent, onboarding or dashboard.
create function public.my_account_state()
returns table (
  is_adult boolean,
  consent_status text,
  roles text[],
  onboarding_step smallint,
  onboarded boolean,
  language text
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
    a.is_adult,
    case
      when a.is_adult then 'not_needed'
      when exists (
        select 1 from public.parental_consents c
        where c.learner_id = v_uid and c.status = 'given'
      ) then 'given'
      when exists (
        select 1 from public.parental_consents c
        where c.learner_id = v_uid
          and c.status = 'pending'
          and public.consent_request_expires_at(c.requested_at) > now()
      ) then 'pending'
      when (
        select c.status from public.parental_consents c
        where c.learner_id = v_uid
        order by c.requested_at desc
        limit 1
      ) = 'withdrawn' then 'withdrawn'
      else 'none'
    end,
    array(select r.role from public.user_roles r where r.user_id = v_uid order by r.role),
    p.onboarding_step,
    p.onboarded_at is not null,
    p.language
  from public.profiles p
  left join public.age_declarations a on a.user_id = p.id
  where p.id = v_uid;
end;
$$;

-- A trimmed string from the onboarding answers, or null for JSON null or a blank string.
-- Anything that is not a string, is too long or has control characters is refused.
create function public.onboarding_text(p_value jsonb, p_max_length integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'string' then
    raise exception 'invalid_input';
  end if;
  v_text := btrim(p_value #>> '{}');
  if v_text ~ '[[:cntrl:]]' or char_length(v_text) > p_max_length then
    raise exception 'invalid_input';
  end if;
  return nullif(v_text, '');
end;
$$;

-- A JSON array of distinct strings, each one of p_allowed.
create function public.onboarding_choices(p_value jsonb, p_allowed text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_items text[];
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from jsonb_array_elements(p_value) e where jsonb_typeof(e) <> 'string') then
    raise exception 'invalid_input';
  end if;
  v_items := array(select jsonb_array_elements_text(p_value));
  if cardinality(v_items) > cardinality(p_allowed)
    or not (v_items <@ p_allowed)
    or cardinality(v_items) <> (select count(distinct item) from unnest(v_items) item)
  then
    raise exception 'invalid_input';
  end if;
  return v_items;
end;
$$;

-- Saves the five onboarding steps in one go (Product Bible 3.4). Needs consent. Every field is
-- checked; an answer with a missing, extra or wrong field is refused as a whole.
create function public.save_onboarding(p_answers jsonb)
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
  v_goal text;
  v_days smallint[];
  v_bands text[];
  v_careers text[];
  v_item jsonb;
  v_subject_id uuid;
  v_target smallint;
  v_subject_ids uuid[] := '{}';
  v_targets smallint[] := '{}';
  v_kinds text[] := '{}';
  v_dates date[] := '{}';
  v_date date;
  v_this_year integer := extract(year from now() at time zone 'Africa/Johannesburg')::integer;
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
  v_first_name := public.onboarding_text(p_answers -> 'first_name', 60);
  if v_first_name is null then
    raise exception 'invalid_input';
  end if;

  if jsonb_typeof(p_answers -> 'grade') <> 'number' or p_answers ->> 'grade' not in ('11', '12') then
    raise exception 'invalid_input';
  end if;
  v_grade := (p_answers ->> 'grade')::smallint;

  if jsonb_typeof(p_answers -> 'school_id') <> 'null' then
    if jsonb_typeof(p_answers -> 'school_id') <> 'string'
      or p_answers ->> 'school_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      raise exception 'invalid_input';
    end if;
    v_school_id := (p_answers ->> 'school_id')::uuid;
    if not exists (select 1 from public.schools s where s.id = v_school_id) then
      raise exception 'invalid_input';
    end if;
  end if;

  v_school_other := public.onboarding_text(p_answers -> 'school_name_other', 120);
  if v_school_id is not null and v_school_other is not null then
    raise exception 'invalid_input';
  end if;

  if jsonb_typeof(p_answers -> 'province') <> 'string'
    or p_answers ->> 'province' not in ('EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC')
  then
    raise exception 'invalid_input';
  end if;
  v_province := p_answers ->> 'province';

  -- Step 2: subjects and targets
  if jsonb_typeof(p_answers -> 'subjects') <> 'array'
    or jsonb_array_length(p_answers -> 'subjects') > 20
  then
    raise exception 'invalid_input';
  end if;
  for v_item in select e from jsonb_array_elements(p_answers -> 'subjects') e loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ?& array['code', 'target_mark'])
      or exists (
        select 1 from jsonb_object_keys(v_item) k where k not in ('code', 'target_mark')
      )
      or jsonb_typeof(v_item -> 'code') <> 'string'
    then
      raise exception 'invalid_input';
    end if;

    select s.id into v_subject_id from public.subjects s where s.code = v_item ->> 'code';
    if v_subject_id is null or v_subject_id = any (v_subject_ids) then
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

    v_subject_ids := v_subject_ids || v_subject_id;
    v_targets := v_targets || v_target;
  end loop;

  -- Step 3: exam dates
  if jsonb_typeof(p_answers -> 'exam_dates') <> 'array'
    or jsonb_array_length(p_answers -> 'exam_dates') > 2
  then
    raise exception 'invalid_input';
  end if;
  for v_item in select e from jsonb_array_elements(p_answers -> 'exam_dates') e loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ?& array['kind', 'date'])
      or exists (select 1 from jsonb_object_keys(v_item) k where k not in ('kind', 'date'))
      or jsonb_typeof(v_item -> 'kind') <> 'string'
      or v_item ->> 'kind' not in ('trial', 'final')
      or v_item ->> 'kind' = any (v_kinds)
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
    v_kinds := v_kinds || (v_item ->> 'kind');
    v_dates := v_dates || v_date;
  end loop;
  if cardinality(v_kinds) = 2
    and v_dates[array_position(v_kinds, 'trial')] >= v_dates[array_position(v_kinds, 'final')]
  then
    raise exception 'invalid_input';
  end if;

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

  delete from public.learner_subjects
  where learner_id = v_uid and subject_id <> all (v_subject_ids);
  insert into public.learner_subjects (learner_id, subject_id, target_mark)
  select v_uid, chosen.subject_id, chosen.target_mark
  from unnest(v_subject_ids, v_targets) as chosen (subject_id, target_mark)
  on conflict (learner_id, subject_id) do update set target_mark = excluded.target_mark;

  delete from public.learner_exam_dates
  where learner_id = v_uid and subject_id is null and kind <> all (v_kinds);
  insert into public.learner_exam_dates (learner_id, kind, subject_id, starts_on)
  select v_uid, chosen.kind, null, chosen.starts_on
  from unnest(v_kinds, v_dates) as chosen (kind, starts_on)
  on conflict (learner_id, kind, subject_id) do update set starts_on = excluded.starts_on;

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

-- ---------------------------------------------------------------------------
-- Invite codes and parent linking (Product Bible 3.18 and 6.3 rule 11)
-- ---------------------------------------------------------------------------

-- 8 characters from an alphabet without look-alikes (no I, L, O, 0 or 1). The random bytes
-- come from gen_random_uuid(), which uses the strong random source; only the fully random
-- bytes of the UUID are used, and bytes are rejected above 247 so every letter is as likely.
create function public.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea;
  v_byte integer;
  v_position integer;
begin
  while char_length(v_code) < 8 loop
    v_bytes := uuid_send(gen_random_uuid());
    foreach v_position in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15] loop
      v_byte := get_byte(v_bytes, v_position);
      if v_byte < 248 and char_length(v_code) < 8 then
        v_code := v_code || substr(v_alphabet, v_byte % 31 + 1, 1);
      end if;
    end loop;
  end loop;
  return v_code;
end;
$$;

create function public.create_invite(p_kind text)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_expires_at timestamptz;
  v_tries integer := 0;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if p_kind is null or p_kind not in ('parent_to_learner', 'learner_to_parent') then
    raise exception 'invalid_input';
  end if;
  if p_kind = 'parent_to_learner' and not exists (
    select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'parent'
  ) then
    raise exception 'not_allowed';
  end if;
  if (
    select count(*)
    from public.invites i
    where i.created_by = v_uid and i.created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'rate_limited';
  end if;

  loop
    begin
      insert into public.invites as i (code, created_by, kind)
      values (public.new_invite_code(), v_uid, p_kind)
      returning i.code, i.expires_at into v_code, v_expires_at;
      exit;
    exception
      when unique_violation then
        v_tries := v_tries + 1;
        if v_tries >= 5 then
          raise;
        end if;
    end;
  end loop;

  perform public.write_audit('create_invite', p_kind);
  return query select v_code, v_expires_at;
end;
$$;

-- Redeems a code and creates a pending link; the other side then accepts it. Wrong codes are
-- counted, so a wrong or expired code is returned in the error column instead of raised: a
-- raised error would roll back the record of the failed try. Five failed tries in 15 minutes
-- give rate_limited. If the learner is under 18 without consent, a consent request bound to the
-- parent's email is opened at the same time and the parent answers it with give_consent().
create function public.redeem_invite(p_code text)
returns table (link_id uuid, error text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'));
  v_invite public.invites%rowtype;
  v_learner_id uuid;
  v_parent_id uuid;
  v_link_id uuid;
  v_link_status text;
  v_error text;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if (
    select count(*)
    from public.invite_attempts a
    where a.user_id = v_uid and not a.succeeded and a.attempted_at > now() - interval '15 minutes'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;

  if v_code ~ '^[A-Z0-9]{8,16}$' then
    select * into v_invite from public.invites i where i.code = v_code for update;
  end if;

  if v_invite.id is null or v_invite.used_at is not null or v_invite.created_by = v_uid then
    v_error := 'invalid_code';
  elsif v_invite.expires_at <= now() then
    v_error := 'code_expired';
  elsif v_invite.kind = 'learner_to_parent' and not exists (
    select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'parent'
  ) then
    v_error := 'not_allowed';
  end if;

  if v_error is null then
    if v_invite.kind = 'parent_to_learner' then
      v_learner_id := v_uid;
      v_parent_id := v_invite.created_by;
    else
      v_learner_id := v_invite.created_by;
      v_parent_id := v_uid;
    end if;

    select l.id, l.status into v_link_id, v_link_status
    from public.parent_links l
    where l.learner_id = v_learner_id and l.parent_id = v_parent_id
    for update;

    if v_link_status in ('pending', 'active') then
      v_error := 'already_linked';
    end if;
  end if;

  if v_error is not null then
    insert into public.invite_attempts (user_id, succeeded) values (v_uid, false);
    return query select null::uuid, v_error;
    return;
  end if;

  if v_link_id is null then
    insert into public.parent_links (learner_id, parent_id, status, initiated_by)
    values (v_learner_id, v_parent_id, 'pending', v_uid)
    returning id into v_link_id;
  else
    update public.parent_links
    set status = 'pending', initiated_by = v_uid, activated_at = null, removed_at = null
    where id = v_link_id;
  end if;

  update public.invites set used_at = now(), used_by = v_uid where id = v_invite.id;
  insert into public.invite_attempts (user_id, succeeded) values (v_uid, true);

  if not public.has_consent_for(v_learner_id) then
    insert into public.parental_consents (learner_id, contact_hash, policy_version, link_id)
    select v_learner_id, public.contact_hash(u.email), public.consent_policy_version(), v_link_id
    from auth.users u
    where u.id = v_parent_id and u.email is not null;
  end if;

  perform public.write_audit('redeem_invite', v_link_id::text);
  return query select v_link_id, null::text;
end;
$$;

-- The caller's pending and active links. The other person's first name is shown only for a
-- parent, or for a learner who has consent. consent_id is the request a parent answers with
-- give_consent() when the learner is under 18 and still needs consent.
create function public.my_family()
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
-- The parent side of a consent request
-- ---------------------------------------------------------------------------

-- For the parent consent page. Only a signed-in adult whose verified email matches the
-- request (or the parent who already answered it) can read it. A request past its 30 days is
-- closed here and its stored contact deleted.
create function public.consent_request_for_parent(p_consent_id uuid)
returns table (
  learner_first_name text,
  requested_at timestamptz,
  expires_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_hash text;
  v_consent public.parental_consents%rowtype;
begin
  v_caller_hash := public.verified_contact_hash_of_caller();

  select * into v_consent from public.parental_consents c where c.id = p_consent_id for update;
  if v_consent.id is null then
    raise exception 'not_found';
  end if;
  if v_consent.parent_user_id is distinct from v_uid
    and v_consent.contact_hash <> v_caller_hash
  then
    raise exception 'contact_mismatch';
  end if;

  if v_consent.status = 'pending'
    and public.consent_request_expires_at(v_consent.requested_at) <= now()
  then
    perform public.close_expired_consent(v_consent.id);
    v_consent.status := 'expired';
  end if;

  return query
  select
    case when v_consent.status = 'given' then p.first_name end,
    v_consent.requested_at,
    public.consent_request_expires_at(v_consent.requested_at),
    v_consent.status
  from public.profiles p
  where p.id = v_consent.learner_id;
end;
$$;

-- "This is not my child": closes the request and deletes the stored contact.
create function public.decline_consent(p_consent_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_hash text;
  v_consent public.parental_consents%rowtype;
begin
  v_caller_hash := public.verified_contact_hash_of_caller();

  select * into v_consent from public.parental_consents c where c.id = p_consent_id for update;
  if v_consent.id is null then
    raise exception 'not_found';
  end if;
  if v_consent.contact_hash <> v_caller_hash then
    raise exception 'contact_mismatch';
  end if;
  if v_consent.status <> 'pending' then
    raise exception 'not_allowed';
  end if;

  if public.consent_request_expires_at(v_consent.requested_at) <= now() then
    perform public.close_expired_consent(v_consent.id);
  else
    update public.parental_consents
    set status = 'declined', closed_at = now()
    where id = p_consent_id;
    delete from public.consent_contacts where consent_id = p_consent_id;
  end if;

  perform public.write_audit('decline_consent', p_consent_id::text);
end;
$$;

-- Stores the encrypted parent contact for Resend. Service role only (request-consent).
create function public.store_consent_contact(
  p_consent_id uuid,
  p_channel text,
  p_contact_encrypted bytea
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.consent_contacts (consent_id, channel, contact_encrypted, expires_at)
  select c.id, p_channel, p_contact_encrypted, public.consent_request_expires_at(c.requested_at)
  from public.parental_consents c
  where c.id = p_consent_id and c.status = 'pending'
  on conflict (consent_id) do update
  set channel = excluded.channel, contact_encrypted = excluded.contact_encrypted;

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- Daily clean-up. Service role only, scheduled below when pg_cron is enabled.
create function public.run_housekeeping()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.parental_consents
  set status = 'expired', closed_at = now()
  where status = 'pending' and public.consent_request_expires_at(requested_at) <= now();

  delete from public.consent_contacts cc
  using public.parental_consents c
  where c.id = cc.consent_id and (c.status <> 'pending' or cc.expires_at <= now());

  delete from public.invite_attempts where attempted_at < now() - interval '1 day';
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ws12-housekeeping', '17 1 * * *', 'select public.run_housekeeping()');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Purchases, entitlements and My Library (Product Bible 2.3, 3.17, 9.2)
-- ---------------------------------------------------------------------------

-- Claims purchases made with the caller's email before the account existed. Only for an email
-- that Supabase Auth has verified.
create function public.claim_entitlements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_claimed integer;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  select public.normalize_contact(u.email), u.email_confirmed_at into v_email, v_confirmed_at
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_confirmed_at is null then
    raise exception 'email_not_verified';
  end if;

  update public.purchases
  set buyer_user_id = v_uid
  where buyer_user_id is null and lower(buyer_email) = v_email;

  update public.entitlements
  set user_id = v_uid, claimed_at = now()
  where user_id is null and lower(email) = v_email;
  get diagnostics v_claimed = row_count;

  if v_claimed > 0 then
    perform public.write_audit('claim_entitlements', v_claimed::text);
  end if;
  return v_claimed;
end;
$$;

-- Every library file with whether the caller's tier unlocks it, so locked rows can show
-- "Upgrade".
create function public.my_library()
returns table (
  file_id uuid,
  kind text,
  language text,
  title_en text,
  title_af text,
  size_bytes bigint,
  min_tier text,
  unlocked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rank smallint;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  v_rank := public.my_tier_rank();

  return query
  select
    f.id,
    f.kind,
    f.language,
    f.title_en,
    f.title_af,
    f.size_bytes,
    f.min_tier,
    public.tier_rank(f.min_tier) <= v_rank
  from public.library_files f
  order by
    array_position(array['book', 'bonus', 'planner'], f.kind),
    public.tier_rank(f.min_tier),
    f.language,
    f.title_en;
end;
$$;

-- The storage path of a file the caller may download. Called by the library-download edge
-- function with the caller's session, which then signs a short-lived link.
create function public.library_download_path(p_file_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_path text;
  v_min_tier text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;

  select f.storage_path, f.min_tier into v_path, v_min_tier
  from public.library_files f
  where f.id = p_file_id;

  if v_path is null then
    raise exception 'not_found';
  end if;
  if public.tier_rank(v_min_tier) > public.my_tier_rank() then
    raise exception 'not_allowed';
  end if;
  return v_path;
end;
$$;

-- Records one verified payment event from the payfast-itn or stripe-webhook edge function.
-- Service role only. It runs in one transaction: the event is stored once (payment_events),
-- then the purchase and entitlement are written. A paid amount must equal the product price.
-- Returns recorded, duplicate, amount_mismatch, unknown_product, unknown_purchase, ignored or
-- invalid_input.
create function public.record_payment(
  p_provider text,
  p_event_id text,
  p_payload_hash text,
  p_provider_ref text,
  p_outcome text,
  p_product_code text,
  p_buyer_email text,
  p_amount_cents integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_email text := public.normalize_contact(p_buyer_email);
  v_buyer_id uuid;
  v_purchase_id uuid;
begin
  if p_provider is null
    or p_provider not in ('payfast', 'stripe')
    or coalesce(p_event_id, '') = ''
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_provider_ref, '') = ''
    or p_outcome is null
    or p_outcome not in ('paid', 'refunded', 'failed')
  then
    return 'invalid_input';
  end if;

  if p_outcome = 'paid' then
    if coalesce(v_email, '') !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
      return 'invalid_input';
    end if;
    select * into v_product from public.products p where p.code = p_product_code and p.active;
    if v_product.id is null then
      return 'unknown_product';
    end if;
    if p_amount_cents is distinct from v_product.price_cents then
      perform public.write_audit('payment_amount_mismatch', p_provider || ':' || p_event_id);
      return 'amount_mismatch';
    end if;
  end if;

  insert into public.payment_events (provider, event_id, payload_hash)
  values (p_provider, p_event_id, p_payload_hash)
  on conflict (event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if p_outcome = 'paid' then
    select u.id into v_buyer_id
    from auth.users u
    where u.email = v_email and u.email_confirmed_at is not null;

    insert into public.purchases as pu
      (buyer_email, buyer_user_id, product_id, provider, provider_ref, amount_cents, status,
        raw_event_id)
    values
      (v_email, v_buyer_id, v_product.id, p_provider, p_provider_ref, p_amount_cents, 'paid',
        p_event_id)
    on conflict (provider, provider_ref) do update
    set
      status = 'paid',
      amount_cents = excluded.amount_cents,
      raw_event_id = excluded.raw_event_id,
      buyer_user_id = coalesce(pu.buyer_user_id, excluded.buyer_user_id)
    where pu.status <> 'refunded'
    returning pu.id into v_purchase_id;

    if v_purchase_id is null then
      return 'ignored';
    end if;

    update public.entitlements set status = 'active' where source_purchase_id = v_purchase_id;
    if not found then
      insert into public.entitlements (user_id, email, tier, status, source_purchase_id, claimed_at)
      values (
        v_buyer_id,
        v_email,
        v_product.tier,
        'active',
        v_purchase_id,
        case when v_buyer_id is not null then now() end
      );
    end if;
  else
    update public.purchases
    set status = p_outcome, raw_event_id = p_event_id
    where provider = p_provider and provider_ref = p_provider_ref
    returning id into v_purchase_id;

    if v_purchase_id is null then
      return 'unknown_purchase';
    end if;

    update public.entitlements set status = 'inactive' where source_purchase_id = v_purchase_id;
  end if;

  perform public.write_audit('payment_' || p_outcome, v_purchase_id::text);
  return 'recorded';
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. New tables give clients nothing. Execute is revoked from everyone and granted
-- again only where a function is meant to be called.
-- ---------------------------------------------------------------------------

revoke all on public.invite_attempts from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_admin(),
  public.has_consent(),
  public.declare_age(boolean),
  public.claim_parent_role(),
  public.request_consent(text, text),
  public.give_consent(uuid),
  public.withdraw_consent(uuid),
  public.accept_link(uuid),
  public.remove_link(uuid),
  public.parent_learner_summary(uuid),
  public.can_read_content_body(uuid),
  public.content_body(uuid),
  public.my_account_state(),
  public.save_onboarding(jsonb),
  public.create_invite(text),
  public.redeem_invite(text),
  public.my_family(),
  public.consent_request_for_parent(uuid),
  public.decline_consent(uuid),
  public.claim_entitlements(),
  public.my_library(),
  public.library_download_path(uuid)
to authenticated;

grant execute on function
  public.store_consent_contact(uuid, text, bytea),
  public.record_payment(text, text, text, text, text, text, text, integer),
  public.run_housekeeping()
to service_role;
