-- WS12 foundation schema (Product Bible Chapter 6).
-- Every table has Row Level Security enabled and default deny. Client privileges are revoked
-- first and then granted table by table, so a table only exposes what its policies allow.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity and people
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text not null,
  emis_number text unique
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(first_name) between 1 and 60),
  grade smallint check (grade in (11, 12)),
  school_id uuid references public.schools (id) on delete set null,
  province text,
  school_name_other text check (char_length(school_name_other) <= 120),
  language text not null default 'en' check (language in ('en', 'af')),
  onboarding_step smallint not null default 0 check (onboarding_step between 0 and 5),
  onboarded_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.age_declarations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_adult boolean not null,
  declared_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('learner', 'parent', 'teacher', 'admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.parental_consents (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  parent_user_id uuid references auth.users (id) on delete set null,
  contact_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'given', 'withdrawn')),
  requested_at timestamptz not null default now(),
  given_at timestamptz,
  withdrawn_at timestamptz,
  policy_version text not null
);

create index parental_consents_learner_idx on public.parental_consents (learner_id);
create index parental_consents_parent_idx on public.parental_consents (parent_user_id);

create table public.consent_contacts (
  consent_id uuid primary key references public.parental_consents (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  contact_encrypted bytea not null,
  expires_at timestamptz not null default now() + interval '30 days'
);

create table public.parent_links (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  initiated_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  removed_at timestamptz,
  constraint parent_links_learner_parent_key unique (learner_id, parent_id),
  constraint parent_links_not_self check (learner_id <> parent_id)
);

create index parent_links_parent_idx on public.parent_links (parent_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) >= 8),
  created_by uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('parent_to_learner', 'learner_to_parent')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

create index invites_created_by_idx on public.invites (created_by);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  study_reminder boolean not null default true,
  goal_reminder boolean not null default true,
  streak_reminder boolean not null default true,
  new_strategy boolean not null default true,
  exam_countdown boolean not null default true,
  achievement boolean not null default true,
  announcement boolean not null default true,
  lesson_unlocked boolean not null default true,
  parent_link boolean not null default true,
  quiet_start time not null default '22:30',
  quiet_end time not null default '06:00',
  reminder_time time,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Content (Melvin's book and WS12 material). Rows are written by admins only.
-- ---------------------------------------------------------------------------

create table public.content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in (
      'chapter',
      'strategy',
      'topic',
      'lesson',
      'activity',
      'framework',
      'story',
      'quiz',
      'explanation'
    )
  ),
  parent_id uuid references public.content (id) on delete restrict,
  slug text not null unique,
  title_en text not null,
  title_af text,
  body_en text,
  body_af text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'retired')),
  version integer not null default 1,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_parent_idx on public.content (parent_id);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content (id) on delete restrict,
  mls_number smallint not null unique check (mls_number between 1 and 52),
  week_number smallint not null check (week_number between 1 and 52),
  reading_minutes smallint check (reading_minutes > 0),
  min_tier text not null default 'free' check (min_tier in ('free', 'r99', 'r199', 'r349'))
);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  text_en text not null,
  text_af text,
  content_id uuid references public.content (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'retired')),
  starts_on date
);

create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_af text,
  intro_en text,
  intro_af text,
  scoring_rule jsonb,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'retired')),
  version integer not null default 1
);

create table public.questionnaire_items (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  position smallint not null,
  prompt_en text not null,
  prompt_af text,
  options jsonb not null default '[]',
  scale text,
  unique (questionnaire_id, position)
);

create table public.questionnaire_results_bands (
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  band text not null,
  min_score numeric not null,
  max_score numeric not null,
  label_en text not null,
  label_af text,
  meaning_en text,
  meaning_af text,
  next_step_content_id uuid references public.content (id) on delete set null,
  primary key (questionnaire_id, band),
  check (min_score <= max_score)
);

create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_af text,
  items jsonb not null default '[]',
  source_content_id uuid references public.content (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'retired'))
);

