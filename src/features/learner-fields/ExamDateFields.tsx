import type { LearnerExamDates } from '../../data/learner'
import { useI18n } from '../../i18n/useI18n'
import { TextField } from '../../ui/TextField'

interface ExamDateFieldsProps {
  value: LearnerExamDates
  onChange: (next: LearnerExamDates) => void
  error?: string | null
}

export function ExamDateFields({ value, onChange, error }: ExamDateFieldsProps) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={t('exams.trial')}
        type="date"
        value={value.trial ?? ''}
        onChange={(event) => onChange({ ...value, trial: event.target.value || null })}
      />
      <TextField
        label={t('exams.final')}
        type="date"
        value={value.final ?? ''}
        onChange={(event) => onChange({ ...value, final: event.target.value || null })}
        error={error}
      />
      <p className="rounded-2xl bg-gold/25 px-4 py-3 text-sm font-medium">
        {t('exams.provisional')}
      </p>
    </div>
  )
}
