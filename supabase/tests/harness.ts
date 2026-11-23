import { PGlite, type Transaction } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const supabaseDir = join(import.meta.dirname, '..')

// The parts of a Supabase database that migrations rely on: the auth schema, auth.uid(),
// the client roles, the storage tables and the default privileges Supabase gives those roles
// on new objects.
const supabaseStub = `
  create schema auth;
  create schema extensions;
  create schema storage;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}',
    email_confirmed_at timestamptz,
    created_at timestamptz not null default now()
  );

  create table storage.buckets (
    id text primary key,
    name text not null unique,
    public boolean not null default false
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

export type Tx = Transaction

export async function createTestDatabase({ seed = false } = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { vector } })
  await db.exec(supabaseStub)

  const migrationsDir = join(supabaseDir, 'migrations')
  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const file of migrations) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }

  if (seed) {
    await db.exec(readFileSync(join(supabaseDir, 'seed.sql'), 'utf8'))
  }
  return db
}

export async function createUser(
  db: PGlite,
  email: string,
  { verified = true } = {},
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at)
     values ($1, case when $2::boolean then now() end) returning id`,
    [email, verified],
  )
  const id = result.rows[0]?.id
  if (!id) throw new Error(`could not create user ${email}`)
  return id
}

export async function asUser<T>(
  db: PGlite,
  userId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated')
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    return work(tx)
  })
}

// Runs as the service role, like an edge function with the service role key.
export async function asService<T>(db: PGlite, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role service_role')
    return work(tx)
  })
}

export async function asAnon<T>(db: PGlite, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role anon')
    return work(tx)
  })
}

export async function createAdultLearner(
  db: PGlite,
  email: string,
  options: { verified?: boolean } = {},
): Promise<string> {
  const id = await createUser(db, email, options)
  await asUser(db, id, (tx) => tx.query('select public.declare_age(true)'))
  return id
}

export async function createMinorLearner(db: PGlite, email: string): Promise<string> {
  const id = await createUser(db, email)
  await asUser(db, id, (tx) => tx.query('select public.declare_age(false)'))
  return id
}

export async function createParent(
  db: PGlite,
  email: string,
  options: { verified?: boolean } = {},
): Promise<string> {
  const id = await createAdultLearner(db, email, options)
  await asUser(db, id, (tx) => tx.query('select public.claim_parent_role()'))
  return id
}