-- ---------------------------------------------------------------------------
-- Study
-- ---------------------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_af text not null
);

create table public.learner_preferences (
  learner_id uuid primary key references auth.users (id) on delete cascade,
  study_days smallint[] not null default '{}' check (study_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  study_times text[] not null default '{}' check (
    study_times <@ array['morning', 'afternoon', 'evening', 'late']
  ),
  career_interests text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.learner_subjects (
  learner_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  target_mark smallint check (target_mark between 0 and 100),
  current_mark smallint check (current_mark between 0 and 100),
  primary key (learner_id, subject_id)
);

create table public.subject_marks (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  mark numeric(5, 2) not null check (mark between 0 and 100),
  kind text not null check (kind in ('test', 'assignment', 'practice', 'trial')),
  recorded_on date not null
);

create index subject_marks_learner_idx on public.subject_marks (learner_id, subject_id);

create table public.exam_dates (
  id uuid primary key default gen_random_uuid(),
  year smallint not null,
  kind text not null check (kind in ('trial', 'final')),
  subject_id uuid references public.subjects (id) on delete cascade,
  starts_on date not null,
  status text not null default 'provisional' check (status in ('provisional', 'confirmed')),
  source_note text
);

create table public.learner_exam_dates (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('trial', 'final')),
  subject_id uuid references public.subjects (id) on delete cascade,
  starts_on date not null,
  unique nulls not distinct (learner_id, kind, subject_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('academic', 'subject', 'study', 'exam', 'personal')),
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  current_value numeric not null default 0,
  target_value numeric,
  deadline date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create index goals_learner_idx on public.goals (learner_id);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  activity text not null check (char_length(activity) between 1 and 200),
  starts_at timestamptz not null,
  duration_minutes smallint not null check (duration_minutes between 1 and 720),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  source text not null default 'learner' check (source in ('learner', 'template', 'ai'))
);

create index study_sessions_learner_idx on public.study_sessions (learner_id, starts_at);

create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.study_sessions (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  due_on date not null,
  start_time time,
  end_time time,
  completed_at timestamptz
);

create index study_tasks_learner_idx on public.study_tasks (learner_id, due_on);

create table public.study_activity (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  activity_on date not null,
  kind text not null check (kind in ('task', 'session', 'lesson', 'assessment')),
  minutes smallint not null default 0 check (minutes between 0 and 720),
  ref_id uuid
);

create index study_activity_learner_idx on public.study_activity (learner_id, activity_on);

create table public.streaks (
  learner_id uuid primary key references auth.users (id) on delete cascade,
  current_length integer not null default 0,
  longest_length integer not null default 0,
  last_active_on date,
  updated_at timestamptz not null default now()
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_af text not null,
  rule jsonb not null default '{}'
);

create table public.learner_achievements (
  learner_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (learner_id, achievement_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title_key text not null,
  params jsonb not null default '{}',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  rule_code text not null,
  reason_key text not null,
  action_link text,
  shown_at timestamptz not null default now(),
  acted_at timestamptz
);

create index recommendations_learner_idx on public.recommendations (learner_id, shown_at desc);

create table public.lesson_progress (
  learner_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  opened_at timestamptz,
  completed_at timestamptz,
  reflection text check (char_length(reflection) <= 5000),
  primary key (learner_id, lesson_id)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires (id) on delete restrict,
  questionnaire_version integer not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric,
  band text,
  shared_with_parent boolean not null default false
);

create index assessment_attempts_learner_idx on public.assessment_attempts (learner_id);

create table public.assessment_answers (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  item_id uuid not null references public.questionnaire_items (id) on delete restrict,
  answer jsonb not null,
  primary key (attempt_id, item_id)
);

create table public.worksheet_answers (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  activity_content_id uuid not null references public.content (id) on delete restrict,
  content_version integer not null,
  answers jsonb not null default '{}',
  saved_at timestamptz not null default now()
);

create index worksheet_answers_learner_idx on public.worksheet_answers (learner_id);

-- ---------------------------------------------------------------------------
-- Commerce and library. Written only by payment webhooks and server functions.
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  tier text not null check (tier in ('free', 'r99', 'r199', 'r349')),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default false
);

create table public.library_files (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_af text,
  language text not null check (language in ('en', 'af')),
  storage_path text not null unique,
  min_tier text not null check (min_tier in ('free', 'r99', 'r199', 'r349')),
  kind text not null check (kind in ('book', 'bonus', 'planner')),
  size_bytes bigint check (size_bytes >= 0)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_email text not null,
  buyer_user_id uuid references auth.users (id) on delete set null,
  product_id uuid not null references public.products (id) on delete restrict,
  provider text not null check (provider in ('payfast', 'stripe')),
  provider_ref text not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null check (status in ('pending', 'paid', 'refunded', 'failed')),
  raw_event_id text,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index purchases_buyer_idx on public.purchases (buyer_user_id);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  tier text not null check (tier in ('free', 'r99', 'r199', 'r349')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  source_purchase_id uuid references public.purchases (id) on delete set null,
  granted_for_learner_id uuid references auth.users (id) on delete set null,
  claimed_at timestamptz
);

create index entitlements_user_idx on public.entitlements (user_id);
create index entitlements_email_idx on public.entitlements (lower(email));

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('payfast', 'stripe')),
  event_id text not null unique,
  received_at timestamptz not null default now(),
  payload_hash text not null
);

