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
