import { create } from 'zustand'

import {
  bootstrapState,
  savePreferences,
} from '../lib/bridge'
import {
  DEFAULT_STATUS_BAR_METRICS,
  clampSidebarWidth,
  normalizeUiPreferences,
} from '../lib/preferences'
import { createWelcomeTab } from '../lib/sessionUtils'
import {
  sortMacros,
  sortSessionFolders,
  sortSessions,
} from './openXTermStoreHelpers'
import { createDomainActions } from './openXTermStoreDomain'
import {
  clearCompletedTransferItems,
  enqueueTransferItem,
} from './openXTermStoreTransfers'
import { createTabActions } from './openXTermStoreTabActions'
import { createTerminalActions } from './openXTermStoreTerminalActions'
import { ensureTransportListeners } from './openXTermStoreListeners'
import type { OpenXTermState } from './openXTermStoreTypes'

export type { SessionImportSummary } from './openXTermStoreTypes'

export const useOpenXTermStore = create<OpenXTermState>((set, get) => ({
  initialized: false,
  sessions: [],
  sessionFolders: [],
  macros: [],
  preferences: {
    theme: 'dark',
    activeSidebar: 'sessions',
    sidebarWidth: 252,
    statusBarVisible: true,
    statusBarSize: 'regular',
    statusBarMetrics: { ...DEFAULT_STATUS_BAR_METRICS },
  },
  tabs: [createWelcomeTab()],
  activeTabId: 'welcome',
  terminalFeeds: {},
  terminalCwdByTabId: {},
  terminalStoppedByTabId: {},
  sessionStatusByTabId: {},
  sessionCpuHistoryByTabId: {},
  sessionMemoryHistoryByTabId: {},
  sessionNetworkDownHistoryByTabId: {},
  sessionNetworkUpHistoryByTabId: {},
  transferItems: {},
  transferModalDismissed: false,
  async initialize() {
    if (get().initialized) {
      return
    }

    await ensureTransportListeners(set)
    const bootstrap = await bootstrapState()
    set({
      initialized: true,
      sessions: sortSessions(bootstrap.sessions),
      sessionFolders: sortSessionFolders(bootstrap.sessionFolders ?? []),
      macros: sortMacros(bootstrap.macros),
      preferences: normalizeUiPreferences(bootstrap.preferences),
      tabs: [createWelcomeTab()],
      activeTabId: 'welcome',
      terminalFeeds: {},
      terminalCwdByTabId: {},
      terminalStoppedByTabId: {},
      sessionStatusByTabId: {},
      sessionCpuHistoryByTabId: {},
      sessionMemoryHistoryByTabId: {},
      sessionNetworkDownHistoryByTabId: {},
      sessionNetworkUpHistoryByTabId: {},
      transferItems: {},
      transferModalDismissed: false,
    })
  },
  async updatePreferences(preferences) {
    const nextPreferences = normalizeUiPreferences(preferences)
    await savePreferences(nextPreferences)
    set({ preferences: nextPreferences })
  },
  async setSidebar(section) {
    const nextPreferences = { ...get().preferences, activeSidebar: section }
    await savePreferences(nextPreferences)
    set({ preferences: nextPreferences })
  },
  async setSidebarWidth(width) {
    const nextPreferences = {
      ...get().preferences,
      sidebarWidth: clampSidebarWidth(width),
    }
    await savePreferences(nextPreferences)
    set({ preferences: nextPreferences })
  },
  enqueueTransfer(item) {
    enqueueTransferItem(set, item)
  },
  dismissTransferModal() {
    set({ transferModalDismissed: true })
  },
  clearCompletedTransfers() {
    clearCompletedTransferItems(set)
  },
  ...createTabActions(set, get),
  ...createDomainActions(set, get),
  ...createTerminalActions(set, get),
}))