-- ---------------------------------------------------------------------------
-- AI and analytics
-- ---------------------------------------------------------------------------

-- The embedding dimension is set in Sprint 6 once the model provider is chosen.
create table public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content (id) on delete cascade,
  content_version integer not null,
  language text not null check (language in ('en', 'af')),
  text text not null,
  embedding extensions.vector
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users (id) on delete cascade,
  agent text not null default 'tutor' check (agent in ('tutor')),
  started_at timestamptz not null default now()
);

create index ai_conversations_learner_idx on public.ai_conversations (learner_id);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('learner', 'assistant')),
  text text not null,
  source_chunk_ids uuid[] not null default '{}',
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  event text not null check (event ~ '^[a-z][a-z0-9_]{1,63}$'),
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger content_set_updated_at before update on public.content
  for each row execute function public.set_updated_at();
create trigger learner_preferences_set_updated_at before update on public.learner_preferences
  for each row execute function public.set_updated_at();
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
create trigger streaks_set_updated_at before update on public.streaks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role and consent checks used by policies
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'
  );
$$;

-- True when the caller declared they are 18 or older, or a parent has given consent.
-- It reads only server-written tables, never a value the client can edit.
create function public.has_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.age_declarations a where a.user_id = auth.uid() and a.is_adult
  )
  or exists (
    select 1
    from public.parental_consents c
    where c.learner_id = auth.uid() and c.status = 'given'
  );
$$;

create function public.write_audit(p_action text, p_target text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target) values (auth.uid(), p_action, p_target);
$$;

-- ---------------------------------------------------------------------------
-- Tier checks for lesson bodies (Product Bible 6.2 and 6.3 rule 5)
-- ---------------------------------------------------------------------------

-- Tiers in ascending order, so a person's highest entitlement can be compared to min_tier.
create function public.tier_rank(p_tier text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_tier
    when 'free' then 0
    when 'r99' then 1
    when 'r199' then 2
    when 'r349' then 3
  end::smallint;
$$;

-- The caller's highest active entitlement, counting entitlements bought for them by a parent.
-- Every account is at least free.
create function public.my_tier_rank()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(public.tier_rank(e.tier)), 0)::smallint
  from public.entitlements e
  where e.status = 'active'
    and (select auth.uid()) in (e.user_id, e.granted_for_learner_id);
$$;

