// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asAnon,
  asUser,
  createAdultLearner,
  createMinorLearner,
  createParent,
  createTestDatabase,
  createUser,
  type Tx,
} from './harness'

let db: PGlite

interface Fixtures {
  subjectId: string
  lessonId: string
  activityId: string
  questionnaireId: string
  itemIds: [string, string]
  achievementId: string
  productId: string
}

let fixtures: Fixtures

async function insertId(sql: string, params: unknown[] = []): Promise<string> {
  const result = await db.query<{ id: string }>(sql, params)
  const id = result.rows[0]?.id
  if (!id) throw new Error(`no id returned by: ${sql}`)
  return id
}

async function createFixtures(): Promise<Fixtures> {
  const subjectId = await insertId("select id from public.subjects where code = 'MATH'")
  const lessonContentId = await insertId(
    `insert into public.content (kind, slug, title_en, body_en, status)
     values ('lesson', 'fixture-lesson', 'Fixture lesson', 'Lesson text', 'approved') returning id`,
  )
  const lessonId = await insertId(
    `insert into public.lessons (content_id, mls_number, week_number) values ($1, 50, 50)
     returning id`,
    [lessonContentId],
  )
  const activityId = await insertId(
    `insert into public.content (kind, parent_id, slug, title_en, status)
     values ('activity', $1, 'fixture-activity', 'Fixture activity', 'approved') returning id`,
    [lessonContentId],
  )
  const questionnaireId = await insertId(
    `insert into public.questionnaires (slug, title_en, status)
     values ('fixture-questionnaire', 'Fixture questionnaire', 'approved') returning id`,
  )
  const firstItem = await insertId(
    `insert into public.questionnaire_items (questionnaire_id, position, prompt_en)
     values ($1, 1, 'First') returning id`,
    [questionnaireId],
  )
  const secondItem = await insertId(
    `insert into public.questionnaire_items (questionnaire_id, position, prompt_en)
     values ($1, 2, 'Second') returning id`,
    [questionnaireId],
  )
  const achievementId = await insertId('select id from public.achievements limit 1')
  const productId = await insertId(
    `insert into public.products (code, tier, price_cents) values ('fixture-product', 'r99', 9900)
     returning id`,
  )
  return {
    subjectId,
    lessonId,
    activityId,
    questionnaireId,
    itemIds: [firstItem, secondItem],
    achievementId,
    productId,
  }
}

beforeAll(async () => {
  db = await createTestDatabase({ seed: true })
  fixtures = await createFixtures()
})

afterAll(async () => {
  await db.close()
})

async function count(tx: Tx, sql: string, params: unknown[] = []) {
  const result = await tx.query<{ n: number }>(
    `select count(*)::int as n from (${sql}) rows`,
    params,
  )
  return result.rows[0]?.n ?? -1
}

// Tables a learner writes through RLS (Product Bible 6.3, study tables).
const learnerOwnedTables = [
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
  'assessment_attempts',
]

// Personal tables that are written by the server or reached through a parent row.
const serverWrittenTables = [
  'assessment_answers',
  'streaks',
  'learner_achievements',
  'recommendations',
  'notifications',
  'notification_preferences',
  'ai_conversations',
  'ai_messages',
  'purchases',
  'entitlements',
  'invites',
  'age_declarations',
  'user_roles',
  'profiles',
]

const personalTables = [...learnerOwnedTables, ...serverWrittenTables]

// Which rows of each personal table belong to the user passed as $1.
const ownerFilter: Record<string, string> = {
  ...Object.fromEntries(learnerOwnedTables.map((table) => [table, 'learner_id = $1'])),
  assessment_answers:
    'attempt_id in (select id from public.assessment_attempts where learner_id = $1)',
  streaks: 'learner_id = $1',
  learner_achievements: 'learner_id = $1',
  recommendations: 'learner_id = $1',
  notifications: 'user_id = $1',
  notification_preferences: 'user_id = $1',
  ai_conversations: 'learner_id = $1',
  ai_messages: 'conversation_id in (select id from public.ai_conversations where learner_id = $1)',
  purchases: 'buyer_user_id = $1',
  entitlements: 'user_id = $1',
  invites: 'created_by = $1',
  age_declarations: 'user_id = $1',
  user_roles: 'user_id = $1',
  profiles: 'id = $1',
}

// Counted as the server, so filters through parent rows see every row.
async function ownedRowCount(table: string, userId: string): Promise<number> {
  const result = await db.query<{ n: number }>(
    `select count(*)::int as n from public.${table} where ${ownerFilter[table]}`,
    [userId],
  )
  return result.rows[0]?.n ?? -1
}

