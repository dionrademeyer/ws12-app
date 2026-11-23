import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from './errors'
import { createSupabaseRepository } from './supabaseRepository'

const user = { id: 'user-1', email: 'a@example.com', emailVerified: true }

// A small stand-in for the Supabase client: rpc, functions.invoke and chained table queries.
function fakeClient(options: {
  rpc?: (fn: string, args?: unknown) => { data: unknown; error: unknown }
  invoke?: (fn: string, body: unknown) => { data: unknown; error: unknown }
  tables?: Record<string, { data: unknown; error: unknown }>
}) {
  const calls: { table: string; method: string; args: unknown[] }[] = []
  const from = vi.fn((table: string) => {
    const result = options.tables?.[table] ?? { data: [], error: null }
    const chain: Record<string, unknown> = {}
    for (const method of [
      'select',
      'eq',
      'is',
      'not',
      'ilike',
      'order',
      'limit',
      'single',
      'update',
      'delete',
      'insert',
      'upsert',
    ]) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return chain
      }
    }
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return chain
  })
  const client = {
    rpc: vi.fn(
      async (fn: string, args?: unknown) => options.rpc?.(fn, args) ?? { data: null, error: null },
    ),
    functions: {
      invoke: vi.fn(
        async (fn: string, { body }: { body: unknown }) =>
          options.invoke?.(fn, body) ?? { data: null, error: null },
      ),
    },
    from,
  }
  return { client: client as unknown as SupabaseClient, raw: client, calls }
}