-- Whether the caller may read the body of a content row. The row must be approved, and the
-- caller's tier must reach the highest min_tier of any lesson on the row or above it in the
-- content tree, so an activity inside a paid lesson is gated with that lesson. The weekly
-- unlock rule belongs here as one more condition once it is confirmed.
create function public.can_read_content_body(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive content_chain (id, parent_id, depth) as (
    select c.id, c.parent_id, 1
    from public.content c
    where c.id = p_content_id
    union all
    select c.id, c.parent_id, chain.depth + 1
    from public.content c
    join content_chain chain on c.id = chain.parent_id
    where chain.depth < 10
  )
  select public.is_admin()
    or (
      exists (select 1 from public.content c where c.id = p_content_id and c.status = 'approved')
      and coalesce(
        (
          select max(public.tier_rank(l.min_tier))
          from public.lessons l
          join content_chain chain on l.content_id = chain.id
        ),
        0
      ) <= public.my_tier_rank()
    );
$$;

-- Clients have no select on content.body_en and content.body_af; bodies are read here.
-- A row the caller may not read returns no rows.
create function public.content_body(p_content_id uuid)
returns table (body_en text, body_af text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.body_en, c.body_af
  from public.content c
  where c.id = p_content_id and public.can_read_content_body(c.id);
$$;

-- ---------------------------------------------------------------------------
-- profiles: sign-up trigger and column guards
-- ---------------------------------------------------------------------------

-- Creates the profile and the learner role. Only the app language is read from sign-up
-- metadata; Google name and picture are never copied (Product Bible 2.3).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text := coalesce(new.raw_user_meta_data ->> 'language', 'en');
begin
  if v_language not in ('en', 'af') then
    v_language := 'en';
  end if;

  insert into public.profiles (id, language) values (new.id, v_language);
  insert into public.user_roles (user_id, role) values (new.id, 'learner');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Client roles may change language at any time. Every other profile column needs consent,
-- and is_demo is server-only. Security definer functions run as the owner and are not limited.
create function public.guard_profile_update()
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
    raise exception 'parental consent is needed before saving profile details'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard_update before update on public.profiles
  for each row execute function public.guard_profile_update();

create function public.guard_profile_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and new.is_demo then
    raise exception 'profiles.is_demo can only be set by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_insert before insert on public.profiles
  for each row execute function public.guard_profile_insert();

-- ---------------------------------------------------------------------------
-- assessment_attempts: a completed attempt is frozen (Product Bible 6.3)
-- ---------------------------------------------------------------------------

-- Answers are only writable while completed_at is null, so a client must never be able to
-- reopen an attempt or change its result. Only shared_with_parent stays editable afterwards.
create function public.guard_assessment_attempt_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.id, new.learner_id, new.questionnaire_id, new.questionnaire_version, new.started_at)
    is distinct from
    (old.id, old.learner_id, old.questionnaire_id, old.questionnaire_version, old.started_at)
  then
    raise exception 'an assessment attempt cannot move to another learner or questionnaire'
      using errcode = '42501';
  end if;

  if old.completed_at is not null
    and (new.completed_at, new.score, new.band) is distinct from
      (old.completed_at, old.score, old.band)
  then
    raise exception 'a completed assessment attempt cannot be changed' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger assessment_attempts_guard_update before update on public.assessment_attempts
  for each row execute function public.guard_assessment_attempt_update();

-- ---------------------------------------------------------------------------
-- Sensitive flows (Product Bible 6.3 rule 10). Each checks auth.uid() and writes audit_log.
-- ---------------------------------------------------------------------------

create function public.declare_age(p_is_adult boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_is_adult is null then
    raise exception 'an age answer is needed' using errcode = '22004';
  end if;

  insert into public.age_declarations (user_id, is_adult) values (v_uid, p_is_adult)
  on conflict (user_id) do nothing;

  if not found then
    raise exception 'age has already been declared' using errcode = '23505';
  end if;

  perform public.write_audit('declare_age', v_uid::text);
end;
$$;

create function public.claim_parent_role()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.age_declarations a where a.user_id = v_uid and a.is_adult
  ) then
    raise exception 'only an adult account can become a parent account' using errcode = '42501';
  end if;

  insert into public.user_roles (user_id, role) values (v_uid, 'parent')
  on conflict do nothing;

  perform public.write_audit('claim_parent_role', v_uid::text);
end;
$$;

-- Called by a learner under 18. The parent contact itself is encrypted and stored in
-- consent_contacts by an edge function; the client only sends a hash.
create function public.request_consent(p_contact_hash text, p_policy_version text)
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
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.age_declarations a where a.user_id = v_uid and not a.is_adult
  ) then
    raise exception 'consent requests are only for learners under 18' using errcode = '42501';
  end if;
  if coalesce(p_contact_hash, '') = '' or coalesce(p_policy_version, '') = '' then
    raise exception 'contact and policy version are needed' using errcode = '22004';
  end if;

  insert into public.parental_consents (learner_id, contact_hash, policy_version)
  values (v_uid, p_contact_hash, p_policy_version)
  returning id into v_consent_id;

  perform public.write_audit('request_consent', v_consent_id::text);
  return v_consent_id;