// One row in every personal table, written as the server like the edge functions will.
async function seedLearnerRows(learner: string): Promise<{ attemptId: string }> {
  const f = fixtures
  const rows: [string, unknown[]][] = [
    ['insert into public.learner_subjects (learner_id, subject_id) values ($1, $2)', [f.subjectId]],
    ['insert into public.learner_preferences (learner_id) values ($1)', []],
    [
      `insert into public.subject_marks (learner_id, subject_id, mark, kind, recorded_on)
       values ($1, $2, 70, 'test', current_date)`,
      [f.subjectId],
    ],
    [
      `insert into public.learner_exam_dates (learner_id, kind, subject_id, starts_on)
       values ($1, 'final', $2, current_date)`,
      [f.subjectId],
    ],
    ["insert into public.goals (learner_id, type, title) values ($1, 'academic', 'Pass')", []],
    [
      `insert into public.study_sessions (learner_id, activity, starts_at, duration_minutes)
       values ($1, 'Revise', now(), 30)`,
      [],
    ],
    [
      "insert into public.study_tasks (learner_id, title, due_on) values ($1, 'Task', current_date)",
      [],
    ],
    [
      `insert into public.study_activity (learner_id, activity_on, kind, minutes)
       values ($1, current_date, 'task', 30)`,
      [],
    ],
    [
      `insert into public.lesson_progress (learner_id, lesson_id, opened_at, reflection)
       values ($1, $2, now(), 'A private reflection')`,
      [f.lessonId],
    ],
    [
      `insert into public.worksheet_answers (learner_id, activity_content_id, content_version, answers)
       values ($1, $2, 1, '{"q1": "private"}')`,
      [f.activityId],
    ],
    ['insert into public.streaks (learner_id, current_length) values ($1, 3)', []],
    [
      'insert into public.learner_achievements (learner_id, achievement_id) values ($1, $2)',
      [f.achievementId],
    ],
    [
      `insert into public.recommendations (learner_id, rule_code, reason_key)
       values ($1, 'fixture', 'fixture.reason')`,
      [],
    ],
    [
      `insert into public.notifications (user_id, type, title_key)
       values ($1, 'fixture', 'fixture.title')`,
      [],
    ],
    ['insert into public.notification_preferences (user_id) values ($1)', []],
    [
      `insert into public.invites (code, created_by, kind)
       values ('code-' || $1::uuid::text, $1::uuid, 'learner_to_parent')`,
      [],
    ],
  ]
  for (const [sql, params] of rows) {
    await db.query(sql, [learner, ...params])
  }

  const attemptId = await insertId(
    `insert into public.assessment_attempts (learner_id, questionnaire_id, questionnaire_version)
     values ($1, $2, 1) returning id`,
    [learner, f.questionnaireId],
  )
  await db.query(
    `insert into public.assessment_answers (attempt_id, item_id, answer) values ($1, $2, '3')`,
    [attemptId, f.itemIds[0]],
  )
  const conversationId = await insertId(
    'insert into public.ai_conversations (learner_id) values ($1) returning id',
    [learner],
  )
  await db.query(
    `insert into public.ai_messages (conversation_id, role, text)
     values ($1, 'learner', 'A private question')`,
    [conversationId],
  )
  const purchaseId = await insertId(
    `insert into public.purchases
       (buyer_email, buyer_user_id, product_id, provider, provider_ref, amount_cents, status)
     values ('buyer@example.test', $1::uuid, $2, 'stripe', 'ref-' || $1::uuid::text, 9900, 'paid')
     returning id`,
    [learner, f.productId],
  )
  await db.query(
    `insert into public.entitlements (user_id, email, tier, source_purchase_id)
     values ($1, 'buyer@example.test', 'r99', $2)`,
    [learner, purchaseId],
  )
  return { attemptId }
}

// Every personal table must show the caller exactly their own rows, while the other
// user really does have rows there.
async function expectOnlyOwnRows(viewer: string, other: string) {
  for (const table of personalTables) {
    expect(
      await ownedRowCount(table, other),
      `${table} has rows for the other user`,
    ).toBeGreaterThan(0)
    const own = await ownedRowCount(table, viewer)
    const visible = await asUser(db, viewer, (tx) => count(tx, `select * from public.${table}`))
    expect(visible, `${table} visible rows`).toBe(own)
  }
}

describe('schema', () => {
  it('has Row Level Security enabled on every public table', async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `)
    expect(tables.rows.length).toBeGreaterThanOrEqual(45)
    const withoutRls = tables.rows.filter((row) => !row.relrowsecurity).map((row) => row.relname)
    expect(withoutRls).toEqual([])
  })

  it('creates a profile and learner role on sign-up without copying Google metadata', async () => {
    const result = await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ('google.user@example.test',
         '{"full_name": "Google Name", "avatar_url": "https://example.test/a.png", "language": "af"}')
       returning id`,
    )
    const id = result.rows[0]!.id
    const profile = await db.query<{ first_name: string | null; language: string }>(
      'select first_name, language from public.profiles where id = $1',
      [id],
    )
    expect(profile.rows).toEqual([{ first_name: null, language: 'af' }])
    const roles = await db.query('select role from public.user_roles where user_id = $1', [id])
    expect(roles.rows).toEqual([{ role: 'learner' }])
  })

  it('seeds the demo learner Thabo flagged as demo', async () => {
    const demo = await db.query<{ first_name: string; is_demo: boolean; subjects: number }>(`
      select p.first_name, p.is_demo,
        (select count(*)::int from public.learner_subjects s where s.learner_id = p.id) as subjects
      from public.profiles p where p.is_demo
    `)
    expect(demo.rows).toEqual([{ first_name: 'Thabo', is_demo: true, subjects: 4 }])
  })
})

