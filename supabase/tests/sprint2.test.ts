// @vitest-environment node
// Sprint 2 database rules: account state, onboarding, invites, family, consent, entitlements,
// My Library, payments and storage (docs/api-contract.md).
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CONSENT_POLICY_VERSION, contactHash } from '../functions/_shared/contact.ts'
import {
  asAnon,
  asService,
  asUser,
  createAdultLearner,
  createMinorLearner,
  createParent,
  createTestDatabase,
  createUser,
  type Tx,
} from './harness.ts'

let db: PGlite

beforeAll(async () => {
  db = await createTestDatabase({ seed: true })
  await db.exec(`
    insert into public.products (code, tier, price_cents, active) values
      ('ws12-r99', 'r99', 9900, true),
      ('ws12-r199', 'r199', 19900, true),
      ('ws12-r349', 'r349', 34900, true),
      ('ws12-retired', 'r99', 9900, false);
  `)
})

afterAll(async () => {
  await db.close()
})

let emailCounter = 0
function email(label: string): string {
  emailCounter += 1
  return `${label}.${emailCounter}@example.test`
}

function codePattern(code: string): RegExp {
  return new RegExp(`^${code}$`)
}

async function rows<T>(userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await asUser(db, userId, (tx) => tx.query<T>(sql, params))
  return result.rows
}

async function call(userId: string, sql: string, params: unknown[] = []): Promise<void> {
  await asUser(db, userId, (tx) => tx.query(sql, params))
}

function expectCode(work: Promise<unknown>, code: string) {
  return expect(work).rejects.toThrow(codePattern(code))
}

async function serverValue<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const result = await db.query<{ value: T }>(sql, params)
  return result.rows[0]?.value
}

async function accountState(userId: string) {
  const [state] = await rows<{
    is_adult: boolean | null
    consent_status: string
    roles: string[]
    onboarding_step: number
    onboarded: boolean
    language: string
  }>(userId, 'select * from public.my_account_state()')
  return state
}

async function requestConsent(learner: string, parentContact: string): Promise<string> {
  const hash = await contactHash(parentContact)
  const [row] = await rows<{ id: string }>(learner, 'select public.request_consent($1, $2) as id', [
    hash,
    CONSENT_POLICY_VERSION,
  ])
  await db.query(
    `insert into public.consent_contacts (consent_id, channel, contact_encrypted)
     values ($1, 'email', '\\x01')`,
    [row!.id],
  )
  return row!.id
}

async function giveConsent(parent: string, consentId: string): Promise<string> {
  const [row] = await rows<{ link_id: string }>(
    parent,
    'select public.give_consent($1) as link_id',
    [consentId],
  )
  return row!.link_id
}

async function consentRow(consentId: string) {
  const result = await db.query<{ status: string; contacts: number }>(
    `select c.status,
       (select count(*)::int from public.consent_contacts cc where cc.consent_id = c.id) as contacts
     from public.parental_consents c where c.id = $1`,
    [consentId],
  )
  return result.rows[0]
}

async function createInvite(userId: string, kind: string) {
  const [row] = await rows<{ code: string; expires_at: string }>(
    userId,
    'select * from public.create_invite($1)',
    [kind],
  )
  return row!
}

async function redeem(userId: string, code: string) {
  const [row] = await rows<{ link_id: string | null; error: string | null }>(
    userId,
    'select * from public.redeem_invite($1)',
    [code],
  )
  return row!
}

interface FamilyRow {
  link_id: string
  other_user_id: string
  other_first_name: string | null
  relation: string
  status: string
  waiting_on_me: boolean
  consent_id: string | null
}

function family(userId: string) {
  return rows<FamilyRow>(userId, 'select * from public.my_family()')
}

describe('storage for My Library', () => {
  it('defines a private library bucket', async () => {
    const buckets = await db.query('select id, public from storage.buckets')
    expect(buckets.rows).toEqual([{ id: 'library', public: false }])
  })

  it('has no storage policy, so clients cannot list or read library files', async () => {
    await db.query(
      "insert into storage.objects (bucket_id, name) values ('library', 'books/ws12-en.pdf')",
    )
    const policies = await db.query(
      "select policyname from pg_policies where schemaname = 'storage'",
    )
    expect(policies.rows).toEqual([])

    const learner = await createAdultLearner(db, email('storage'))
    const visible = await rows(learner, 'select * from storage.objects')
    expect(visible).toEqual([])
    const anonVisible = await asAnon(db, (tx) => tx.query('select * from storage.objects'))
    expect(anonVisible.rows).toEqual([])
  })
})

describe('Google name and picture are never kept before consent', () => {
  const googleMetadata = {
    full_name: 'Google Name',
    name: 'Google Name',
    avatar_url: 'https://example.test/avatar.png',
    picture: 'https://example.test/avatar.png',
    email: 'google.learner@example.test',
    language: 'af',
  }

  async function googleSignUp(address: string): Promise<string> {
    const result = await db.query<{ id: string }>(
      `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
       values ($1, now(), $2) returning id`,
      [address, JSON.stringify({ ...googleMetadata, email: address })],
    )
    return result.rows[0]!.id
  }

  async function metadata(userId: string) {
    return serverValue<Record<string, unknown>>(
      'select raw_user_meta_data as value from auth.users where id = $1',
      [userId],
    )
  }

  async function googleSignIn(userId: string) {
    await db.query('update auth.users set raw_user_meta_data = $2 where id = $1', [
      userId,
      JSON.stringify(googleMetadata),
    ])
  }

  it('creates the profile without copying name or picture into any app table', async () => {
    const userId = await googleSignUp(email('google'))
    const profile = await db.query(
      `select first_name, grade, school_id, province, school_name_other, language
       from public.profiles where id = $1`,
      [userId],
    )
    expect(profile.rows).toEqual([
      {
        first_name: null,
        grade: null,
        school_id: null,
        province: null,
        school_name_other: null,
        language: 'af',
      },
    ])

    const tables = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    )
    for (const { tablename } of tables.rows) {
      const found = await serverValue<number>(
        `select count(*)::int as value from public.${tablename} t
         where t::text ilike '%Google Name%' or t::text ilike '%avatar.png%'`,
      )
      expect(found, tablename).toBe(0)
    }
  })

  it('removes name and picture from auth metadata at sign-up and on every sign-in until consent', async () => {
    const userId = await googleSignUp(email('google.minor'))
    expect(await metadata(userId)).toEqual({
      email: expect.stringContaining('google.minor'),
      language: 'af',
    })

    await call(userId, 'select public.declare_age(false)')
    await googleSignIn(userId)
    expect(Object.keys((await metadata(userId)) ?? {}).sort()).toEqual(['email', 'language'])

    const parentEmail = email('google.parent')
    const parent = await createParent(db, parentEmail)
    await giveConsent(parent, await requestConsent(userId, parentEmail))
    await googleSignIn(userId)
    expect(await metadata(userId)).toMatchObject({ full_name: 'Google Name' })
  })

  it('keeps Google metadata for an adult once they have declared their age', async () => {
    const userId = await googleSignUp(email('google.adult'))
    await call(userId, 'select public.declare_age(true)')
    await googleSignIn(userId)
    expect(await metadata(userId)).toMatchObject({ full_name: 'Google Name' })
  })
})