end;
$$;

-- A parent gives consent for a pending request. This also links the parent and learner:
-- an existing pending or removed link becomes active, otherwise a new active link is made.
create function public.give_consent(p_consent_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_learner_id uuid;
  v_status text;
  v_link_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select c.learner_id, c.status into v_learner_id, v_status
  from public.parental_consents c
  where c.id = p_consent_id
  for update;

  if v_learner_id is null then
    raise exception 'consent request not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'consent request is not pending' using errcode = '55000';
  end if;
  if v_learner_id = v_uid then
    raise exception 'a learner cannot give consent for themselves' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'parent'
  ) then
    raise exception 'only a parent account can give consent' using errcode = '42501';
  end if;

  update public.parental_consents
  set status = 'given', parent_user_id = v_uid, given_at = now()
  where id = p_consent_id;

  delete from public.consent_contacts where consent_id = p_consent_id;

  insert into public.parent_links (learner_id, parent_id, status, initiated_by, activated_at)
  values (v_learner_id, v_uid, 'active', v_learner_id, now())
  on conflict on constraint parent_links_learner_parent_key do update
  set status = 'active', activated_at = now(), removed_at = null
  returning id into v_link_id;

  perform public.write_audit('give_consent', p_consent_id::text);
  return v_link_id;
end;
$$;

create function public.withdraw_consent(p_consent_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.parental_consents
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_consent_id and parent_user_id = v_uid and status = 'given';

  if not found then
    raise exception 'no given consent found for this parent' using errcode = 'P0002';
  end if;

  perform public.write_audit('withdraw_consent', p_consent_id::text);
end;
$$;

-- The side that did not start the link accepts it.
create function public.accept_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.parent_links
  set status = 'active', activated_at = now()
  where id = p_link_id
    and status = 'pending'
    and v_uid in (learner_id, parent_id)
    and initiated_by <> v_uid;

  if not found then
    raise exception 'no pending link to accept' using errcode = 'P0002';
  end if;

  perform public.write_audit('accept_link', p_link_id::text);
end;
$$;

create function public.remove_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.parent_links
  set status = 'removed', removed_at = now()
  where id = p_link_id and status <> 'removed' and v_uid in (learner_id, parent_id);

  if not found then
    raise exception 'no link to remove' using errcode = 'P0002';
  end if;

  perform public.write_audit('remove_link', p_link_id::text);
end;
$$;

-- What a linked parent may see (Product Bible 6.3 rule 3): summary fields only.
create function public.parent_learner_summary(p_learner_id uuid)
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
  if not exists (
    select 1
    from public.parent_links l
    where l.learner_id = p_learner_id and l.parent_id = auth.uid() and l.status = 'active'
  ) then
    raise exception 'no active link to this learner' using errcode = '42501';
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

-- Learners see only the status of their own consent requests, never the parent contact.
create view public.my_consent_status
with (security_barrier = true)
as
select c.id, c.status, c.given_at, c.withdrawn_at
from public.parental_consents c
where c.learner_id = auth.uid();

-- ---------------------------------------------------------------------------
-- Row Level Security: on for every table, then explicit policies
-- ---------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- age_declarations
create policy age_declarations_select_own on public.age_declarations for select to authenticated
  using (user_id = (select auth.uid()));

-- user_roles
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
  with check ((select public.is_admin()) and role in ('teacher', 'admin'));
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
  using ((select public.is_admin()) and role in ('teacher', 'admin'));

-- parental_consents: parents see requests they answered; learners use my_consent_status
create policy parental_consents_select on public.parental_consents for select to authenticated
  using (parent_user_id = (select auth.uid()) or (select public.is_admin()));

-- consent_contacts and payment_events and kb_chunks: no client policies (edge functions only)

-- parent_links
create policy parent_links_select on public.parent_links for select to authenticated
  using ((select auth.uid()) in (learner_id, parent_id) or (select public.is_admin()));

-- invites
create policy invites_select_own on public.invites for select to authenticated
  using (created_by = (select auth.uid()));

-- notification_preferences
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_consent()));
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.has_consent()));

