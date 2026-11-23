import { useNavigate } from 'react-router-dom'
import { dashboardPath } from '../../app/navigation'
import { useSession } from '../../auth/useSession'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'

// Shown while no Supabase project is connected. The demo stays available.
export function NotSetUp() {
  const { t } = useI18n()
  const { enterDemo } = useSession()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-4">
      <Notice>{t('auth.notSetUp')}</Notice>
      <Button
        full
        onClick={() => {
          enterDemo()
          navigate(dashboardPath)
        }}
      >
        {t('welcome.tryDemo')}
      </Button>
    </div>
  )
}