describe('Supabase repository', () => {
  it('maps my_account_state to the account state', async () => {
    const { client, raw } = fakeClient({
      rpc: () => ({
        data: [
          {
            is_adult: false,
            consent_status: 'pending',
            roles: ['learner'],
            onboarding_step: 2,
            onboarded: false,
            language: 'af',
          },
        ],
        error: null,
      }),
    })
    const state = await createSupabaseRepository(client, user).getAccountState()
    expect(raw.rpc).toHaveBeenCalledWith('my_account_state', undefined)
    expect(state).toEqual({
      isAdult: false,
      consentStatus: 'pending',
      roles: ['learner'],
      onboardingStep: 2,
      onboarded: false,
      language: 'af',
    })
  })

  it('calls each database function with the contract argument names', async () => {
    const { client, raw } = fakeClient({
      rpc: (fn) => {
        if (fn === 'create_invite')
          return { data: [{ code: 'ABCD2345', expires_at: '2026-12-01' }], error: null }
        if (fn === 'redeem_invite')
          return { data: [{ link_id: 'link-9', error: null }], error: null }
        if (fn === 'claim_entitlements') return { data: 2, error: null }
        return { data: null, error: null }
      },
    })
    const repository = createSupabaseRepository(client, user)
    await repository.declareAge(false)
    await repository.claimParentRole()
    expect(await repository.claimEntitlements()).toBe(2)
    await repository.setLanguage('af')
    expect(await repository.createInvite('parent_to_learner')).toEqual({
      code: 'ABCD2345',
      expiresAt: '2026-12-01',
    })
    expect(await repository.redeemInvite(' abcd2345 ')).toBe('link-9')
    await repository.acceptLink('link-9')
    await repository.removeLink('link-9')
    await repository.giveConsent('consent-1')
    await repository.declineConsent('consent-1')
    await repository.withdrawConsent('consent-1')
    await repository.saveOnboarding({
      first_name: 'Thabo',
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
    })

    expect(raw.rpc.mock.calls).toEqual([
      ['declare_age', { p_is_adult: false }],
      ['claim_parent_role', undefined],
      ['claim_entitlements', undefined],
      ['set_language', { p_language: 'af' }],
      ['create_invite', { p_kind: 'parent_to_learner' }],
      ['redeem_invite', { p_code: 'ABCD2345' }],
      ['accept_link', { p_link_id: 'link-9' }],
      ['remove_link', { p_link_id: 'link-9' }],
      ['give_consent', { p_consent_id: 'consent-1' }],
      ['decline_consent', { p_consent_id: 'consent-1' }],
      ['withdraw_consent', { p_consent_id: 'consent-1' }],
      ['save_onboarding', { p_answers: expect.objectContaining({ first_name: 'Thabo' }) }],
    ])
  })

  it('turns a stable error code from a database function into an AppError', async () => {
    const { client } = fakeClient({
      rpc: () => ({ data: null, error: { message: 'rate_limited', code: 'P0001' } }),
    })
    await expect(createSupabaseRepository(client, user).redeemInvite('X')).rejects.toMatchObject({
      code: 'rate_limited',
    })
  })

  it('turns a failed invite try returned in the error column into an AppError', async () => {
    const { client } = fakeClient({
      rpc: () => ({ data: [{ link_id: null, error: 'code_expired' }], error: null }),
    })
    await expect(createSupabaseRepository(client, user).redeemInvite('ABCD')).rejects.toMatchObject(
      { code: 'code_expired' },
    )
  })

  it('maps unknown database errors and blocked rows', async () => {
    const unknown = fakeClient({ rpc: () => ({ data: null, error: { message: 'boom' } }) })
    await expect(createSupabaseRepository(unknown.client, user).getFamily()).rejects.toMatchObject({
      code: 'unknown',
    })
    const blocked = fakeClient({
      rpc: () => ({ data: null, error: { message: 'permission denied', code: '42501' } }),
    })
    await expect(createSupabaseRepository(blocked.client, user).getFamily()).rejects.toMatchObject({
      code: 'not_allowed',
    })
  })

  it('maps my_library and my_family rows', async () => {
    const { client } = fakeClient({
      rpc: (fn) =>
        fn === 'my_library'
          ? {
              data: [
                {
                  file_id: 'f1',
                  kind: 'book',
                  language: 'af',
                  title_en: 'Book',
                  title_af: 'Boek',
                  size_bytes: 1000,
                  min_tier: 'r99',
                  unlocked: false,
                },
              ],
              error: null,
            }
          : {
              data: [
                {
                  link_id: 'l1',
                  other_user_id: 'u2',
                  other_first_name: 'Nomsa',
                  relation: 'parent',
                  status: 'pending',
                  waiting_on_me: true,
                  consent_id: 'consent-7',
                },
              ],
              error: null,
            },
    })
    const repository = createSupabaseRepository(client, user)
    expect(await repository.getLibrary()).toEqual([
      {
        fileId: 'f1',
        kind: 'book',
        language: 'af',
        title: { en: 'Book', af: 'Boek' },
        sizeBytes: 1000,
        minTier: 'r99',
        unlocked: false,
      },
    ])
    expect(await repository.getFamily()).toEqual([
      {
        linkId: 'l1',
        otherUserId: 'u2',
        otherFirstName: 'Nomsa',
        relation: 'parent',
        status: 'pending',
        waitingOnMe: true,
        consentId: 'consent-7',
      },
    ])
  })

  it('calls the edge functions with the contract bodies', async () => {
    const { client, raw } = fakeClient({
      invoke: (fn) =>
        fn === 'request-consent'
          ? { data: { consent_id: 'c1', sent: false }, error: null }
          : { data: { url: 'https://signed', expires_in: 300 }, error: null },
    })
    const repository = createSupabaseRepository(client, user)
    expect(await repository.requestConsent('mom@example.com')).toEqual({
      consentId: 'c1',
      sent: false,
    })
    expect(await repository.getDownloadLink('f1')).toEqual({
      url: 'https://signed',
      expiresIn: 300,
    })
    expect(raw.functions.invoke.mock.calls).toEqual([
      ['request-consent', { body: { channel: 'email', contact: 'mom@example.com' } }],
      ['library-download', { body: { file_id: 'f1' } }],
    ])
  })

  it('reads the error code and purchase reference from an edge function', async () => {
    const response = new Response(
      JSON.stringify({ error: 'not_allowed', purchase_ref: 'PF-123' }),
      {
        status: 403,
      },
    )
    const { client } = fakeClient({
      invoke: () => ({ data: null, error: new FunctionsHttpError(response) }),
    })
    const failure = await createSupabaseRepository(client, user)
      .getDownloadLink('f1')
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(AppError)
    expect(failure).toMatchObject({ code: 'not_allowed', purchaseRef: 'PF-123' })
  })

  it('reports a network failure from an edge function', async () => {
    const { client } = fakeClient({
      invoke: () => ({
        data: null,
        error: new FunctionsFetchError(new TypeError('Failed to fetch')),
      }),
    })
    await expect(
      createSupabaseRepository(client, user).requestConsent('mom@example.com'),
    ).rejects.toMatchObject({ code: 'network' })
  })

  it('builds the profile from the profile, subject and exam date tables', async () => {
    const { client, calls } = fakeClient({
      tables: {
        profiles: {
          data: {
            id: 'user-1',
            first_name: 'Lindiwe',
            grade: 12,
            province: 'KZN',
            school_name_other: null,
            school: { id: 's1', name: 'A School', province: 'KZN' },
          },
          error: null,
        },
        learner_subjects: {
          data: [
            {
              target_mark: 80,
              subject: { id: 'm', code: 'MATH', name_en: 'Mathematics', name_af: 'Wiskunde' },
            },
          ],
          error: null,
        },
        learner_exam_dates: { data: [{ kind: 'final', starts_on: '2027-10-25' }], error: null },
      },
    })
    const profile = await createSupabaseRepository(client, user).getProfile()
    expect(profile).toMatchObject({
      firstName: 'Lindiwe',
      province: 'KZN',
      school: { name: 'A School' },
      subjects: [{ code: 'MATH', targetMark: 80, name: { en: 'Mathematics', af: 'Wiskunde' } }],
      examDates: { trial: null, final: '2027-10-25' },
      isDemo: false,
    })
    expect(calls).toContainEqual({ table: 'profiles', method: 'eq', args: ['id', 'user-1'] })
    expect(calls).toContainEqual({
      table: 'learner_exam_dates',
      method: 'is',
      args: ['subject_id', null],
    })
  })

  it('saves the profile in one update_profile call and writes no table directly', async () => {
    const { client, raw, calls } = fakeClient({
      tables: {
        profiles: {
          data: {
            id: 'user-1',
            first_name: 'Thabo',
            grade: 12,
            province: 'GP',
            school_name_other: 'My School',
            school: null,
          },
          error: null,
        },
      },
    })
    const saved = await createSupabaseRepository(client, user).updateProfile({
      firstName: 'Thabo',
      grade: 12,
      province: 'GP',
      schoolId: 'school-1',
      schoolNameOther: ' My School ',
      subjects: [{ code: 'MATH', targetMark: 70 }],
      examDates: { trial: '2027-08-23', final: null },
    })

    expect(raw.rpc.mock.calls).toEqual([
      [
        'update_profile',
        {
          p_changes: {
            first_name: 'Thabo',
            grade: 12,
            province: 'GP',
            school_id: null,
            school_name_other: 'My School',
            subjects: [{ code: 'MATH', target_mark: 70 }],
            exam_dates: [{ kind: 'trial', date: '2027-08-23' }],
          },
        },
      ],
    ])
    const writes = calls.filter((call) =>
      ['update', 'delete', 'insert', 'upsert'].includes(call.method),
    )
    expect(writes).toEqual([])
    expect(saved.firstName).toBe('Thabo')
  })

  it('leaves out an empty province, keeps a listed school and sends empty lists', async () => {
    const { client, raw } = fakeClient({
      tables: {
        profiles: {
          data: {
            id: 'user-1',
            first_name: 'T',
            grade: 11,
            province: null,
            school_name_other: null,
            school: null,
          },
          error: null,
        },
      },
    })
    await createSupabaseRepository(client, user).updateProfile({
      firstName: 'T',
      grade: 11,
      province: null,
      schoolId: 'school-1',
      schoolNameOther: null,
      subjects: [],
      examDates: { trial: null, final: null },
    })
    expect(raw.rpc).toHaveBeenCalledWith('update_profile', {
      p_changes: {
        first_name: 'T',
        grade: 11,
        school_id: 'school-1',
        school_name_other: null,
        subjects: [],
        exam_dates: [],
      },
    })
  })

  it('saves nothing else and passes the error on when update_profile refuses', async () => {
    const { client, raw } = fakeClient({
      rpc: () => ({ data: null, error: { message: 'invalid_input', code: 'P0001' } }),
    })
    await expect(
      createSupabaseRepository(client, user).updateProfile({
        firstName: 'Thabo',
        grade: 12,
        province: 'GP',
        schoolId: null,
        schoolNameOther: null,
        subjects: [],
        examDates: { trial: null, final: null },
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(raw.from).not.toHaveBeenCalled()
  })
})