-- Study tables owned by a learner: own rows only, writes need consent
do $$
declare
  t text;
begin
  foreach t in array array[
    'learner_subjects',
    'learner_preferences',
    'subject_marks',
    'learner_exam_dates',
    'goals',
    'study_sessions',
    'study_tasks',
    'study_activity',
    'lesson_progress',
    'worksheet_answers',
    'assessment_attempts'
  ] loop
    execute format(
      'create policy %1$s_select_own on public.%1$I for select to authenticated
         using (learner_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_insert_own on public.%1$I for insert to authenticated
         with check (learner_id = (select auth.uid()) and (select public.has_consent()))', t);
    execute format(
      'create policy %1$s_update_own on public.%1$I for update to authenticated
         using (learner_id = (select auth.uid()))
         with check (learner_id = (select auth.uid()) and (select public.has_consent()))', t);
    execute format(
      'create policy %1$s_delete_own on public.%1$I for delete to authenticated
         using (learner_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- assessment_answers: through the learner's own attempt, frozen once the attempt is completed
create policy assessment_answers_select_own on public.assessment_answers for select to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.learner_id = (select auth.uid())
    )
  );
create policy assessment_answers_insert_own on public.assessment_answers for insert to authenticated
  with check (
    (select public.has_consent())
    and exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.learner_id = (select auth.uid()) and a.completed_at is null
    )
  );
create policy assessment_answers_update_own on public.assessment_answers for update to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.learner_id = (select auth.uid()) and a.completed_at is null
    )
  )
  with check (
    (select public.has_consent())
    and exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.learner_id = (select auth.uid()) and a.completed_at is null
    )
  );

-- Server-written learner tables: read own rows only
create policy streaks_select_own on public.streaks for select to authenticated
  using (learner_id = (select auth.uid()));
create policy learner_achievements_select_own on public.learner_achievements
  for select to authenticated
  using (learner_id = (select auth.uid()));

-- recommendations
create policy recommendations_select_own on public.recommendations for select to authenticated
  using (learner_id = (select auth.uid()));
create policy recommendations_insert_own on public.recommendations for insert to authenticated
  with check (learner_id = (select auth.uid()) and (select public.has_consent()));
create policy recommendations_update_own on public.recommendations for update to authenticated
  using (learner_id = (select auth.uid()))
  with check (learner_id = (select auth.uid()));

-- notifications
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- analytics_events: insert own events only, no reads
create policy analytics_events_insert_own on public.analytics_events for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_consent()));

-- AI conversations: read own, written by the ai-gateway edge function
create policy ai_conversations_select_own on public.ai_conversations for select to authenticated
  using (learner_id = (select auth.uid()));
create policy ai_messages_select_own on public.ai_messages for select to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.learner_id = (select auth.uid())
    )
  );

-- Commerce
create policy products_select_active on public.products for select to anon, authenticated
  using (active);