describe('learner isolation', () => {
  let learnerA: string
  let learnerB: string
  let attemptB: string

  beforeAll(async () => {
    learnerA = await createAdultLearner(db, 'learner.a@example.test')
    learnerB = await createAdultLearner(db, 'learner.b@example.test')
    await seedLearnerRows(learnerA)
    attemptB = (await seedLearnerRows(learnerB)).attemptId
    await asUser(db, learnerB, (tx) =>
      tx.query("update public.profiles set first_name = 'Bongi' where id = $1", [learnerB]),
    )
  })

  it('lets a learner read their own rows in every personal table', async () => {
    for (const table of personalTables) {
      const own = await ownedRowCount(table, learnerB)
      expect(own, `${table} seeded`).toBeGreaterThan(0)
      const visible = await asUser(db, learnerB, (tx) =>
        count(tx, `select * from public.${table} where ${ownerFilter[table]}`, [learnerB]),
      )
      expect(visible, table).toBe(own)
    }
  })

  it("does not let learner A read learner B's rows in any personal table", async () => {
    await expectOnlyOwnRows(learnerA, learnerB)
    await expectOnlyOwnRows(learnerB, learnerA)
  })

  it("does not let learner A change or delete learner B's study rows", async () => {
    for (const table of learnerOwnedTables) {
      const column = table === 'assessment_attempts' ? 'shared_with_parent' : 'learner_id'
      await asUser(db, learnerA, async (tx) => {
        const updated = await tx.query(
          `update public.${table} set ${column} = ${column} where learner_id = $1`,
          [learnerB],
        )
        expect(updated.affectedRows, `update ${table}`).toBe(0)
        const deleted = await tx.query(`delete from public.${table} where learner_id = $1`, [
          learnerB,
        ])
        expect(deleted.affectedRows, `delete ${table}`).toBe(0)
      })
    }
    await asUser(db, learnerA, async (tx) => {
      const answers = await tx.query(
        `update public.assessment_answers set answer = '"1"' where attempt_id = $1`,
        [attemptB],
      )
      expect(answers.affectedRows).toBe(0)
      const profile = await tx.query("update public.profiles set first_name = 'X' where id = $1", [
        learnerB,
      ])
      expect(profile.affectedRows).toBe(0)
    })
    for (const table of personalTables) {
      expect(await ownedRowCount(table, learnerB), `${table} kept`).toBeGreaterThan(0)
    }
  })

  it('does not let learner A write rows for learner B', async () => {
    await expect(
      asUser(db, learnerA, (tx) =>
        tx.query(
          `insert into public.goals (learner_id, type, title) values ($1, 'study', 'Spoof')`,
          [learnerB],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      asUser(db, learnerA, (tx) =>
        tx.query(
          `insert into public.assessment_answers (attempt_id, item_id, answer) values ($1, $2, '1')`,
          [attemptB, fixtures.itemIds[1]],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('does not let a signed-out visitor read learner data', async () => {
    for (const table of personalTables) {
      await expect(
        asAnon(db, (tx) => tx.query(`select * from public.${table}`)),
        table,
      ).rejects.toThrow(/permission denied/)
    }
  })
})

describe('profiles.is_demo is server-only', () => {
  let learner: string

  beforeAll(async () => {
    learner = await createAdultLearner(db, 'demo.flag@example.test')
  })

  it('rejects a client update to is_demo', async () => {
    await expect(
      asUser(db, learner, (tx) =>
        tx.query('update public.profiles set is_demo = true where id = $1', [learner]),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('rejects a client insert of a profile', async () => {
    await expect(
      asUser(db, learner, (tx) =>
        tx.query('insert into public.profiles (id, is_demo) values ($1, true)', [learner]),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('rejects is_demo changes even if a column grant were added later', async () => {
    await db.exec('grant update (is_demo) on public.profiles to authenticated')
    try {
      await expect(
        asUser(db, learner, (tx) =>
          tx.query('update public.profiles set is_demo = true where id = $1', [learner]),
        ),
      ).rejects.toThrow(/is_demo can only be set by the server/)
    } finally {
      await db.exec('revoke update (is_demo) on public.profiles from authenticated')
    }
  })

  it('still lets the learner change allowed columns', async () => {
    await asUser(db, learner, (tx) =>
      tx.query("update public.profiles set language = 'af' where id = $1", [learner]),
    )
    const row = await db.query('select language, is_demo from public.profiles where id = $1', [
      learner,
    ])
    expect(row.rows).toEqual([{ language: 'af', is_demo: false }])
  })

  it('lets the server set is_demo', async () => {
    await db.query('update public.profiles set is_demo = true where id = $1', [learner])
    const row = await db.query('select is_demo from public.profiles where id = $1', [learner])
    expect(row.rows).toEqual([{ is_demo: true }])
  })
})

describe('consent before processing a minor', () => {
  let minor: string

  beforeAll(async () => {
    minor = await createMinorLearner(db, 'minor.waiting@example.test')
  })

  it('lets a minor without consent change only the app language', async () => {
    await asUser(db, minor, (tx) =>
      tx.query("update public.profiles set language = 'af' where id = $1", [minor]),
    )
    await expect(
      asUser(db, minor, (tx) =>
        tx.query("update public.profiles set first_name = 'Lebo' where id = $1", [minor]),
      ),
    ).rejects.toThrow(/parental consent is needed/)
  })

  it('blocks study writes from a minor without consent', async () => {
    await expect(
      asUser(db, minor, (tx) =>
        tx.query(
          `insert into public.goals (learner_id, type, title) values ($1, 'study', 'Read')`,
          [minor],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('does not let a learner change their age answer or grant themselves roles', async () => {
    await expect(
      asUser(db, minor, (tx) => tx.query('select public.declare_age(true)')),
    ).rejects.toThrow(/already been declared/)
    await expect(
      asUser(db, minor, (tx) =>
        tx.query('update public.age_declarations set is_adult = true where user_id = $1', [minor]),
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, minor, (tx) =>
        tx.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [minor]),
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      asUser(db, minor, (tx) => tx.query('select public.claim_parent_role()')),
    ).rejects.toThrow(/only an adult account/)
  })
})

describe('give_consent()', () => {
  async function requestConsent(learner: string): Promise<string> {
    const result = await asUser(db, learner, (tx) =>
      tx.query<{ id: string }>("select public.request_consent('hash-of-contact', 'v1') as id"),
    )
    return result.rows[0]!.id
  }

  it('switches an existing pending parent link to active', async () => {
    const learner = await createMinorLearner(db, 'minor.pending@example.test')
    const parent = await createParent(db, 'parent.pending@example.test')
    const pending = await db.query<{ id: string }>(
      `insert into public.parent_links (learner_id, parent_id, status, initiated_by)
       values ($1, $2, 'pending', $2) returning id`,
      [learner, parent],
    )
    const pendingId = pending.rows[0]!.id
    const consentId = await requestConsent(learner)
    await db.query(
      "insert into public.consent_contacts (consent_id, channel, contact_encrypted) values ($1, 'email', '\\x00')",
      [consentId],
    )

    const linkResult = await asUser(db, parent, (tx) =>
      tx.query<{ link_id: string }>('select public.give_consent($1) as link_id', [consentId]),
    )
    expect(linkResult.rows[0]!.link_id).toBe(pendingId)

    const links = await db.query<{ id: string; status: string }>(
      'select id, status from public.parent_links where learner_id = $1 and parent_id = $2',
      [learner, parent],
    )
    expect(links.rows).toEqual([{ id: pendingId, status: 'active' }])

    const consent = await db.query<{ status: string; parent_user_id: string }>(
      'select status, parent_user_id from public.parental_consents where id = $1',
      [consentId],
    )
    expect(consent.rows).toEqual([{ status: 'given', parent_user_id: parent }])

    const contacts = await db.query('select * from public.consent_contacts where consent_id = $1', [
      consentId,
    ])
    expect(contacts.rows).toEqual([])

    await asUser(db, learner, async (tx) => {
      const status = await tx.query('select status from public.my_consent_status')
      expect(status.rows).toEqual([{ status: 'given' }])
      await tx.query("update public.profiles set first_name = 'Lebo' where id = $1", [learner])
      await tx.query(
        `insert into public.goals (learner_id, type, title) values ($1, 'study', 'Read MLS 1')`,
        [learner],
      )
    })
  })

  it('creates an active link when none exists yet', async () => {
    const learner = await createMinorLearner(db, 'minor.new@example.test')
    const parent = await createParent(db, 'parent.new@example.test')
    const consentId = await requestConsent(learner)
    await asUser(db, parent, (tx) => tx.query('select public.give_consent($1)', [consentId]))
    const links = await db.query<{ status: string }>(
      'select status from public.parent_links where learner_id = $1 and parent_id = $2',
      [learner, parent],
    )
    expect(links.rows).toEqual([{ status: 'active' }])
  })

  it('is refused for the learner, for non-parents and for a request that is not pending', async () => {
    const learner = await createMinorLearner(db, 'minor.refused@example.test')
    const notParent = await createAdultLearner(db, 'adult.notparent@example.test')
    const parent = await createParent(db, 'parent.refused@example.test')
    const consentId = await requestConsent(learner)

    await expect(
      asUser(db, learner, (tx) => tx.query('select public.give_consent($1)', [consentId])),
    ).rejects.toThrow(/cannot give consent for themselves/)
    await expect(
      asUser(db, notParent, (tx) => tx.query('select public.give_consent($1)', [consentId])),
    ).rejects.toThrow(/only a parent account/)

    await asUser(db, parent, (tx) => tx.query('select public.give_consent($1)', [consentId]))
    await expect(
      asUser(db, parent, (tx) => tx.query('select public.give_consent($1)', [consentId])),
    ).rejects.toThrow(/not pending/)
  })

  it('keeps one link row when a second request is consented for the same pair', async () => {
    const learner = await createMinorLearner(db, 'minor.twice@example.test')
    const parent = await createParent(db, 'parent.twice@example.test')
    const first = await requestConsent(learner)
    await asUser(db, parent, (tx) => tx.query('select public.give_consent($1)', [first]))
    await asUser(db, parent, async (tx) => {
      const link = await tx.query<{ id: string }>('select id from public.parent_links')
      await tx.query('select public.remove_link($1)', [link.rows[0]!.id])
    })
    await asUser(db, parent, async (tx) => {
      const consent = await tx.query<{ id: string }>('select id from public.parental_consents')
      await tx.query('select public.withdraw_consent($1)', [consent.rows[0]!.id])
    })

    const second = await requestConsent(learner)
    await asUser(db, parent, (tx) => tx.query('select public.give_consent($1)', [second]))
    const links = await db.query<{ status: string }>(
      'select status from public.parent_links where learner_id = $1 and parent_id = $2',
      [learner, parent],
    )
    expect(links.rows).toEqual([{ status: 'active' }])
  })
})

describe('parent_links', () => {
  it('enforces one row per learner and parent pair', async () => {
    const learner = await createUser(db, 'unique.learner@example.test')
    const parent = await createUser(db, 'unique.parent@example.test')
    await db.query(
      `insert into public.parent_links (learner_id, parent_id, initiated_by) values ($1, $2, $2)`,
      [learner, parent],
    )
    await expect(
      db.query(
        `insert into public.parent_links (learner_id, parent_id, initiated_by) values ($1, $2, $1)`,
        [learner, parent],
      ),
    ).rejects.toThrow(/parent_links_learner_parent_key/)
  })

  it('cannot be written directly by a client', async () => {
    const learner = await createAdultLearner(db, 'direct.link@example.test')
    const parent = await createParent(db, 'direct.parent@example.test')
    await expect(
      asUser(db, parent, (tx) =>
        tx.query(
          `insert into public.parent_links (learner_id, parent_id, status, initiated_by)
           values ($1, $2, 'active', $2)`,
          [learner, parent],
        ),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('lets the other side accept a pending link, not the side that started it', async () => {
    const learner = await createAdultLearner(db, 'accept.learner@example.test')
    const parent = await createParent(db, 'accept.parent@example.test')
    const link = await db.query<{ id: string }>(
      `insert into public.parent_links (learner_id, parent_id, initiated_by)
       values ($1, $2, $2) returning id`,
      [learner, parent],
    )
    const linkId = link.rows[0]!.id
    await expect(
      asUser(db, parent, (tx) => tx.query('select public.accept_link($1)', [linkId])),
    ).rejects.toThrow(/no pending link/)
    await asUser(db, learner, (tx) => tx.query('select public.accept_link($1)', [linkId]))
    const row = await db.query('select status from public.parent_links where id = $1', [linkId])
    expect(row.rows).toEqual([{ status: 'active' }])
  })
})

describe('parents read summaries, not raw data', () => {
  let learner: string
  let parent: string
  let stranger: string

  beforeAll(async () => {
    learner = await createAdultLearner(db, 'summary.learner@example.test')
    parent = await createParent(db, 'summary.parent@example.test')
    stranger = await createParent(db, 'summary.stranger@example.test')
    await db.query(
      `insert into public.parent_links (learner_id, parent_id, status, initiated_by)
       values ($1, $2, 'active', $1)`,
      [learner, parent],
    )
    await asUser(db, learner, async (tx) => {
      await tx.query(
        `insert into public.study_activity (learner_id, activity_on, kind, minutes)
         values ($1, (now() at time zone 'Africa/Johannesburg')::date, 'task', 45)`,
        [learner],
      )
      await tx.query(
        `insert into public.goals (learner_id, type, title) values ($1, 'personal', 'Private goal')`,
        [learner],
      )
    })
  })

  it('gives a linked parent the summary only', async () => {
    await asUser(db, parent, async (tx) => {
      const summary = await tx.query<{ minutes_last_7_days: number }>(
        'select * from public.parent_learner_summary($1)',
        [learner],
      )
      expect(summary.rows[0]?.minutes_last_7_days).toBe(45)
      expect(await count(tx, 'select * from public.goals')).toBe(0)
      expect(await count(tx, 'select * from public.study_activity')).toBe(0)
      expect(await count(tx, 'select * from public.profiles')).toBe(1)
    })
  })

  it('does not let a linked parent read reflections, chats, worksheet or assessment answers', async () => {
    const child = await createAdultLearner(db, 'private.child@example.test')
    const linkedParent = await createParent(db, 'private.parent@example.test')
    await db.query(
      `insert into public.parent_links (learner_id, parent_id, status, initiated_by)
       values ($1, $2, 'active', $1)`,
      [child, linkedParent],
    )
    const { attemptId } = await seedLearnerRows(child)
    await db.query(
      `update public.assessment_attempts
       set completed_at = now(), score = 3, band = 'fixture', shared_with_parent = true
       where id = $1`,
      [attemptId],
    )

    const privateTables = [
      'lesson_progress',
      'ai_conversations',
      'ai_messages',
      'worksheet_answers',
      'assessment_attempts',
      'assessment_answers',
    ]
    for (const table of privateTables) {
      expect(await ownedRowCount(table, child), `${table} seeded`).toBeGreaterThan(0)
      const learnerSees = await asUser(db, child, (tx) =>
        count(tx, `select * from public.${table}`),
      )
      expect(learnerSees, `learner reads own ${table}`).toBeGreaterThan(0)
      const parentSees = await asUser(db, linkedParent, (tx) =>
        count(tx, `select * from public.${table}`),
      )
      expect(parentSees, `parent reads ${table}`).toBe(0)
    }
    await expectOnlyOwnRows(linkedParent, child)

    const summary = await asUser(db, linkedParent, (tx) =>
      tx.query<Record<string, unknown>>('select * from public.parent_learner_summary($1)', [child]),
    )
    expect(Object.keys(summary.rows[0] ?? {}).sort()).toEqual([
      'current_streak',
      'last_active_on',
      'lessons_completed_last_7_days',
      'minutes_last_7_days',
      'tasks_done_last_7_days',
    ])
  })

  it('refuses the summary to a parent who is not linked', async () => {
    await expect(
      asUser(db, stranger, (tx) =>
        tx.query('select * from public.parent_learner_summary($1)', [learner]),
      ),
    ).rejects.toThrow(/no active link/)
  })
})

describe('content, reference and server-written tables', () => {
  let learner: string

  beforeAll(async () => {
    learner = await createAdultLearner(db, 'content.reader@example.test')
    await db.exec(`
      insert into public.content (kind, slug, title_en, status) values
        ('lesson', 'approved-lesson', 'Approved', 'approved'),
        ('lesson', 'draft-lesson', 'Draft', 'draft');
      insert into public.products (code, tier, price_cents, active) values
        ('active-product', 'r99', 9900, true),
        ('hidden-product', 'r199', 19900, false);
    `)
  })

  it('shows only approved content and blocks non-admin writes', async () => {
    await asUser(db, learner, async (tx) => {
      const rows = await tx.query<{ slug: string }>(
        "select slug from public.content where slug in ('approved-lesson', 'draft-lesson')",
      )
      expect(rows.rows).toEqual([{ slug: 'approved-lesson' }])
    })
    await expect(
      asUser(db, learner, (tx) =>
        tx.query(`insert into public.content (kind, slug, title_en) values ('lesson', 'x', 'x')`),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('lets an admin see drafts', async () => {
    const admin = await createAdultLearner(db, 'admin@example.test')
    await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [admin])
    await asUser(db, admin, async (tx) => {
      expect(
        await count(
          tx,
          "select id from public.content where slug in ('approved-lesson', 'draft-lesson')",
        ),
      ).toBe(2)
    })
  })

  it('shows only active products to signed-out visitors', async () => {
    await asAnon(db, async (tx) => {
      const rows = await tx.query<{ code: string }>('select code from public.products')
      expect(rows.rows).toEqual([{ code: 'active-product' }])
    })
  })

  it('gives clients no access to server-only tables', async () => {
    for (const table of ['consent_contacts', 'payment_events', 'kb_chunks', 'analytics_events']) {
      await expect(
        asUser(db, learner, (tx) => tx.query(`select * from public.${table}`)),
      ).rejects.toThrow(/permission denied/)
    }
    await expect(
      asUser(db, learner, (tx) =>
        tx.query(`insert into public.streaks (learner_id, current_length) values ($1, 100)`, [
          learner,
        ]),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('lets a consenting learner record an analytics event about themselves', async () => {
    await asUser(db, learner, (tx) =>
      tx.query(`insert into public.analytics_events (user_id, event) values ($1, 'app_opened')`, [
        learner,
      ]),
    )
    await expect(
      asUser(db, learner, (tx) =>
        tx.query(
          `insert into public.analytics_events (user_id, event) values (null, 'app_opened')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/)
  })
})

describe('a completed assessment attempt is frozen', () => {
  let learner: string

  async function startAttempt(): Promise<string> {
    const result = await asUser(db, learner, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.assessment_attempts (learner_id, questionnaire_id, questionnaire_version)
         values ($1, $2, 1) returning id`,
        [learner, fixtures.questionnaireId],
      ),
    )
    return result.rows[0]!.id
  }

  async function completedAttempt(): Promise<string> {
    const attemptId = await startAttempt()
    await asUser(db, learner, async (tx) => {
      await tx.query(
        `insert into public.assessment_answers (attempt_id, item_id, answer) values ($1, $2, '2')`,
        [attemptId, fixtures.itemIds[0]],
      )
      await tx.query(
        `update public.assessment_attempts set completed_at = now(), score = 2, band = 'low'
         where id = $1`,
        [attemptId],
      )
    })
    return attemptId
  }

  async function attemptState(attemptId: string) {
    const attempt = await db.query(
      `select completed_at is not null as completed, score::int as score, band,
         questionnaire_version, shared_with_parent
       from public.assessment_attempts where id = $1`,
      [attemptId],
    )
    const answers = await db.query(
      'select item_id, answer from public.assessment_answers where attempt_id = $1 order by item_id',
      [attemptId],
    )
    return { attempt: attempt.rows, answers: answers.rows }
  }

  beforeAll(async () => {
    learner = await createAdultLearner(db, 'assessment.learner@example.test')
  })

  it('lets the learner answer, change answers and complete an open attempt', async () => {
    const attemptId = await startAttempt()
    await asUser(db, learner, async (tx) => {
      await tx.query(
        `insert into public.assessment_answers (attempt_id, item_id, answer) values ($1, $2, '1')`,
        [attemptId, fixtures.itemIds[0]],
      )
      const changed = await tx.query(
        `update public.assessment_answers set answer = '4' where attempt_id = $1`,
        [attemptId],
      )
      expect(changed.affectedRows).toBe(1)
      await tx.query(
        `update public.assessment_attempts set score = 4, band = 'high', completed_at = now()
         where id = $1`,
        [attemptId],
      )
    })
    expect(await attemptState(attemptId)).toEqual({
      attempt: [
        {
          completed: true,
          score: 4,
          band: 'high',
          questionnaire_version: 1,
          shared_with_parent: false,
        },
      ],
      answers: [{ item_id: fixtures.itemIds[0], answer: 4 }],
    })
  })

  it('rejects reopening a completed attempt to add answers', async () => {
    const attemptId = await completedAttempt()
    const before = await attemptState(attemptId)
    await expect(
      asUser(db, learner, async (tx) => {
        await tx.query('update public.assessment_attempts set completed_at = null where id = $1', [
          attemptId,
        ])
        await tx.query(
          `insert into public.assessment_answers (attempt_id, item_id, answer) values ($1, $2, '5')`,
          [attemptId, fixtures.itemIds[1]],
        )
      }),
    ).rejects.toThrow(/completed assessment attempt cannot be changed/)
    expect(await attemptState(attemptId)).toEqual(before)
  })

  it('rejects changing the result of a completed attempt', async () => {
    const attemptId = await completedAttempt()
    const before = await attemptState(attemptId)
    for (const change of [
      'score = 99',
      "band = 'high'",
      "completed_at = now() - interval '1 day'",
    ]) {
      await expect(
        asUser(db, learner, (tx) =>
          tx.query(`update public.assessment_attempts set ${change} where id = $1`, [attemptId]),
        ),
        change,
      ).rejects.toThrow(/completed assessment attempt cannot be changed/)
    }
    expect(await attemptState(attemptId)).toEqual(before)
  })

  it('rejects new or changed answers on a completed attempt', async () => {
    const attemptId = await completedAttempt()
    const before = await attemptState(attemptId)
    await expect(
      asUser(db, learner, (tx) =>
        tx.query(
          `insert into public.assessment_answers (attempt_id, item_id, answer) values ($1, $2, '5')`,
          [attemptId, fixtures.itemIds[1]],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
    const changed = await asUser(db, learner, (tx) =>
      tx.query(`update public.assessment_answers set answer = '5' where attempt_id = $1`, [
        attemptId,
      ]),
    )
    expect(changed.affectedRows).toBe(0)
    expect(await attemptState(attemptId)).toEqual(before)
  })

  it('never lets a client move an attempt to another questionnaire or version', async () => {
    const attemptId = await startAttempt()
    await expect(
      asUser(db, learner, (tx) =>
        tx.query('update public.assessment_attempts set questionnaire_version = 2 where id = $1', [
          attemptId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/)

    await db.exec(
      'grant update (questionnaire_id, questionnaire_version) on public.assessment_attempts to authenticated',
    )
    try {
      await expect(
        asUser(db, learner, (tx) =>
          tx.query(
            'update public.assessment_attempts set questionnaire_version = 2 where id = $1',
            [attemptId],
          ),
        ),
      ).rejects.toThrow(/cannot move to another learner or questionnaire/)
    } finally {
      await db.exec(
        'revoke update (questionnaire_id, questionnaire_version) on public.assessment_attempts from authenticated',
      )
    }
  })

  it('still lets the learner choose whether to share a completed result', async () => {
    const attemptId = await completedAttempt()
    await asUser(db, learner, (tx) =>
      tx.query('update public.assessment_attempts set shared_with_parent = true where id = $1', [
        attemptId,
      ]),
    )
    const row = await db.query(
      'select shared_with_parent from public.assessment_attempts where id = $1',
      [attemptId],
    )
    expect(row.rows).toEqual([{ shared_with_parent: true }])
  })

  it('lets the server correct a completed attempt', async () => {
    const attemptId = await completedAttempt()
    await db.query('update public.assessment_attempts set score = 3 where id = $1', [attemptId])
    const row = await db.query(
      'select score::int as score from public.assessment_attempts where id = $1',
      [attemptId],
    )
    expect(row.rows).toEqual([{ score: 3 }])
  })
})

describe('lesson bodies are gated by min_tier', () => {
  let freeLessonId: string
  let paidLessonId: string
  let paidActivityId: string
  let draftLessonId: string
  let freeLearner: string
  let r199Learner: string
  let r349Learner: string
  let refundedLearner: string
  let giftedLearner: string
  let admin: string

  async function grantTier(
    userId: string | null,
    tier: string,
    extra: Record<string, unknown> = {},
  ) {
    await db.query(
      `insert into public.entitlements (user_id, email, tier, status, granted_for_learner_id)
       values ($1, 'tier@example.test', $2, $3, $4)`,
      [userId, tier, extra.status ?? 'active', extra.grantedFor ?? null],
    )
  }

  async function addLesson(slug: string, mls: number, tier: string, status = 'approved') {
    const contentId = await insertId(
      `insert into public.content (kind, slug, title_en, body_en, body_af, status)
       values ('lesson', $1, $1, 'Body of ' || $1, 'Teks van ' || $1, $2) returning id`,
      [slug, status],
    )
    await db.query(
      `insert into public.lessons (content_id, mls_number, week_number, min_tier)
       values ($1, $2, $2, $3)`,
      [contentId, mls, tier],
    )
    return contentId
  }

  async function bodyFor(userId: string, contentId: string) {
    const result = await asUser(db, userId, (tx) =>
      tx.query<{ body_en: string; body_af: string }>(
        'select body_en, body_af from public.content_body($1)',
        [contentId],
      ),
    )
    return result.rows
  }

  beforeAll(async () => {
    freeLessonId = await addLesson('tier-free-lesson', 41, 'free')
    paidLessonId = await addLesson('tier-r349-lesson', 42, 'r349')
    draftLessonId = await addLesson('tier-draft-lesson', 43, 'free', 'draft')
    paidActivityId = await insertId(
      `insert into public.content (kind, parent_id, slug, title_en, body_en, status)
       values ('activity', $1, 'tier-r349-activity', 'Activity', 'Activity body', 'approved')
       returning id`,
      [paidLessonId],
    )

    freeLearner = await createAdultLearner(db, 'tier.free@example.test')
    r199Learner = await createAdultLearner(db, 'tier.r199@example.test')
    r349Learner = await createAdultLearner(db, 'tier.r349@example.test')
    refundedLearner = await createAdultLearner(db, 'tier.refunded@example.test')
    giftedLearner = await createAdultLearner(db, 'tier.gifted@example.test')
    const buyingParent = await createParent(db, 'tier.parent@example.test')
    admin = await createAdultLearner(db, 'tier.admin@example.test')
    await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [admin])

    await grantTier(freeLearner, 'free')
    await grantTier(r199Learner, 'r199')
    await grantTier(r349Learner, 'r349')
    await grantTier(r349Learner, 'r99')
    await grantTier(refundedLearner, 'r349', { status: 'inactive' })
    await grantTier(buyingParent, 'r349', { grantedFor: giftedLearner })
  })

  it('gives clients no direct select on lesson bodies', async () => {
    for (const column of ['body_en', 'body_af']) {
      await expect(
        asUser(db, r349Learner, (tx) => tx.query(`select ${column} from public.content`)),
        column,
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('still shows a locked lesson title and tier so the app can offer an upgrade', async () => {
    const rows = await asUser(db, freeLearner, (tx) =>
      tx.query(
        `select c.title_en, l.min_tier from public.content c
         join public.lessons l on l.content_id = c.id where c.id = $1`,
        [paidLessonId],
      ),
    )
    expect(rows.rows).toEqual([{ title_en: 'tier-r349-lesson', min_tier: 'r349' }])
  })

  it('lets every signed-in learner read a free lesson body', async () => {
    expect(await bodyFor(freeLearner, freeLessonId)).toEqual([
      { body_en: 'Body of tier-free-lesson', body_af: 'Teks van tier-free-lesson' },
    ])
  })

  it('does not let a free learner read an r349 lesson body or an activity inside it', async () => {
    expect(await bodyFor(freeLearner, paidLessonId)).toEqual([])
    expect(await bodyFor(freeLearner, paidActivityId)).toEqual([])
    const allowed = await asUser(db, freeLearner, (tx) =>
      tx.query<{ allowed: boolean }>('select public.can_read_content_body($1) as allowed', [
        paidLessonId,
      ]),
    )
    expect(allowed.rows).toEqual([{ allowed: false }])
  })

  it('lets an r349 learner read the r349 lesson body', async () => {
    expect(await bodyFor(r349Learner, paidLessonId)).toEqual([
      { body_en: 'Body of tier-r349-lesson', body_af: 'Teks van tier-r349-lesson' },
    ])
    expect(await bodyFor(r349Learner, paidActivityId)).toEqual([
      { body_en: 'Activity body', body_af: null },
    ])
  })

  it('does not unlock an r349 lesson for a lower tier or a refunded entitlement', async () => {
    expect(await bodyFor(r199Learner, paidLessonId)).toEqual([])
    expect(await bodyFor(refundedLearner, paidLessonId)).toEqual([])
  })

  it('unlocks a lesson for a learner whose parent bought the tier for them', async () => {
    expect(await bodyFor(giftedLearner, paidLessonId)).toHaveLength(1)
  })

  it('never returns a draft body to a learner, and lets an admin read every body', async () => {
    expect(await bodyFor(r349Learner, draftLessonId)).toEqual([])
    expect(await bodyFor(admin, draftLessonId)).toHaveLength(1)
    expect(await bodyFor(admin, paidLessonId)).toHaveLength(1)
  })

  it('is not available to signed-out visitors', async () => {
    await expect(
      asAnon(db, (tx) => tx.query('select * from public.content_body($1)', [freeLessonId])),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('client privileges', () => {
  const adminWritable = [
    'achievements',
    'content',
    'exam_dates',
    'lessons',
    'library_files',
    'plan_templates',
    'products',
    'questionnaire_items',
    'questionnaire_results_bands',
    'questionnaires',
    'schools',
    'subjects',
    'tips',
  ]
  const studyTables = learnerOwnedTables.filter((table) => table !== 'assessment_attempts')
  const readOnly = [
    'age_declarations',
    'ai_conversations',
    'ai_messages',
    'audit_log',
    'entitlements',
    'invites',
    'learner_achievements',
    'my_consent_status',
    'parent_links',
    'parental_consents',
    'profiles',
    'purchases',
    'streaks',
    'user_roles',
  ]
  const contentReadable = [
    'approved_at',
    'approved_by',
    'created_at',
    'id',
    'kind',
    'parent_id',
    'slug',
    'source_ref',
    'status',
    'title_af',
    'title_en',
    'updated_at',
    'version',
  ]
  const profileWritable = [
    'first_name',
    'grade',
    'language',
    'onboarded_at',
    'onboarding_step',
    'province',
    'school_id',
    'school_name_other',
  ]

  const on = (privilege: string, tables: string[]) =>
    tables.map((table) => `authenticated ${privilege} ${table}`)
  const onColumns = (privilege: string, table: string, columns: string[]) =>
    columns.map((column) => `authenticated ${privilege} ${table}(${column})`)

  const expectedTablePrivileges = [
    'anon SELECT products',
    ...on('SELECT', [
      ...adminWritable.filter((table) => table !== 'content'),
      ...studyTables,
      ...readOnly,
      'assessment_answers',
      'assessment_attempts',
      'notification_preferences',
      'notifications',
      'recommendations',
    ]),
    ...onColumns('SELECT', 'content', contentReadable),
    ...on('INSERT', [
      ...adminWritable,
      ...studyTables,
      'assessment_answers',
      'assessment_attempts',
      'notification_preferences',
      'recommendations',
      'user_roles',
    ]),
    ...onColumns('INSERT', 'analytics_events', ['event', 'props', 'user_id']),
    ...on('UPDATE', [
      ...adminWritable,
      ...studyTables,
      'assessment_answers',
      'notification_preferences',
    ]),
    ...onColumns('UPDATE', 'assessment_attempts', [
      'band',
      'completed_at',
      'score',
      'shared_with_parent',
    ]),
    ...onColumns('UPDATE', 'notifications', ['read_at']),
    ...onColumns('UPDATE', 'profiles', profileWritable),
    ...onColumns('UPDATE', 'recommendations', ['acted_at']),
    ...on('DELETE', [...adminWritable, ...studyTables, 'assessment_attempts', 'user_roles']),
  ]

  const expectedFunctionGrants = [
    'accept_link(uuid)',
    'can_read_content_body(uuid)',
    'claim_parent_role()',
    'content_body(uuid)',
    'declare_age(boolean)',
    'give_consent(uuid)',
    'has_consent()',
    'is_admin()',
    'parent_learner_summary(uuid)',
    'remove_link(uuid)',
    'request_consent(text,text)',
    'withdraw_consent(uuid)',
  ].map((signature) => `authenticated EXECUTE ${signature}`)

  it('grants anon and authenticated exactly the expected table and column privileges', async () => {
    const result = await db.query<{ grant: string }>(`
      select format('%s %s %s', a.grantee::regrole, a.privilege_type, c.relname) as grant
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      where n.nspname = 'public' and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
      union all
      select format('%s %s %s(%s)', a.grantee::regrole, a.privilege_type, c.relname, att.attname)
      from pg_attribute att
      join pg_class c on c.oid = att.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(att.attacl) a
      where n.nspname = 'public' and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
    `)
    expect(result.rows.map((row) => row.grant).sort()).toEqual([...expectedTablePrivileges].sort())
  })

  it('grants execute on exactly the expected functions, and none to PUBLIC or anon', async () => {
    const result = await db.query<{ grant: string }>(`
      select format(
        '%s EXECUTE %s',
        case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
        p.oid::regprocedure
      ) as grant
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname = 'public'
        and a.privilege_type = 'EXECUTE'
        and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole))
    `)
    expect(result.rows.map((row) => row.grant).sort()).toEqual([...expectedFunctionGrants].sort())
  })
})
