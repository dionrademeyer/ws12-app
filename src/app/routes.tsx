import { Navigate, type RouteObject } from 'react-router-dom'
import { RequireSession } from '../auth/RequireSession'
import { DashboardScreen } from '../features/dashboard/DashboardScreen'
import { PlannedScreen } from '../features/planned/PlannedScreen'
import { WelcomeScreen } from '../features/welcome/WelcomeScreen'
import { FullPage } from '../ui/FullPage'
import { AppShell } from './AppShell'
import {
  AccountGateScreen,
  AgeScreen,
  AuthCallbackScreen,
  ConsentScreen,
  FamilyScreen,
  ForgotPasswordScreen,
  LibraryScreen,
  NotFoundScreen,
  NotificationsScreen,
  OnboardingScreen,
  ParentConsentScreen,
  ProfileScreen,
  RegisterScreen,
  ResetPasswordScreen,
  SettingsScreen,
  SignInScreen,
  VerifyEmailScreen,
} from './lazyScreens'
import { dashboardPath } from './navigation'

export const routes: RouteObject[] = [
  { path: '/', element: <WelcomeScreen /> },
  {
    element: <FullPage />,
    children: [
      { path: '/signin', element: <SignInScreen /> },
      { path: '/register', element: <RegisterScreen /> },
      { path: '/verify-email', element: <VerifyEmailScreen /> },
      { path: '/forgot-password', element: <ForgotPasswordScreen /> },
      { path: '/reset-password', element: <ResetPasswordScreen /> },
      { path: '/auth/callback', element: <AuthCallbackScreen /> },
      { path: '/consent/:consentId', element: <ParentConsentScreen /> },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      {
        element: <FullPage />,
        children: [
          { path: '/start', element: <AccountGateScreen /> },
          { path: '/start/age', element: <AgeScreen /> },
          { path: '/start/consent', element: <ConsentScreen /> },
          { path: '/start/onboarding', element: <OnboardingScreen /> },
        ],
      },
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
          { path: 'library', element: <LibraryScreen /> },
          { path: 'family', element: <FamilyScreen /> },
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