create policy products_admin_write on public.products for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy library_files_select on public.library_files for select to authenticated
  using (true);
create policy library_files_admin_write on public.library_files for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy purchases_select_own on public.purchases for select to authenticated
  using (buyer_user_id = (select auth.uid()) or (select public.is_admin()));
create policy entitlements_select_own on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Content with a status column: approved rows for everyone signed in, all rows for admins
do $$
declare
  t text;
begin
  foreach t in array array['content', 'tips', 'questionnaires', 'plan_templates'] loop
    execute format(
      'create policy %1$s_select_approved on public.%1$I for select to authenticated
         using (status = ''approved'' or (select public.is_admin()))', t);
    execute format(
      'create policy %1$s_admin_write on public.%1$I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- Content without a status column inherits it from the parent row
create policy lessons_select_approved on public.lessons for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.content c where c.id = content_id and c.status = 'approved')
  );
create policy questionnaire_items_select_approved on public.questionnaire_items
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.questionnaires q where q.id = questionnaire_id and q.status = 'approved'
    )
  );
create policy questionnaire_results_bands_select_approved on public.questionnaire_results_bands
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.questionnaires q where q.id = questionnaire_id and q.status = 'approved'
    )
  );

-- Plain reference lists: readable in full by signed-in users, written by admins
do $$
declare
  t text;
begin
  foreach t in array array[
    'subjects',
    'schools',
    'achievements',
    'exam_dates',
    'lessons',
    'questionnaire_items',
    'questionnaire_results_bands'
  ] loop
    if t in ('subjects', 'schools', 'achievements', 'exam_dates') then
      execute format(
        'create policy %1$s_select_all on public.%1$I for select to authenticated using (true)', t);
    end if;
    execute format(
      'create policy %1$s_admin_write on public.%1$I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- audit_log
create policy audit_log_select_admin on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Privileges: revoke everything from client roles, then grant only what policies need
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (
  language,
  first_name,
  grade,
  school_id,
  province,
  school_name_other,
  onboarding_step,
  onboarded_at
) on public.profiles to authenticated;

grant select on
  public.age_declarations,
  public.user_roles,
  public.parental_consents,
  public.parent_links,
  public.invites,
  public.streaks,
  public.learner_achievements,
  public.ai_conversations,
  public.ai_messages,
  public.library_files,
  public.purchases,
  public.entitlements,
  public.audit_log
to authenticated;

grant insert, delete on public.user_roles to authenticated;

grant select, insert, update on public.notification_preferences to authenticated;

grant select, insert, update, delete on
  public.learner_subjects,
  public.learner_preferences,
  public.subject_marks,
  public.learner_exam_dates,
  public.goals,
  public.study_sessions,
  public.study_tasks,
  public.study_activity,
  public.lesson_progress,
  public.worksheet_answers
to authenticated;

grant select, insert, delete on public.assessment_attempts to authenticated;
grant update (completed_at, score, band, shared_with_parent) on public.assessment_attempts
  to authenticated;

grant select, insert, update on public.assessment_answers to authenticated;

grant select, insert on public.recommendations to authenticated;
grant update (acted_at) on public.recommendations to authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant insert (user_id, event, props) on public.analytics_events to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products, public.library_files to authenticated;

-- Lesson bodies are gated by tier, so clients read them through content_body() only.
grant select (
  id,
  kind,
  parent_id,
  slug,
  title_en,
  title_af,
  status,
  version,
  approved_by,
  approved_at,
  source_ref,
  created_at,
  updated_at
) on public.content to authenticated;
grant insert, update, delete on public.content to authenticated;

grant select, insert, update, delete on
  public.tips,
  public.questionnaires,
  public.plan_templates,
  public.lessons,
  public.questionnaire_items,
  public.questionnaire_results_bands,
  public.subjects,
  public.schools,
  public.achievements,
  public.exam_dates
to authenticated;

grant select on public.my_consent_status to authenticated;

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
  public.content_body(uuid)
to authenticated;