describe('my_account_state()', () => {
  it('describes a new account', async () => {
    const userId = await createUser(db, email('state.new'))
    expect(await accountState(userId)).toEqual({
      is_adult: null,
      consent_status: 'none',
      roles: ['learner'],
      onboarding_step: 0,
      onboarded: false,
      language: 'en',
    })
  })

  it('follows the consent journey of a minor', async () => {
    const learner = await createMinorLearner(db, email('state.minor'))
    expect(await accountState(learner)).toMatchObject({ is_adult: false, consent_status: 'none' })

    const parentEmail = email('state.parent')
    const consentId = await requestConsent(learner, parentEmail)
    expect((await accountState(learner))?.consent_status).toBe('pending')

    const parent = await createParent(db, parentEmail)
    await giveConsent(parent, consentId)
    expect((await accountState(learner))?.consent_status).toBe('given')
    expect((await accountState(parent))?.roles).toEqual(['learner', 'parent'])

    await call(parent, 'select public.withdraw_consent($1)', [consentId])
    expect((await accountState(learner))?.consent_status).toBe('withdrawn')
  })

  it('treats a request older than 30 days as no request', async () => {
    const learner = await createMinorLearner(db, email('state.expired'))
    const consentId = await requestConsent(learner, email('state.expired.parent'))
    await db.query(
      "update public.parental_consents set requested_at = now() - interval '31 days' where id = $1",
      [consentId],
    )
    expect((await accountState(learner))?.consent_status).toBe('none')
  })

  it('reports not_needed for adults', async () => {
    const adult = await createAdultLearner(db, email('state.adult'))
    expect(await accountState(adult)).toMatchObject({
      is_adult: true,
      consent_status: 'not_needed',
    })
  })
})

describe('save_onboarding()', () => {
  let learner: string
  let schoolId: string

  const answers = (overrides: Record<string, unknown> = {}) => ({
    first_name: '  Lerato ',
    grade: 12,
    school_id: null,
    school_name_other: null,
    province: 'GP',
    subjects: [
      { code: 'MATH', target_mark: 70 },
      { code: 'LO', target_mark: null },
    ],
    exam_dates: [
      { kind: 'trial', date: '2027-08-23' },
      { kind: 'final', date: '2027-10-25' },
    ],
    study_days: ['wed', 'mon', 'fri'],
    study_bands: ['afternoon', 'evening'],
    goal: 'Pass Maths with 70 percent',
    career_interests: ['engineering'],
    ...overrides,
  })

  const withoutKey = (value: Record<string, unknown>, key: string) =>
    Object.fromEntries(Object.entries(value).filter(([name]) => name !== key))

  const save = (userId: string, value: unknown) =>
    call(userId, 'select public.save_onboarding($1::jsonb)', [JSON.stringify(value)])

  async function saved(userId: string) {
    const profile = await db.query(
      `select first_name, grade, school_id, school_name_other, province, onboarding_step,
         onboarded_at is not null as onboarded
       from public.profiles where id = $1`,
      [userId],
    )
    const subjects = await db.query(
      `select s.code, ls.target_mark from public.learner_subjects ls
       join public.subjects s on s.id = ls.subject_id where ls.learner_id = $1 order by s.code`,
      [userId],
    )
    const exams = await db.query(
      `select kind, to_char(starts_on, 'YYYY-MM-DD') as date from public.learner_exam_dates
       where learner_id = $1 order by kind`,
      [userId],
    )
    const preferences = await db.query(
      `select study_days, study_times, career_interests from public.learner_preferences
       where learner_id = $1`,
      [userId],
    )
    const goals = await db.query('select type, title from public.goals where learner_id = $1', [
      userId,
    ])
    return {
      profile: profile.rows,
      subjects: subjects.rows,
      exams: exams.rows,
      preferences: preferences.rows,
      goals: goals.rows,
    }
  }

  beforeAll(async () => {
    learner = await createAdultLearner(db, email('onboarding'))
    const result = await db.query<{ id: string }>(
      "insert into public.schools (name, province) values ('Fixture High', 'GP') returning id",
    )
    schoolId = result.rows[0]!.id
  })

  it('saves every step and marks the learner onboarded', async () => {
    await save(learner, answers())
    expect(await saved(learner)).toEqual({
      profile: [
        {
          first_name: 'Lerato',
          grade: 12,
          school_id: null,
          school_name_other: null,
          province: 'GP',
          onboarding_step: 5,
          onboarded: true,
        },
      ],
      subjects: [
        { code: 'LO', target_mark: null },
        { code: 'MATH', target_mark: 70 },
      ],
      exams: [
        { kind: 'final', date: '2027-10-25' },
        { kind: 'trial', date: '2027-08-23' },
      ],
      preferences: [
        {
          study_days: [1, 3, 5],
          study_times: ['afternoon', 'evening'],
          career_interests: ['engineering'],
        },
      ],
      goals: [{ type: 'academic', title: 'Pass Maths with 70 percent' }],
    })
    expect((await accountState(learner))?.onboarded).toBe(true)
  })

  it('replaces subjects and dates on a second save without adding a second goal', async () => {
    await save(
      learner,
      answers({
        school_id: schoolId,
        grade: 11,
        subjects: [{ code: 'PHSC', target_mark: 65 }],
        exam_dates: [{ kind: 'final', date: '2028-10-30' }],
        goal: 'Another goal',
        study_days: [],
        career_interests: [],
      }),
    )
    const result = await saved(learner)
    expect(result.profile[0]).toMatchObject({ grade: 11, school_id: schoolId })
    expect(result.subjects).toEqual([{ code: 'PHSC', target_mark: 65 }])
    expect(result.exams).toEqual([{ kind: 'final', date: '2028-10-30' }])
    expect(result.preferences[0]).toMatchObject({ study_days: [], career_interests: [] })
    expect(result.goals).toEqual([{ type: 'academic', title: 'Pass Maths with 70 percent' }])
  })

  it('needs consent and saves nothing for a minor who is waiting', async () => {
    const minor = await createMinorLearner(db, email('onboarding.minor'))
    await expectCode(save(minor, answers()), 'consent_required')
    expect(await saved(minor)).toMatchObject({
      profile: [{ first_name: null, onboarding_step: 0, onboarded: false }],
      subjects: [],
      exams: [],
      preferences: [],
      goals: [],
    })
  })

  const invalid: [string, unknown][] = [
    ['not an object', ['Lerato']],
    ['a missing field', withoutKey(answers(), 'goal')],
    ['an extra field', answers({ surname: 'Mokoena' })],
    ['a blank first name', answers({ first_name: '   ' })],
    ['a first name over 60 characters', answers({ first_name: 'A'.repeat(61) })],
    ['a control character in the name', answers({ first_name: 'Le\u0007rato' })],
    ['grade 10', answers({ grade: 10 })],
    ['grade as text', answers({ grade: '12' })],
    ['an unknown school', answers({ school_id: '00000000-0000-4000-8000-000000000000' })],
    ['a school id that is not a uuid', answers({ school_id: 'school-1' })],
    ['a province name instead of a code', answers({ province: 'Gauteng' })],
    ['an unknown subject', answers({ subjects: [{ code: 'XYZ', target_mark: 50 }] })],
    [
      'a duplicate subject',
      answers({
        subjects: [
          { code: 'MATH', target_mark: 50 },
          { code: 'MATH', target_mark: 60 },
        ],
      }),
    ],
    ['a target over 100', answers({ subjects: [{ code: 'MATH', target_mark: 101 }] })],
    ['a fractional target', answers({ subjects: [{ code: 'MATH', target_mark: 70.5 }] })],
    ['an extra subject field', answers({ subjects: [{ code: 'MATH', target_mark: 1, x: 1 }] })],
    ['an unknown exam kind', answers({ exam_dates: [{ kind: 'mock', date: '2027-08-23' }] })],
    ['an impossible date', answers({ exam_dates: [{ kind: 'trial', date: '2027-02-30' }] })],
    ['a date far in the future', answers({ exam_dates: [{ kind: 'trial', date: '2099-08-23' }] })],
    [
      'a trial after the final',
      answers({
        exam_dates: [
          { kind: 'trial', date: '2027-11-01' },
          { kind: 'final', date: '2027-10-25' },
        ],
      }),
    ],
    ['an unknown study day', answers({ study_days: ['monday'] })],
    ['a repeated study band', answers({ study_bands: ['evening', 'evening'] })],
    ['an unknown career chip', answers({ career_interests: ['astronaut'] })],
    ['free text as a career', answers({ career_interests: 'engineering' })],
    ['a goal over 200 characters', answers({ goal: 'G'.repeat(201) })],
    ['both a school and an unlisted school', answers({ school_name_other: 'Other High' })],
  ]

  it.each(invalid)('refuses %s and changes nothing', async (label, value) => {
    const before = await saved(learner)
    const withSchool =
      label === 'both a school and an unlisted school'
        ? { ...(value as Record<string, unknown>), school_id: schoolId }
        : value
    await expectCode(save(learner, withSchool), 'invalid_input')
    expect(await saved(learner)).toEqual(before)
  })
})

