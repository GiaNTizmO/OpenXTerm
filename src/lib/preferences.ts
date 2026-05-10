import type { StatusBarMetrics, StatusBarSize, UiPreferences } from '../types/domain'

const STATUS_BAR_SIZES = new Set<StatusBarSize>(['compact', 'regular', 'large'])

export const DEFAULT_STATUS_BAR_METRICS: StatusBarMetrics = {
  host: true,
  user: true,
  cpu: true,
  memory: true,
  disk: true,
  networkDown: true,
  networkUp: true,
  uptime: true,
}

export function clampSidebarWidth(width: number) {
  return Math.min(840, Math.max(220, Math.round(width)))
}

export function normalizeStatusBarSize(size: UiPreferences['statusBarSize']): StatusBarSize {
  return size && STATUS_BAR_SIZES.has(size) ? size : 'regular'
}

export function normalizeStatusBarMetrics(metrics: UiPreferences['statusBarMetrics']): StatusBarMetrics {
  return {
    ...DEFAULT_STATUS_BAR_METRICS,
    ...metrics,
  }
}

export function normalizeUiPreferences(preferences: UiPreferences): UiPreferences {
  return {
    theme: 'dark',
    activeSidebar: preferences.activeSidebar,
    sidebarWidth: clampSidebarWidth(preferences.sidebarWidth ?? 252),
    statusBarVisible: preferences.statusBarVisible ?? true,
    statusBarSize: normalizeStatusBarSize(preferences.statusBarSize),
    statusBarMetrics: normalizeStatusBarMetrics(preferences.statusBarMetrics),
  }
}
