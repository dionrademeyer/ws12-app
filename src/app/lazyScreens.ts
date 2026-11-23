import { lazy } from 'react'

export const ProfileScreen = lazy(() =>
  import('../features/profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
)

export const SettingsScreen = lazy(() =>
  import('../features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)

export const NotificationsScreen = lazy(() =>
  import('../features/notifications/NotificationsScreen').then((m) => ({
    default: m.NotificationsScreen,
  })),
)

export const NotFoundScreen = lazy(() =>
  import('../features/not-found/NotFoundScreen').then((m) => ({ default: m.NotFoundScreen })),
)

export const SignInScreen = lazy(() =>
  import('../features/auth/SignInScreen').then((m) => ({ default: m.SignInScreen })),
)

export const RegisterScreen = lazy(() =>
  import('../features/register/RegisterScreen').then((m) => ({ default: m.RegisterScreen })),
)

export const VerifyEmailScreen = lazy(() =>
  import('../features/auth/VerifyEmailScreen').then((m) => ({ default: m.VerifyEmailScreen })),
)

export const ForgotPasswordScreen = lazy(() =>
  import('../features/auth/ForgotPasswordScreen').then((m) => ({
    default: m.ForgotPasswordScreen,
  })),
)

export const ResetPasswordScreen = lazy(() =>
  import('../features/auth/ResetPasswordScreen').then((m) => ({ default: m.ResetPasswordScreen })),
)

export const AuthCallbackScreen = lazy(() =>
  import('../features/auth/AuthCallbackScreen').then((m) => ({ default: m.AuthCallbackScreen })),
)

export const AccountGateScreen = lazy(() =>
  import('../features/start/AccountGateScreen').then((m) => ({ default: m.AccountGateScreen })),
)

export const AgeScreen = lazy(() =>
  import('../features/start/AgeScreen').then((m) => ({ default: m.AgeScreen })),
)

export const ConsentScreen = lazy(() =>
  import('../features/consent/ConsentScreen').then((m) => ({ default: m.ConsentScreen })),
)

export const ParentConsentScreen = lazy(() =>
  import('../features/consent/ParentConsentScreen').then((m) => ({
    default: m.ParentConsentScreen,
  })),
)

export const OnboardingScreen = lazy(() =>
  import('../features/onboarding/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
)
