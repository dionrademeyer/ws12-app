import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveLanguage } from '../domain/language'
import type { OnboardingAnswers } from '../domain/onboarding'
import type { SessionUser } from './auth'
import { AppError, isErrorCode } from './errors'
import type {
  AccountState,
  ConsentRequest,
  ConsentRequestSent,
  ConsentStatus,
  DownloadLink,
  FamilyLink,
  FamilyLinkStatus,
  Invite,
  InviteKind,
  LearnerExamDates,
  LearnerProfile,
  LearnerRepository,
  LibraryItem,
  LibraryKind,
  ProfileUpdate,
  SchoolOption,
  SubjectOption,
  SubjectSummary,
  Tier,
} from './learner'
import { fromFunctionError, fromPostgrestError } from './supabaseErrors'

interface SubjectRow {
  id: string
  code: string
  name_en: string
  name_af: string
}

interface ProfileRow {
  id: string
  first_name: string | null
  grade: number | null
  province: string | null
  school_name_other: string | null
  school: SchoolOption | null
}

interface AccountStateRow {
  is_adult: boolean | null
  consent_status: ConsentStatus
  roles: string[] | null
  onboarding_step: number | null
  onboarded: boolean
  language: string | null
}

interface LibraryRow {
  file_id: string
  kind: LibraryKind
  language: string
  title_en: string
  title_af: string
  size_bytes: number
  min_tier: Tier
  unlocked: boolean
}

interface FamilyRow {
  link_id: string
  other_user_id: string
  other_first_name: string | null
  relation: 'parent' | 'child'
  status: FamilyLinkStatus
  waiting_on_me: boolean
  consent_id: string | null
}

interface RedeemRow {
  link_id: string | null
  error: string | null
}

interface ConsentRequestRow {
  learner_first_name: string | null
  requested_at: string
  expires_at: string
  status: string
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

function toSubject(row: SubjectRow): SubjectOption {
  return { id: row.id, code: row.code, name: { en: row.name_en, af: row.name_af } }
}

// Characters with a meaning in PostgREST filters are dropped from free text search.
function searchPattern(query: string): string {
  return `%${query.replace(/[%_,()*\\]/g, ' ').trim()}%`
}

export function createSupabaseRepository(
  client: SupabaseClient,
  user: SessionUser,
): LearnerRepository {
  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.rpc(fn, args)
    if (error) throw fromPostgrestError(error)
    return data as T
  }