describe('invites and parent linking', () => {
  it('creates 8 character codes from an unambiguous alphabet, parent codes for parents only', async () => {
    const parent = await createParent(db, email('invite.parent'))
    const learner = await createAdultLearner(db, email('invite.learner'))
    const invite = await createInvite(parent, 'parent_to_learner')
    expect(invite.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
    expect(new Date(invite.expires_at).getTime() - Date.now()).toBeGreaterThan(6.9 * 86400_000)

    expect((await createInvite(learner, 'learner_to_parent')).code).toHaveLength(8)
    await expectCode(createInvite(learner, 'parent_to_learner'), 'not_allowed')
    await expectCode(createInvite(learner, 'teacher_to_class'), 'invalid_input')
  })

  it('does not let anyone read another person invite by code', async () => {
    const parent = await createParent(db, email('invite.hidden.parent'))
    const learner = await createAdultLearner(db, email('invite.hidden.learner'))
    const { code } = await createInvite(parent, 'parent_to_learner')
    expect(await rows(learner, 'select * from public.invites where code = $1', [code])).toEqual([])
    expect(await rows(parent, 'select code from public.invites where code = $1', [code])).toEqual([
      { code },
    ])
  })

  it('links a learner and a parent both ways once the other side accepts', async () => {
    const parent = await createParent(db, email('link.parent'))
    await call(parent, "update public.profiles set first_name = 'Nomsa' where id = $1", [parent])
    const learner = await createAdultLearner(db, email('link.learner'))
    await call(learner, "update public.profiles set first_name = 'Thabo' where id = $1", [learner])

    const { code } = await createInvite(parent, 'parent_to_learner')
    const result = await redeem(learner, ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `)
    expect(result.error).toBeNull()

    expect(await family(learner)).toEqual([
      {
        link_id: result.link_id,
        other_user_id: parent,
        other_first_name: 'Nomsa',
        relation: 'parent',
        status: 'pending',
        waiting_on_me: false,
        consent_id: null,
      },
    ])
    expect(await family(parent)).toEqual([
      expect.objectContaining({
        other_user_id: learner,
        other_first_name: 'Thabo',
        relation: 'child',
        waiting_on_me: true,
      }),
    ])

    await expectCode(call(learner, 'select public.accept_link($1)', [result.link_id]), 'not_found')
    await call(parent, 'select public.accept_link($1)', [result.link_id])
    expect((await family(learner))[0]?.status).toBe('active')

    const other = await createAdultLearner(db, email('link.other'))
    expect(await redeem(other, code)).toEqual({ link_id: null, error: 'invalid_code' })
  })

  it('links the other way when a parent redeems a learner code', async () => {
    const learner = await createAdultLearner(db, email('reverse.learner'))
    const parent = await createParent(db, email('reverse.parent'))
    const notParent = await createAdultLearner(db, email('reverse.notparent'))
    const { code } = await createInvite(learner, 'learner_to_parent')

    expect(await redeem(notParent, code)).toEqual({ link_id: null, error: 'not_allowed' })
    expect(await redeem(learner, code)).toEqual({ link_id: null, error: 'invalid_code' })

    const { link_id } = await redeem(parent, code)
    expect((await family(learner))[0]).toMatchObject({ relation: 'parent', waiting_on_me: true })
    await call(learner, 'select public.accept_link($1)', [link_id])
    expect((await family(parent))[0]?.status).toBe('active')

    const again = await createInvite(learner, 'learner_to_parent')
    expect(await redeem(parent, again.code)).toEqual({ link_id: null, error: 'already_linked' })
  })

  it('refuses an expired code', async () => {
    const parent = await createParent(db, email('expired.parent'))
    const learner = await createAdultLearner(db, email('expired.learner'))
    const { code } = await createInvite(parent, 'parent_to_learner')
    await db.query(
      "update public.invites set expires_at = now() - interval '1 minute' where code = $1",
      [code],
    )
    expect(await redeem(learner, code)).toEqual({ link_id: null, error: 'code_expired' })
  })

  it('rate limits after five wrong codes in 15 minutes, and keeps the record of each try', async () => {
    const parent = await createParent(db, email('limit.parent'))
    const learner = await createAdultLearner(db, email('limit.learner'))
    const { code } = await createInvite(parent, 'parent_to_learner')

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await redeem(learner, `WRONG${attempt}AA`)).toEqual({
        link_id: null,
        error: 'invalid_code',
      })
    }
    expect(
      await serverValue<number>(
        'select count(*)::int as value from public.invite_attempts where user_id = $1 and not succeeded',
        [learner],
      ),
    ).toBe(5)
    await expectCode(redeem(learner, code), 'rate_limited')

    await db.query(
      "update public.invite_attempts set attempted_at = now() - interval '16 minutes' where user_id = $1",
      [learner],
    )
    expect((await redeem(learner, code)).error).toBeNull()
  })

  it('opens a consent request when a minor redeems a parent code, answered by that parent', async () => {
    const parentEmail = email('minor.code.parent')
    const parent = await createParent(db, parentEmail)
    const minor = await createMinorLearner(db, email('minor.code.learner'))
    const { code } = await createInvite(parent, 'parent_to_learner')
    const { link_id } = await redeem(minor, code)

    await expectCode(call(parent, 'select public.accept_link($1)', [link_id]), 'consent_required')

    const [parentView] = await family(parent)
    expect(parentView).toMatchObject({
      relation: 'child',
      other_first_name: null,
      waiting_on_me: true,
    })
    expect(parentView?.consent_id).toBeTruthy()
    expect((await family(minor))[0]).toMatchObject({ waiting_on_me: false, consent_id: null })

    const hash = await serverValue<string>(
      'select contact_hash as value from public.parental_consents where id = $1',
      [parentView!.consent_id],
    )
    expect(hash).toBe(await contactHash(parentEmail))

    expect(await giveConsent(parent, parentView!.consent_id!)).toBe(link_id)
    expect((await family(minor))[0]?.status).toBe('active')
    expect((await accountState(minor))?.consent_status).toBe('given')
  })
})

describe('learner isolation in the new functions and tables', () => {
  it('shows each person only their own family links', async () => {
    const parentA = await createParent(db, email('iso.parent.a'))
    const learnerA = await createAdultLearner(db, email('iso.learner.a'))
    const learnerB = await createAdultLearner(db, email('iso.learner.b'))
    const parentB = await createParent(db, email('iso.parent.b'))
    await redeem(learnerA, (await createInvite(parentA, 'parent_to_learner')).code)
    await redeem(learnerB, (await createInvite(parentB, 'parent_to_learner')).code)

    const seenByA = (await family(learnerA)).map((row) => row.other_user_id)
    expect(seenByA).toEqual([parentA])
    const seenByB = (await family(learnerB)).map((row) => row.other_user_id)
    expect(seenByB).toEqual([parentB])
    expect(
      await rows(learnerA, 'select * from public.parent_links where learner_id = $1', [learnerB]),
    ).toEqual([])
  })

  it('gives clients no access to invite attempts', async () => {
    const learner = await createAdultLearner(db, email('iso.attempts'))
    await redeem(learner, 'NOTACODE')
    await expect(rows(learner, 'select * from public.invite_attempts')).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      asAnon(db, (tx: Tx) => tx.query('select * from public.invite_attempts')),
    ).rejects.toThrow(/permission denied/)
  })

  it('does not show one learner the library entitlements or purchases of another', async () => {
    const buyer = await createAdultLearner(db, email('iso.buyer'))
    const other = await createAdultLearner(db, email('iso.other'))
    await db.query(
      "insert into public.entitlements (user_id, email, tier) values ($1, 'x@example.test', 'r349')",
      [buyer],
    )
    expect(await rows(other, 'select * from public.entitlements')).toEqual([])
    expect(await rows(buyer, 'select tier from public.entitlements')).toEqual([{ tier: 'r349' }])
    const rankOf = (userId: string) =>
      serverValue<number>('select public.tier_rank_for($1)::int as value', [userId])
    expect(await rankOf(other)).toBe(0)
    expect(await rankOf(buyer)).toBe(3)
  })

  it('refuses every new signed-in function to signed-out visitors', async () => {
    const calls = [
      'select * from public.my_account_state()',
      "select public.save_onboarding('{}'::jsonb)",
      "select * from public.create_invite('learner_to_parent')",
      "select * from public.redeem_invite('ABCDEFGH')",
      'select * from public.my_family()',
      'select * from public.consent_request_for_parent(gen_random_uuid())',
      'select public.decline_consent(gen_random_uuid())',
      'select public.claim_entitlements()',
      'select * from public.my_library()',
      'select public.library_download_path(gen_random_uuid())',
      "select public.set_language('af')",
      `select public.update_profile('{"first_name": "Thabo"}'::jsonb)`,
    ]
    for (const sql of calls) {
      await expect(
        asAnon(db, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('refuses server-only functions to signed-in clients', async () => {
    const learner = await createAdultLearner(db, email('iso.server'))
    const calls = [
      "select public.record_payment('stripe', 'evt', repeat('a', 64), 'pi', 'paid', 'ws12-r99', 'a@b.c', 9900)",
      "select public.store_consent_contact(gen_random_uuid(), 'email', '\\x01')",
      'select public.run_housekeeping()',
      'select public.has_consent_for(gen_random_uuid())',
      'select public.tier_rank_for(gen_random_uuid())',
      `select public.profile_first_name('"Thabo"'::jsonb)`,
      "select public.profile_grade('12'::jsonb)",
      'select public.profile_school_id(null::jsonb)',
      `select public.profile_province('"GP"'::jsonb)`,
      "select * from public.profile_subjects('[]'::jsonb)",
      "select * from public.profile_exam_dates('[]'::jsonb)",
      "select public.replace_learner_subjects(gen_random_uuid(), '{}', '{}')",
      "select public.replace_learner_exam_dates(gen_random_uuid(), '{}', '{}')",
    ]
    for (const sql of calls) {
      await expect(rows(learner, sql), sql).rejects.toThrow(/permission denied/)
    }
  })
})

describe('consent is bound to the invited contact and expires after 30 days', () => {
  it('refuses a parent whose verified email is not the one the learner entered', async () => {
    const learner = await createMinorLearner(db, email('bound.learner'))
    const consentId = await requestConsent(learner, email('bound.real.parent'))
    const stranger = await createParent(db, email('bound.stranger'))

    await expectCode(giveConsent(stranger, consentId), 'contact_mismatch')
    await expectCode(
      rows(stranger, 'select * from public.consent_request_for_parent($1)', [consentId]),
      'contact_mismatch',
    )
    await expectCode(
      call(stranger, 'select public.decline_consent($1)', [consentId]),
      'contact_mismatch',
    )
    expect(await consentRow(consentId)).toEqual({ status: 'pending', contacts: 1 })
  })

  it('refuses a matching parent whose email is not verified', async () => {
    const parentEmail = email('bound.unverified')
    const learner = await createMinorLearner(db, email('bound.unverified.learner'))
    const consentId = await requestConsent(learner, parentEmail)
    const parent = await createParent(db, parentEmail, { verified: false })
    await expectCode(giveConsent(parent, consentId), 'email_not_verified')
    expect((await consentRow(consentId))?.status).toBe('pending')
  })

  it('matches the contact without regard to case or surrounding spaces', async () => {
    const parentEmail = email('bound.case')
    const learner = await createMinorLearner(db, email('bound.case.learner'))
    const consentId = await requestConsent(learner, `  ${parentEmail.toUpperCase()}\n`)
    const parent = await createParent(db, parentEmail)

    const [page] = await rows(parent, 'select * from public.consent_request_for_parent($1)', [
      consentId,
    ])
    expect(page).toMatchObject({ learner_first_name: null, status: 'pending' })
    await giveConsent(parent, consentId)
    expect(await consentRow(consentId)).toEqual({ status: 'given', contacts: 0 })
  })

  it('refuses consent after 30 days and deletes the stored contact', async () => {
    const parentEmail = email('expiry.parent')
    const learner = await createMinorLearner(db, email('expiry.learner'))
    const consentId = await requestConsent(learner, parentEmail)
    const parent = await createParent(db, parentEmail)
    await db.query(
      "update public.parental_consents set requested_at = now() - interval '31 days' where id = $1",
      [consentId],
    )

    await expectCode(giveConsent(parent, consentId), 'consent_expired')
    const [page] = await rows<{ status: string }>(
      parent,
      'select * from public.consent_request_for_parent($1)',
      [consentId],
    )
    expect(page?.status).toBe('expired')
    expect(await consentRow(consentId)).toEqual({ status: 'expired', contacts: 0 })
    await expectCode(giveConsent(parent, consentId), 'consent_expired')
  })

  it('lets the invited parent decline, which closes the request and deletes the contact', async () => {
    const parentEmail = email('decline.parent')
    const learner = await createMinorLearner(db, email('decline.learner'))
    const consentId = await requestConsent(learner, parentEmail)
    const parent = await createAdultLearner(db, parentEmail)

    await call(parent, 'select public.decline_consent($1)', [consentId])
    expect(await consentRow(consentId)).toEqual({ status: 'declined', contacts: 0 })
    expect((await accountState(learner))?.consent_status).toBe('none')

    await call(parent, 'select public.claim_parent_role()')
    await expectCode(giveConsent(parent, consentId), 'not_allowed')
  })

  it('does not show the parent consent page to a minor', async () => {
    const learner = await createMinorLearner(db, email('page.learner'))
    const consentId = await requestConsent(learner, email('page.parent'))
    const otherMinor = await createMinorLearner(db, email('page.minor'))
    await expectCode(
      rows(otherMinor, 'select * from public.consent_request_for_parent($1)', [consentId]),
      'not_allowed',
    )
  })

  it('validates consent requests', async () => {
    const learner = await createMinorLearner(db, email('validate.learner'))
    const adult = await createAdultLearner(db, email('validate.adult'))
    const hash = await contactHash('someone@example.test')
    const request = (userId: string, contactHashValue: string, version: string) =>
      rows(userId, 'select public.request_consent($1, $2)', [contactHashValue, version])

    await expectCode(request(learner, 'not-a-hash', CONSENT_POLICY_VERSION), 'invalid_input')
    await expectCode(request(learner, hash, 'v0'), 'invalid_input')
    await expectCode(request(adult, hash, CONSENT_POLICY_VERSION), 'not_allowed')

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(learner, hash, CONSENT_POLICY_VERSION)
    }
    await expectCode(request(learner, hash, CONSENT_POLICY_VERSION), 'rate_limited')
  })

  it('closes expired requests and old invite attempts in daily housekeeping', async () => {
    const learner = await createMinorLearner(db, email('housekeeping.learner'))
    const fresh = await requestConsent(learner, email('housekeeping.fresh'))
    const old = await requestConsent(learner, email('housekeeping.old'))
    await db.query(
      "update public.parental_consents set requested_at = now() - interval '30 days 1 minute' where id = $1",
      [old],
    )
    await db.query(
      "insert into public.invite_attempts (user_id, succeeded, attempted_at) values ($1, false, now() - interval '2 days')",
      [learner],
    )

    await asService(db, (tx) => tx.query('select public.run_housekeeping()'))
    expect(await consentRow(old)).toEqual({ status: 'expired', contacts: 0 })
    expect(await consentRow(fresh)).toEqual({ status: 'pending', contacts: 1 })
    expect(
      await serverValue<number>(
        'select count(*)::int as value from public.invite_attempts where user_id = $1',
        [learner],
      ),
    ).toBe(0)
  })
})

describe('withdraw_consent()', () => {
  it('removes the link that consent created and stops processing the learner data', async () => {
    const parentEmail = email('withdraw.parent')
    const learner = await createMinorLearner(db, email('withdraw.learner'))
    const parent = await createParent(db, parentEmail)
    const consentId = await requestConsent(learner, parentEmail)
    const linkId = await giveConsent(parent, consentId)
    await call(
      learner,
      "insert into public.goals (learner_id, type, title) values ($1, 'study', 'Read')",
      [learner],
    )

    const stranger = await createParent(db, email('withdraw.stranger'))
    await expectCode(call(stranger, 'select public.withdraw_consent($1)', [consentId]), 'not_found')

    await call(parent, 'select public.withdraw_consent($1)', [consentId])

    expect(
      await serverValue<string>('select status as value from public.parent_links where id = $1', [
        linkId,
      ]),
    ).toBe('removed')
    expect(await family(learner)).toEqual([])
    expect(await family(parent)).toEqual([])
    expect((await accountState(learner))?.consent_status).toBe('withdrawn')
    expect(
      (await rows<{ value: boolean }>(learner, 'select public.has_consent() as value'))[0],
    ).toEqual({
      value: false,
    })
    await expect(
      call(
        learner,
        "insert into public.goals (learner_id, type, title) values ($1, 'study', 'More')",
        [learner],
      ),
    ).rejects.toThrow(/row-level security/)
    await expectCode(
      call(learner, "update public.profiles set first_name = 'Lebo' where id = $1", [learner]),
      'consent_required',
    )
  })
})

describe('remove_link() on a link that consent created', () => {
  const onboardingAnswers = {
    first_name: 'Lebo',
    grade: 12,
    school_id: null,
    school_name_other: null,
    province: 'GP',
    subjects: [],
    exam_dates: [],
    study_days: [],
    study_bands: [],
    goal: null,
    career_interests: [],
  }

  async function consentedPair(label: string) {
    const parentEmail = email(`${label}.parent`)
    const learner = await createMinorLearner(db, email(`${label}.learner`))
    const parent = await createParent(db, parentEmail)
    const consentId = await requestConsent(learner, parentEmail)
    const linkId = await giveConsent(parent, consentId)
    return { learner, parent, consentId, linkId }
  }

  it('gives the parent the consent id of an active consent link, and not the learner', async () => {
    const { learner, parent, consentId, linkId } = await consentedPair('family.consent')
    expect(await family(parent)).toEqual([
      expect.objectContaining({ link_id: linkId, status: 'active', consent_id: consentId }),
    ])
    expect(await family(learner)).toEqual([
      expect.objectContaining({ link_id: linkId, status: 'active', consent_id: null }),
    ])
  })

  it('withdraws the consent when the parent removes the link, so processing stops', async () => {
    const { learner, parent, consentId, linkId } = await consentedPair('remove.withdraws')
    expect((await accountState(learner))?.consent_status).toBe('given')

    await call(parent, 'select public.remove_link($1)', [linkId])

    expect(await consentRow(consentId)).toEqual({ status: 'withdrawn', contacts: 0 })
    expect(
      await serverValue<boolean>(
        'select withdrawn_at is not null as value from public.parental_consents where id = $1',
        [consentId],
      ),
    ).toBe(true)
    expect((await accountState(learner))?.consent_status).toBe('withdrawn')
    expect(await family(parent)).toEqual([])
    expect(await family(learner)).toEqual([])
    await expectCode(
      call(learner, 'select public.save_onboarding($1::jsonb)', [
        JSON.stringify(onboardingAnswers),
      ]),
      'consent_required',
    )
    await expectCode(
      call(learner, "update public.profiles set first_name = 'Lebo' where id = $1", [learner]),
      'consent_required',
    )
    await expectCode(call(parent, 'select public.withdraw_consent($1)', [consentId]), 'not_found')
    expect(
      await serverValue<number>(
        `select count(*)::int as value from public.audit_log
         where action = 'withdraw_consent' and target = $1`,
        [consentId],
      ),
    ).toBe(1)
  })

  it('lets the parent withdraw consent separately with the consent id from my_family', async () => {
    const { learner, parent, linkId } = await consentedPair('family.withdraw')
    const [row] = await family(parent)
    await call(parent, 'select public.withdraw_consent($1)', [row!.consent_id])

    expect((await accountState(learner))?.consent_status).toBe('withdrawn')
    expect(
      await serverValue<string>('select status as value from public.parent_links where id = $1', [
        linkId,
      ]),
    ).toBe('removed')
  })

  it('lets only the consenting parent call withdraw_consent', async () => {
    const { learner, consentId } = await consentedPair('withdraw.who')
    const otherParent = await createParent(db, email('withdraw.who.other'))
    await expectCode(call(learner, 'select public.withdraw_consent($1)', [consentId]), 'not_found')
    await expectCode(
      call(otherParent, 'select public.withdraw_consent($1)', [consentId]),
      'not_found',
    )
    await expect(
      asAnon(db, (tx) => tx.query('select public.withdraw_consent($1)', [consentId])),
    ).rejects.toThrow(/permission denied/)
    expect((await consentRow(consentId))?.status).toBe('given')
  })

  it('keeps the consent of a second parent who did not remove their link', async () => {
    const { learner, parent, consentId, linkId } = await consentedPair('two.parents')
    const secondEmail = email('two.parents.second')
    const second = await createParent(db, secondEmail)
    const secondConsent = await requestConsent(learner, secondEmail)
    await giveConsent(second, secondConsent)

    await call(parent, 'select public.remove_link($1)', [linkId])

    expect((await consentRow(consentId))?.status).toBe('withdrawn')
    expect((await consentRow(secondConsent))?.status).toBe('given')
    expect((await accountState(learner))?.consent_status).toBe('given')
  })

  it('leaves the consent in place when the learner removes the link', async () => {
    const { learner, consentId, linkId } = await consentedPair('learner.removes')
    await call(learner, 'select public.remove_link($1)', [linkId])
    expect((await consentRow(consentId))?.status).toBe('given')
    expect((await accountState(learner))?.consent_status).toBe('given')
  })

  it('keeps the removed link in Family for the consenting parent, so they can still withdraw', async () => {
    const { learner, parent, consentId, linkId } = await consentedPair('learner.removes.withdraw')
    const otherParent = await createParent(db, email('learner.removes.withdraw.other'))
    await call(learner, 'select public.remove_link($1)', [linkId])

    expect(await family(parent)).toEqual([
      expect.objectContaining({
        link_id: linkId,
        relation: 'child',
        status: 'removed',
        waiting_on_me: false,
        consent_id: consentId,
      }),
    ])
    expect(await family(learner)).toEqual([])
    expect(await family(otherParent)).toEqual([])
    await expectCode(call(parent, 'select public.remove_link($1)', [linkId]), 'not_found')

    await call(parent, 'select public.withdraw_consent($1)', [consentId])

    expect((await consentRow(consentId))?.status).toBe('withdrawn')
    expect((await accountState(learner))?.consent_status).toBe('withdrawn')
    expect(await family(parent)).toEqual([])
    expect(await family(learner)).toEqual([])
  })

  it('does not show a removed link to a second parent whose own consent is still given', async () => {
    const { learner, parent, linkId } = await consentedPair('removed.second.parent')
    const secondEmail = email('removed.second.parent.second')
    const second = await createParent(db, secondEmail)
    const secondLink = await giveConsent(second, await requestConsent(learner, secondEmail))

    await call(learner, 'select public.remove_link($1)', [linkId])

    expect(await family(parent)).toEqual([
      expect.objectContaining({ link_id: linkId, status: 'removed' }),
    ])
    expect(await family(second)).toEqual([
      expect.objectContaining({ link_id: secondLink, status: 'active' }),
    ])
  })

  it('closes a consent request waiting on a removed link, so it cannot relink', async () => {
    const parent = await createParent(db, email('pending.removed.parent'))
    const minor = await createMinorLearner(db, email('pending.removed.learner'))
    const { link_id } = await redeem(minor, (await createInvite(parent, 'parent_to_learner')).code)
    const [row] = await family(parent)
    const consentId = row!.consent_id!

    await call(minor, 'select public.remove_link($1)', [link_id])

    expect(await consentRow(consentId)).toEqual({ status: 'declined', contacts: 0 })
    await expectCode(giveConsent(parent, consentId), 'not_allowed')
    expect(
      await serverValue<string>('select status as value from public.parent_links where id = $1', [
        link_id,
      ]),
    ).toBe('removed')
    expect((await accountState(minor))?.consent_status).toBe('none')
  })

  it('refuses a person who is not on the link', async () => {
    const { consentId, linkId } = await consentedPair('remove.stranger')
    const stranger = await createParent(db, email('remove.stranger.other'))
    await expectCode(call(stranger, 'select public.remove_link($1)', [linkId]), 'not_found')
    expect((await consentRow(consentId))?.status).toBe('given')
  })
})

describe('the app language', () => {
  async function signUpWith(metadata: unknown): Promise<string> {
    const result = await db.query<{ id: string }>(
      `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
       values ($1, now(), $2) returning id`,
      [email('language'), JSON.stringify(metadata)],
    )
    return result.rows[0]!.id
  }

  async function languageOf(userId: string) {
    return serverValue<string>('select language as value from public.profiles where id = $1', [
      userId,
    ])
  }

  it.each([
    ['en', { language: 'en' }, 'en'],
    ['af', { language: 'af' }, 'af'],
  ])('stores %s from sign-up metadata', async (_label, metadata, expected) => {
    expect(await languageOf(await signUpWith(metadata))).toBe(expected)
  })

  it.each([
    ['no language', {}],
    ['an unknown language', { language: 'fr' }],
    ['a code in capitals', { language: 'AF' }],
    ['a code with spaces', { language: ' af' }],
    ['a number', { language: 7 }],
    ['an array', { language: ['af'] }],
    ['JSON null', { language: null }],
  ])('stores en for %s', async (_label, metadata) => {
    expect(await languageOf(await signUpWith(metadata))).toBe('en')
  })

  it('lets a minor save the language before consent', async () => {
    const minor = await createMinorLearner(db, email('language.minor'))
    expect((await accountState(minor))?.consent_status).toBe('none')

    await call(minor, 'select public.set_language($1)', ['af'])
    expect((await accountState(minor))?.language).toBe('af')
    await call(minor, 'select public.set_language($1)', ['en'])
    expect((await accountState(minor))?.language).toBe('en')
  })

  it.each([['fr'], ['AF'], [' af'], [''], [null]])(
    'refuses %j and keeps the saved language',
    async (value) => {
      const learner = await createUser(db, email('language.invalid'))
      await call(learner, 'select public.set_language($1)', ['af'])
      await expectCode(call(learner, 'select public.set_language($1)', [value]), 'invalid_input')
      expect(await languageOf(learner)).toBe('af')
    },
  )

  it("changes only the caller's own language", async () => {
    const first = await createUser(db, email('language.first'))
    const second = await createUser(db, email('language.second'))
    await call(first, 'select public.set_language($1)', ['af'])
    expect(await languageOf(first)).toBe('af')
    expect(await languageOf(second)).toBe('en')
  })
})

describe('update_profile()', () => {
  let learner: string
  let schoolId: string

  const update = (userId: string, value: unknown) =>
    call(userId, 'select public.update_profile($1::jsonb)', [JSON.stringify(value)])

  async function snapshot(userId: string) {
    const profile = await db.query<Record<string, unknown>>(
      `select first_name, grade, school_id, school_name_other, province, language,
         onboarding_step
       from public.profiles where id = $1`,
      [userId],
    )
    const subjects = await db.query(
      `select s.code, ls.target_mark from public.learner_subjects ls
       join public.subjects s on s.id = ls.subject_id where ls.learner_id = $1 order by s.code`,
      [userId],
    )
    const exams = await db.query(
      `select kind, to_char(starts_on, 'YYYY-MM-DD') as date from public.learner_exam_dates
       where learner_id = $1 order by kind`,
      [userId],
    )
    return { profile: profile.rows[0], subjects: subjects.rows, exams: exams.rows }
  }

  beforeAll(async () => {
    learner = await createAdultLearner(db, email('update.profile'))
    const result = await db.query<{ id: string }>(
      "insert into public.schools (name, province) values ('Update High', 'WC') returning id",
    )
    schoolId = result.rows[0]!.id
    await update(learner, {
      first_name: 'Lerato',
      grade: 12,
      province: 'GP',
      school_name_other: 'Hillside High',
      subjects: [{ code: 'MATH', target_mark: 70 }],
      exam_dates: [
        { kind: 'trial', date: '2027-08-23' },
        { kind: 'final', date: '2027-10-25' },
      ],
    })
  })

  it('saves every field it covers', async () => {
    expect(await snapshot(learner)).toEqual({
      profile: {
        first_name: 'Lerato',
        grade: 12,
        school_id: null,
        school_name_other: 'Hillside High',
        province: 'GP',
        language: 'en',
        onboarding_step: 0,
      },
      subjects: [{ code: 'MATH', target_mark: 70 }],
      exams: [
        { kind: 'final', date: '2027-10-25' },
        { kind: 'trial', date: '2027-08-23' },
      ],
    })
  })

  it('changes only the keys that are sent', async () => {
    const before = await snapshot(learner)
    await update(learner, { first_name: ' Lebo ' })
    expect(await snapshot(learner)).toEqual({
      ...before,
      profile: { ...before.profile, first_name: 'Lebo' },
    })
    await update(learner, { first_name: 'Lerato' })
  })

  it('treats the school as one choice: a listed school clears the unlisted name', async () => {
    await update(learner, { school_id: schoolId })
    expect((await snapshot(learner)).profile).toMatchObject({
      school_id: schoolId,
      school_name_other: null,
    })
    await update(learner, { school_name_other: 'Hillside High' })
    expect((await snapshot(learner)).profile).toMatchObject({
      school_id: null,
      school_name_other: 'Hillside High',
    })
  })

  it('replaces the whole subject and exam date lists', async () => {
    await update(learner, {
      subjects: [
        { code: 'PHSC', target_mark: 65 },
        { code: 'LO', target_mark: null },
      ],
      exam_dates: [{ kind: 'final', date: '2027-10-25' }],
    })
    const result = await snapshot(learner)
    expect(result.subjects).toEqual([
      { code: 'LO', target_mark: null },
      { code: 'PHSC', target_mark: 65 },
    ])
    expect(result.exams).toEqual([{ kind: 'final', date: '2027-10-25' }])
  })

  it('needs consent and changes nothing for a minor who is waiting', async () => {
    const minor = await createMinorLearner(db, email('update.minor'))
    const before = await snapshot(minor)
    await expectCode(update(minor, { first_name: 'Lebo' }), 'consent_required')
    expect(await snapshot(minor)).toEqual(before)
  })

  it("changes only the caller's own profile", async () => {
    const other = await createAdultLearner(db, email('update.other'))
    const before = await snapshot(learner)
    await update(other, { first_name: 'Sipho', province: 'KZN' })
    expect(await snapshot(learner)).toEqual(before)
    expect((await snapshot(other)).profile).toMatchObject({ first_name: 'Sipho', province: 'KZN' })
  })

  const invalid: [string, unknown][] = [
    ['not an object', ['Lerato']],
    ['an empty object', {}],
    ['an unknown key', { surname: 'Mokoena' }],
    ['a key that only onboarding saves', { study_days: ['mon'] }],
    ['the language', { language: 'af' }],
    ['a blank first name', { first_name: '   ' }],
    ['a null first name', { first_name: null }],
    ['a first name over 60 characters', { first_name: 'A'.repeat(61) }],
    ['a control character in the name', { first_name: 'Le\u0007rato' }],
    ['grade 10', { grade: 10 }],
    ['grade as text', { grade: '12' }],
    ['a null grade', { grade: null }],
    ['an unknown school', { school_id: '00000000-0000-4000-8000-000000000000' }],
    ['a school id that is not a uuid', { school_id: 'school-1' }],
    ['both a school and an unlisted school', { school_name_other: 'Other High' }],
    ['an unlisted school over 120 characters', { school_name_other: 'S'.repeat(121) }],
    ['a province name instead of a code', { province: 'Gauteng' }],
    ['a province in lower case', { province: 'gp' }],
    ['a null province', { province: null }],
    ['subjects that are not a list', { subjects: 'MATH' }],
    ['an unknown subject', { subjects: [{ code: 'XYZ', target_mark: 50 }] }],
    [
      'a duplicate subject',
      {
        subjects: [
          { code: 'MATH', target_mark: 50 },
          { code: 'MATH', target_mark: 60 },
        ],
      },
    ],
    ['a target over 100', { subjects: [{ code: 'MATH', target_mark: 101 }] }],
    ['a fractional target', { subjects: [{ code: 'MATH', target_mark: 70.5 }] }],
    ['an unknown exam kind', { exam_dates: [{ kind: 'mock', date: '2027-08-23' }] }],
    ['an impossible date', { exam_dates: [{ kind: 'trial', date: '2027-02-30' }] }],
    [
      'a trial after the final',
      {
        exam_dates: [
          { kind: 'trial', date: '2027-11-01' },
          { kind: 'final', date: '2027-10-25' },
        ],
      },
    ],
    [
      'a trial on the same day as the final',
      {
        exam_dates: [
          { kind: 'trial', date: '2027-10-25' },
          { kind: 'final', date: '2027-10-25' },
        ],
      },
    ],
    ['a valid name with a wrong subject', { first_name: 'Zola', subjects: [{ code: 'XYZ' }] }],
    ['a valid name with a wrong province', { first_name: 'Zola', province: 'XX' }],
  ]

  it.each(invalid)('refuses %s and changes nothing', async (label, value) => {
    const before = await snapshot(learner)
    const withSchool =
      label === 'both a school and an unlisted school'
        ? { ...(value as Record<string, unknown>), school_id: schoolId }
        : value
    await expectCode(update(learner, withSchool), 'invalid_input')
    expect(await snapshot(learner)).toEqual(before)
  })
})

describe('profiles.province', () => {
  it('accepts the nine province codes and refuses anything else, even from the server', async () => {
    const learner = await createAdultLearner(db, email('province.check'))
    for (const code of ['EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC']) {
      await call(learner, 'update public.profiles set province = $2 where id = $1', [learner, code])
    }
    await expect(
      call(learner, "update public.profiles set province = 'Gauteng' where id = $1", [learner]),
    ).rejects.toThrow(/profiles_province_check/)
    await expect(
      db.query("update public.profiles set province = 'gp' where id = $1", [learner]),
    ).rejects.toThrow(/profiles_province_check/)
    await call(learner, 'update public.profiles set province = null where id = $1', [learner])
  })
})

async function recordPayment(
  overrides: Partial<{
    provider: string
    eventId: string
    providerRef: string
    outcome: string
    productCode: string | null
    buyerEmail: string | null
    amountCents: number | null
  }> = {},
): Promise<string> {
  const values = {
    provider: 'stripe',
    eventId: `evt_${Math.random().toString(36).slice(2)}`,
    providerRef: `pi_${Math.random().toString(36).slice(2)}`,
    outcome: 'paid',
    productCode: 'ws12-r99',
    buyerEmail: 'buyer@example.test',
    amountCents: 9900,
    ...overrides,
  }
  const result = await asService(db, (tx) =>
    tx.query<{ result: string }>(
      'select public.record_payment($1, $2, $3, $4, $5, $6, $7, $8) as result',
      [
        values.provider,
        values.eventId,
        'a'.repeat(64),
        values.providerRef,
        values.outcome,
        values.productCode,
        values.buyerEmail,
        values.amountCents,
      ],
    ),
  )
  return result.rows[0]!.result
}

describe('record_payment()', () => {
  async function purchaseState(providerRef: string) {
    const result = await db.query(
      `select p.status, p.amount_cents, p.buyer_user_id, e.tier, e.status as entitlement,
         e.user_id
       from public.purchases p
       left join public.entitlements e on e.source_purchase_id = p.id
       where p.provider_ref = $1`,
      [providerRef],
    )
    return result.rows
  }

  it('records a paid purchase once and ignores the same event again', async () => {
    const buyerEmail = email('pay.once')
    const event = { eventId: 'evt_once', providerRef: 'pi_once', buyerEmail }
    expect(await recordPayment(event)).toBe('recorded')
    expect(await recordPayment(event)).toBe('duplicate')
    expect(await purchaseState('pi_once')).toEqual([
      {
        status: 'paid',
        amount_cents: 9900,
        buyer_user_id: null,
        tier: 'r99',
        entitlement: 'active',
        user_id: null,
      },
    ])
    expect(
      await serverValue<number>(
        "select count(*)::int as value from public.payment_events where event_id = 'evt_once'",
      ),
    ).toBe(1)
  })

  it('refuses an amount that is not the product price, and unknown or inactive products', async () => {
    expect(await recordPayment({ providerRef: 'pi_short', amountCents: 100 })).toBe(
      'amount_mismatch',
    )
    expect(await recordPayment({ providerRef: 'pi_short', amountCents: 34900 })).toBe(
      'amount_mismatch',
    )
    expect(await recordPayment({ providerRef: 'pi_unknown', productCode: 'nope' })).toBe(
      'unknown_product',
    )
    expect(await recordPayment({ providerRef: 'pi_retired', productCode: 'ws12-retired' })).toBe(
      'unknown_product',
    )
    expect(await recordPayment({ providerRef: 'pi_noemail', buyerEmail: 'not an email' })).toBe(
      'invalid_input',
    )
    expect(await recordPayment({ provider: 'paypal' })).toBe('invalid_input')
    for (const ref of ['pi_short', 'pi_unknown', 'pi_retired', 'pi_noemail']) {
      expect(await purchaseState(ref), ref).toEqual([])
    }
  })

  it('gives a verified existing account the entitlement straight away', async () => {
    const buyerEmail = email('pay.existing')
    const buyer = await createAdultLearner(db, buyerEmail)
    expect(
      await recordPayment({ providerRef: 'pi_existing', buyerEmail: buyerEmail.toUpperCase() }),
    ).toBe('recorded')
    expect(await purchaseState('pi_existing')).toEqual([
      expect.objectContaining({ buyer_user_id: buyer, user_id: buyer, entitlement: 'active' }),
    ])
  })

  it('sets the entitlement inactive on a refund or a failure', async () => {
    await recordPayment({ providerRef: 'pi_refund', productCode: 'ws12-r349', amountCents: 34900 })
    expect(
      await recordPayment({ providerRef: 'pi_refund', outcome: 'refunded', productCode: null }),
    ).toBe('recorded')
    expect(await purchaseState('pi_refund')).toEqual([
      expect.objectContaining({ status: 'refunded', entitlement: 'inactive' }),
    ])
    expect(await recordPayment({ providerRef: 'pi_refund', eventId: 'evt_late_paid' })).toBe(
      'ignored',
    )
    expect((await purchaseState('pi_refund'))[0]).toMatchObject({ status: 'refunded' })

    await recordPayment({ provider: 'payfast', providerRef: 'm_failed' })
    expect(
      await recordPayment({ provider: 'payfast', providerRef: 'm_failed', outcome: 'failed' }),
    ).toBe('recorded')
    expect((await purchaseState('m_failed'))[0]).toMatchObject({ entitlement: 'inactive' })

    expect(await recordPayment({ providerRef: 'pi_never', outcome: 'refunded' })).toBe(
      'unknown_purchase',
    )
  })
})

describe('claim_entitlements()', () => {
  it('claims a purchase made before the account existed, only once the email is verified', async () => {
    const buyerEmail = email('claim.buyer')
    await recordPayment({ providerRef: 'pi_claim', buyerEmail: buyerEmail.toUpperCase() })

    const buyer = await createAdultLearner(db, buyerEmail, { verified: false })
    await expectCode(rows(buyer, 'select public.claim_entitlements()'), 'email_not_verified')
    expect(await rows(buyer, 'select * from public.entitlements')).toEqual([])

    await db.query('update auth.users set email_confirmed_at = now() where id = $1', [buyer])
    const [claimed] = await rows<{ count: number }>(
      buyer,
      'select public.claim_entitlements() as count',
    )
    expect(claimed?.count).toBe(1)
    expect(await rows(buyer, 'select tier, status from public.entitlements')).toEqual([
      { tier: 'r99', status: 'active' },
    ])
    expect(await rows(buyer, 'select provider_ref from public.purchases')).toEqual([
      { provider_ref: 'pi_claim' },
    ])
    const [again] = await rows<{ count: number }>(
      buyer,
      'select public.claim_entitlements() as count',
    )
    expect(again?.count).toBe(0)
  })

  it("never claims another person's purchase", async () => {
    await recordPayment({ providerRef: 'pi_someone', buyerEmail: email('claim.someone') })
    const other = await createAdultLearner(db, email('claim.other'))
    const [claimed] = await rows<{ count: number }>(
      other,
      'select public.claim_entitlements() as count',
    )
    expect(claimed?.count).toBe(0)
    expect(
      await serverValue<string | null>(
        "select e.user_id as value from public.entitlements e join public.purchases p on p.id = e.source_purchase_id where p.provider_ref = 'pi_someone'",
      ),
    ).toBeNull()
  })
})

describe('my_library() and downloads by tier', () => {
  const files: Record<string, string> = {}

  async function library(userId: string) {
    return rows<{ title_en: string; unlocked: boolean; min_tier: string; kind: string }>(
      userId,
      'select title_en, kind, min_tier, unlocked from public.my_library()',
    )
  }

  async function unlockedTitles(userId: string) {
    return (await library(userId))
      .filter((row) => row.unlocked)
      .map((row) => row.title_en)
      .sort()
  }

  async function grant(userId: string, tier: string, status = 'active') {
    await db.query(
      `insert into public.entitlements (user_id, email, tier, status) values ($1, 'grant@example.test', $2, $3)`,
      [userId, tier, status],
    )
  }

  beforeAll(async () => {
    const definitions: [string, string, string, string][] = [
      ['Free planner', 'planner', 'free', 'en'],
      ['Book EN', 'book', 'r99', 'en'],
      ['Bonus pack', 'bonus', 'r199', 'en'],
      ['Boek AF', 'book', 'r349', 'af'],
    ]
    for (const [title, kind, tier, language] of definitions) {
      const result = await db.query<{ id: string }>(
        `insert into public.library_files (title_en, language, storage_path, min_tier, kind, size_bytes)
         values ($1, $4, 'files/' || $1, $3, $2, 1000) returning id`,
        [title, kind, tier, language],
      )
      files[title] = result.rows[0]!.id
    }
  })

  it('returns every file with unlocked flags that follow the tier', async () => {
    const free = await createAdultLearner(db, email('library.free'))
    const r199 = await createAdultLearner(db, email('library.r199'))
    const r349 = await createAdultLearner(db, email('library.r349'))
    const refunded = await createAdultLearner(db, email('library.refunded'))
    await grant(r199, 'r199')
    await grant(r349, 'r349')
    await grant(refunded, 'r349', 'inactive')

    const freeRows = await library(free)
    expect(freeRows.map((row) => row.kind)).toEqual(['book', 'book', 'bonus', 'planner'])
    expect(await unlockedTitles(free)).toEqual(['Free planner'])
    expect(await unlockedTitles(r199)).toEqual(['Bonus pack', 'Book EN', 'Free planner'])
    expect(await unlockedTitles(r349)).toEqual(['Boek AF', 'Bonus pack', 'Book EN', 'Free planner'])
    expect(await unlockedTitles(refunded)).toEqual(['Free planner'])
  })

  it('gives a download path only for an unlocked file', async () => {
    const free = await createAdultLearner(db, email('download.free'))
    const r349 = await createAdultLearner(db, email('download.r349'))
    await grant(r349, 'r349')
    const path = (userId: string, fileId: string) =>
      rows<{ path: string }>(userId, 'select public.library_download_path($1) as path', [fileId])

    expect(await path(free, files['Free planner']!)).toEqual([{ path: 'files/Free planner' }])
    await expectCode(path(free, files['Boek AF']!), 'not_allowed')
    await expectCode(path(free, '00000000-0000-4000-8000-000000000000'), 'not_found')
    expect(await path(r349, files['Boek AF']!)).toEqual([{ path: 'files/Boek AF' }])
  })

  it('applies a parent purchase to the parent and one linked learner (proposed rule)', async () => {
    const parent = await createParent(db, email('family.parent'))
    const firstChild = await createAdultLearner(db, email('family.first'))
    const secondChild = await createAdultLearner(db, email('family.second'))
    const unlinkedChild = await createAdultLearner(db, email('family.unlinked'))
    await grant(parent, 'r349')

    const firstLink = (
      await redeem(firstChild, (await createInvite(parent, 'parent_to_learner')).code)
    ).link_id
    await call(parent, 'select public.accept_link($1)', [firstLink])
    const secondLink = (
      await redeem(secondChild, (await createInvite(parent, 'parent_to_learner')).code)
    ).link_id
    await call(parent, 'select public.accept_link($1)', [secondLink])

    const everything = ['Boek AF', 'Bonus pack', 'Book EN', 'Free planner']
    expect(await unlockedTitles(parent)).toEqual(everything)
    expect(await unlockedTitles(firstChild)).toEqual(everything)
    expect(await unlockedTitles(secondChild)).toEqual(['Free planner'])
    expect(await unlockedTitles(unlinkedChild)).toEqual(['Free planner'])

    await call(firstChild, 'select public.remove_link($1)', [firstLink])
    expect(await unlockedTitles(firstChild)).toEqual(['Free planner'])
    expect(await unlockedTitles(secondChild)).toEqual(everything)
  })
})

describe('contact hash rule', () => {
  it('gives the same hash in SQL and in the edge functions', async () => {
    for (const contact of ['Parent@Example.TEST', '  parent@example.test\t\n', 'a.b+c@d.co.za']) {
      const sql = await serverValue<string>('select public.contact_hash($1) as value', [contact])
      expect(sql, contact).toBe(await contactHash(contact))
    }
    expect(await serverValue<string>('select public.consent_policy_version() as value')).toBe(
      CONSENT_POLICY_VERSION,
    )
  })
})
