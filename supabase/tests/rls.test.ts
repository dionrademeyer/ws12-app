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
} from './harness'

let db: PGlite

beforeAll(async () => {
  db = await createTestDatabase({ seed: true })
})

afterAll(async () => {
  await db.close()
})

async function count(tx: Parameters<Parameters<typeof asUser>[2]>[0], sql: string) {
  const result = await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) rows`)
  return result.rows[0]?.n ?? -1
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

  beforeAll(async () => {
    learnerA = await createAdultLearner(db, 'learner.a@example.test')
    learnerB = await createAdultLearner(db, 'learner.b@example.test')
    await asUser(db, learnerB, async (tx) => {
      await tx.query("update public.profiles set first_name = 'Bongi' where id = $1", [learnerB])
      await tx.query(
        `insert into public.goals (learner_id, type, title) values ($1, 'academic', 'Pass Maths')`,
        [learnerB],
      )
      await tx.query(
        `insert into public.study_tasks (learner_id, title, due_on) values ($1, 'Revise', current_date)`,
        [learnerB],
      )
      await tx.query(
        `insert into public.study_activity (learner_id, activity_on, kind, minutes)
         values ($1, current_date, 'task', 30)`,
        [learnerB],
      )
    })
  })

  it('lets a learner read their own rows', async () => {
    await asUser(db, learnerB, async (tx) => {
      expect(await count(tx, 'select * from public.goals')).toBe(1)
      expect(await count(tx, 'select * from public.profiles')).toBe(1)
    })
  })

  it("does not let learner A read learner B's data", async () => {
    await asUser(db, learnerA, async (tx) => {
      for (const table of ['goals', 'study_tasks', 'study_activity']) {
        expect(
          await count(tx, `select * from public.${table} where learner_id = '${learnerB}'`),
        ).toBe(0)
      }
      const profiles = await tx.query<{ id: string }>('select id from public.profiles')
      expect(profiles.rows).toEqual([{ id: learnerA }])
    })
  })

  it("does not let learner A change or delete learner B's rows", async () => {
    await asUser(db, learnerA, async (tx) => {
      const updated = await tx.query(
        "update public.goals set title = 'Hacked' where learner_id = $1",
        [learnerB],
      )
      expect(updated.affectedRows).toBe(0)
      const deleted = await tx.query('delete from public.study_tasks where learner_id = $1', [
        learnerB,
      ])
      expect(deleted.affectedRows).toBe(0)
      const profile = await tx.query("update public.profiles set first_name = 'X' where id = $1", [
        learnerB,
      ])
      expect(profile.affectedRows).toBe(0)
    })
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
  })

  it('does not let a signed-out visitor read learner data', async () => {
    await expect(asAnon(db, (tx) => tx.query('select * from public.profiles'))).rejects.toThrow(
      /permission denied/,
    )
    await expect(asAnon(db, (tx) => tx.query('select * from public.goals'))).rejects.toThrow(
      /permission denied/,
    )
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
      const rows = await tx.query<{ slug: string }>('select slug from public.content')
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
      expect(await count(tx, 'select * from public.content')).toBe(2)
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
