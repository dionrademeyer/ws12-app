import { Navigate, type RouteObject } from 'react-router-dom'
import { RequireSession } from '../auth/RequireSession'
import { DashboardScreen } from '../features/dashboard/DashboardScreen'
import { PlannedScreen } from '../features/planned/PlannedScreen'
import { RegisterScreen } from '../features/register/RegisterScreen'
import { WelcomeScreen } from '../features/welcome/WelcomeScreen'
import { AppShell } from './AppShell'
import { NotFoundScreen, NotificationsScreen, ProfileScreen, SettingsScreen } from './lazyScreens'
import { dashboardPath } from './navigation'

export const routes: RouteObject[] = [
  { path: '/', element: <WelcomeScreen /> },
  { path: '/register', element: <RegisterScreen /> },
  {
    element: <RequireSession />,
    children: [
      {
        path: '/app',
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to={dashboardPath} replace /> },
          { path: 'dashboard', element: <DashboardScreen /> },
          { path: 'goals', element: <PlannedScreen titleKey="nav.goals" /> },
          { path: 'planner', element: <PlannedScreen titleKey="nav.planner" /> },
          { path: 'progress', element: <PlannedScreen titleKey="nav.progress" /> },
          { path: 'tutor', element: <PlannedScreen titleKey="nav.tutor" /> },
          { path: 'journey', element: <PlannedScreen titleKey="nav.journey" /> },
          { path: 'strategies', element: <PlannedScreen titleKey="nav.strategies" /> },
          { path: 'library', element: <PlannedScreen titleKey="nav.library" /> },
          { path: 'family', element: <PlannedScreen titleKey="menu.family" /> },
          { path: 'help', element: <PlannedScreen titleKey="menu.help" /> },
          { path: 'profile', element: <ProfileScreen /> },
          { path: 'settings', element: <SettingsScreen /> },
          { path: 'notifications', element: <NotificationsScreen /> },
          { path: '*', element: <NotFoundScreen /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