  async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.functions.invoke(fn, { body })
    if (error) throw await fromFunctionError(error)
    return data as T
  }

  function check(result: { error: unknown }) {
    if (result.error) throw fromPostgrestError(result.error as Record<string, unknown>)
  }

  async function getProfile(): Promise<LearnerProfile> {
    const [profile, subjects, exams] = await Promise.all([
      client
        .from('profiles')
        .select(
          'id, first_name, grade, province, school_name_other, school:schools(id, name, province)',
        )
        .eq('id', user.id)
        .single(),
      client
        .from('learner_subjects')
        .select('target_mark, subject:subjects(id, code, name_en, name_af)')
        .eq('learner_id', user.id),
      client
        .from('learner_exam_dates')
        .select('kind, starts_on')
        .eq('learner_id', user.id)
        .is('subject_id', null),
    ])
    check(profile)
    check(subjects)
    check(exams)

    const row = profile.data as unknown as ProfileRow
    const subjectRows = (subjects.data ?? []) as unknown as {
      target_mark: number | null
      subject: SubjectRow
    }[]
    const examRows = (exams.data ?? []) as { kind: 'trial' | 'final'; starts_on: string }[]

    const summaries: SubjectSummary[] = subjectRows
      .filter((entry) => entry.subject)
      .map((entry) => ({ ...toSubject(entry.subject), targetMark: entry.target_mark }))
      .sort((a, b) => a.name.en.localeCompare(b.name.en))

    return {
      id: row.id,
      firstName: row.first_name ?? '',
      grade: row.grade ?? 12,
      province: row.province,
      school: row.school,
      schoolNameOther: row.school_name_other,
      subjects: summaries,
      examDates: {
        trial: examRows.find((exam) => exam.kind === 'trial')?.starts_on ?? null,
        final: examRows.find((exam) => exam.kind === 'final')?.starts_on ?? null,
      },
      isDemo: false,
    }
  }

  // One checked call, so a failure part way never leaves half an edit saved. The database
  // accepts only the nine province codes, so an empty province is left as it is.
  async function updateProfile(update: ProfileUpdate): Promise<LearnerProfile> {
    const schoolNameOther = update.schoolNameOther?.trim() || null
    const changes: Record<string, unknown> = {
      first_name: update.firstName,
      grade: update.grade,
      school_id: schoolNameOther ? null : update.schoolId,
      school_name_other: schoolNameOther,
      subjects: update.subjects.map((subject) => ({
        code: subject.code,
        target_mark: subject.targetMark,
      })),
      exam_dates: (['trial', 'final'] as const).flatMap((kind) => {
        const date = update.examDates[kind]
        return date ? [{ kind, date }] : []
      }),
    }
    if (update.province) changes.province = update.province
    await rpc<void>('update_profile', { p_changes: changes })
    return getProfile()
  }

  return {
    isDemo: false,

    async getAccountState(): Promise<AccountState> {
      const row = firstRow(await rpc<AccountStateRow | AccountStateRow[]>('my_account_state'))
      if (!row) throw new AppError('not_found')
      return {
        isAdult: row.is_adult,
        consentStatus: row.consent_status,
        roles: row.roles ?? [],
        onboardingStep: row.onboarding_step ?? 0,
        onboarded: row.onboarded,
        language: resolveLanguage(row.language),
      }
    },

    declareAge: (isAdult) => rpc<void>('declare_age', { p_is_adult: isAdult }),
    claimParentRole: () => rpc<void>('claim_parent_role'),
    claimEntitlements: async () => (await rpc<number | null>('claim_entitlements')) ?? 0,
    setLanguage: (language) => rpc<void>('set_language', { p_language: language }),

    getProfile,
    updateProfile,

    async listSubjects(): Promise<SubjectOption[]> {
      const result = await client
        .from('subjects')
        .select('id, code, name_en, name_af')
        .order('name_en')
      check(result)
      return ((result.data ?? []) as SubjectRow[]).map(toSubject)
    },

    async searchSchools(query: string, province: string | null): Promise<SchoolOption[]> {
      let request = client.from('schools').select('id, name, province')
      if (province) request = request.eq('province', province)
      if (query.trim()) request = request.ilike('name', searchPattern(query))
      const result = await request.order('name').limit(20)
      check(result)
      return (result.data ?? []) as SchoolOption[]
    },

    async getExamCalendar(year: number): Promise<LearnerExamDates> {
      const result = await client
        .from('exam_dates')
        .select('kind, starts_on')
        .eq('year', year)
        .is('subject_id', null)
        .order('starts_on')
      check(result)
      const rows = (result.data ?? []) as { kind: 'trial' | 'final'; starts_on: string }[]
      return {
        trial: rows.find((row) => row.kind === 'trial')?.starts_on ?? null,
        final: rows.find((row) => row.kind === 'final')?.starts_on ?? null,
      }
    },

    saveOnboarding: (answers: OnboardingAnswers) =>
      rpc<void>('save_onboarding', { p_answers: answers }),

    async requestConsent(parentEmail: string): Promise<ConsentRequestSent> {
      const data = await invoke<{ consent_id: string; sent?: boolean }>('request-consent', {
        channel: 'email',
        contact: parentEmail,
      })
      return { consentId: data.consent_id, sent: data.sent === true }
    },

    async getConsentRequest(consentId: string): Promise<ConsentRequest> {
      const row = firstRow(
        await rpc<ConsentRequestRow | ConsentRequestRow[]>('consent_request_for_parent', {
          p_consent_id: consentId,
        }),
      )
      if (!row) throw new AppError('not_found')
      return {
        learnerFirstName: row.learner_first_name,
        requestedAt: row.requested_at,
        expiresAt: row.expires_at,
        status: row.status,
      }
    },

    async giveConsent(consentId: string) {
      await rpc<string>('give_consent', { p_consent_id: consentId })
    },
    declineConsent: (consentId) => rpc<void>('decline_consent', { p_consent_id: consentId }),
    withdrawConsent: (consentId) => rpc<void>('withdraw_consent', { p_consent_id: consentId }),

    async getLibrary(): Promise<LibraryItem[]> {
      const rows = (await rpc<LibraryRow[] | null>('my_library')) ?? []
      return rows.map((row) => ({
        fileId: row.file_id,
        kind: row.kind,
        language: resolveLanguage(row.language),
        title: { en: row.title_en, af: row.title_af },
        sizeBytes: row.size_bytes,
        minTier: row.min_tier,
        unlocked: row.unlocked,
      }))
    },

    async getDownloadLink(fileId: string): Promise<DownloadLink> {
      const data = await invoke<{ url: string; expires_in: number }>('library-download', {
        file_id: fileId,
      })
      return { url: data.url, expiresIn: data.expires_in }
    },

    async getFamily(): Promise<FamilyLink[]> {
      const rows = (await rpc<FamilyRow[] | null>('my_family')) ?? []
      return rows.map((row) => ({
        linkId: row.link_id,
        otherUserId: row.other_user_id,
        otherFirstName: row.other_first_name,
        relation: row.relation,
        status: row.status,
        waitingOnMe: row.waiting_on_me,
        consentId: row.consent_id ?? null,
      }))
    },

    async createInvite(kind: InviteKind): Promise<Invite> {
      const row = firstRow(
        await rpc<{ code: string; expires_at: string } | { code: string; expires_at: string }[]>(
          'create_invite',
          { p_kind: kind },
        ),
      )
      if (!row) throw new AppError('unknown')
      return { code: row.code, expiresAt: row.expires_at }
    },

    // Failed tries come back in the error column so the backend can count them for the limit.
    async redeemInvite(code: string): Promise<string> {
      const row = firstRow(
        await rpc<RedeemRow | RedeemRow[]>('redeem_invite', { p_code: code.trim().toUpperCase() }),
      )
      if (row?.error) throw new AppError(isErrorCode(row.error) ? row.error : 'unknown')
      if (!row?.link_id) throw new AppError('unknown')
      return row.link_id
    },
    acceptLink: (linkId) => rpc<void>('accept_link', { p_link_id: linkId }),
    removeLink: (linkId) => rpc<void>('remove_link', { p_link_id: linkId }),
  }
}
