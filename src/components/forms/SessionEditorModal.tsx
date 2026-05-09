import { useMemo, useState } from 'react'
import {
  Palette,
  Server,
  Settings2,
} from 'lucide-react'

import { getDefaultPort } from '../../lib/sessionUtils'
import type { SessionDefinition, SessionDraft } from '../../types/domain'
import {
  SessionEditorAdvancedTab,
  SessionEditorConnectionTab,
  SessionEditorGeneralTab,
  SessionEditorTerminalTab,
} from './SessionEditorTabs'
import { SESSION_KIND_OPTIONS } from './sessionKindOptions'
import { useSystemFonts, useX11Support } from './sessionEditorHooks'
import {
  createDraft,
  supportsAdvancedTab,
  supportsConnectionTab,
  tabDescription,
  validateSessionDraft,
  type SessionEditorTab,
} from './sessionEditorHelpers'

interface SessionEditorModalProps {
  open: boolean
  session: SessionDefinition | null
  initialFolderPath?: string
  folderOptions: string[]
  onClose: () => void
  onSave: (draft: SessionDraft) => Promise<void>
}

const EDITOR_TABS: Array<{
  id: SessionEditorTab
  label: string
  icon: typeof Settings2
}> = [
  { id: 'connection', label: 'Connection', icon: Server },
  { id: 'terminal', label: 'Terminal', icon: Palette },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
]

export function SessionEditorModal({
  open,
  session,
  initialFolderPath,
  folderOptions,
  onClose,
  onSave,
}: SessionEditorModalProps) {
  if (!open) {
    return null
  }

  const editorKey = `${session?.id ?? 'new'}:${initialFolderPath ?? ''}`
  return (
    <SessionEditorModalContent
      key={editorKey}
      open={open}
      session={session}
      initialFolderPath={initialFolderPath}
      folderOptions={folderOptions}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function SessionEditorModalContent({
  open,
  session,
  initialFolderPath,
  folderOptions,
  onClose,
  onSave,
}: SessionEditorModalProps) {
  const isMacOS = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
  const [draft, setDraft] = useState<SessionDraft>(createDraft(session, initialFolderPath))
  const [activeTab, setActiveTab] = useState<SessionEditorTab>('connection')
  const [saveError, setSaveError] = useState('')
  const {
    busy: systemFontsBusy,
    error: systemFontsError,
    fonts: systemFonts,
  } = useSystemFonts(open)
  const {
    busy: x11SupportBusy,
    error: x11SupportError,
    inspect: checkX11Support,
    support: x11Support,
  } = useX11Support(open, draft)

  const normalizedFolderOptions = useMemo(
    () =>
      Array.from(new Set([...(draft.folderPath ? [draft.folderPath] : []), ...folderOptions])).sort((left, right) =>
        left.localeCompare(right),
      ),
    [draft.folderPath, folderOptions],
  )

  const x11DisplayPlaceholder =
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')
      ? '127.0.0.1:0.0'
      : 'Auto-detect from DISPLAY'
  const x11NeedsInstallHelp = draft.x11Forwarding && x11Support !== null && !x11Support.systemX11Available
  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')
  const recommendedGuiHelperName = isMacOS ? 'XQuartz' : isWindows ? 'VcXsrv' : 'X.Org'
  const recommendedGuiHelperUrl = isMacOS
    ? 'https://www.xquartz.org/'
    : isWindows
      ? 'https://vcxsrv.com/'
      : 'https://www.x.org/wiki/'
  const visibleTabs = EDITOR_TABS.filter((tab) => {
    if (tab.id === 'connection') {
      return supportsConnectionTab(draft.kind)
    }
    if (tab.id === 'advanced') {
      return supportsAdvancedTab(draft.kind)
    }
    return true
  })
  const resolvedActiveTab = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : visibleTabs[0]?.id ?? 'connection'
  const activeKind = SESSION_KIND_OPTIONS.find((option) => option.kind === draft.kind) ?? SESSION_KIND_OPTIONS[0]

  function updateDraft(patch: Partial<SessionDraft>) {
    setSaveError('')
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleKindChange(kind: SessionDraft['kind']) {
    updateDraft({
      kind,
      port: getDefaultPort(kind),
      host: kind === 'local' ? '' : draft.host,
      username: kind === 'local' ? '' : draft.username,
      authType: kind === 'local' ? 'none' : draft.authType,
    })
  }

  async function handleSubmit() {
    const validationError = validateSessionDraft(draft)
    if (validationError) {
      setSaveError(validationError.message)
      setActiveTab(validationError.tab)
      return
    }

    setSaveError('')
    try {
      await onSave(draft)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    }
  }

  function renderGeneralTab() {
    return (
      <SessionEditorGeneralTab
        draft={draft}
        normalizedFolderOptions={normalizedFolderOptions}
        updateDraft={updateDraft}
      />
    )
  }

  function renderConnectionTab() {
    return (
      <SessionEditorConnectionTab
        draft={draft}
        updateDraft={updateDraft}
      />
    )
  }

  function renderTerminalTab() {
    return (
      <SessionEditorTerminalTab
        draft={draft}
        systemFonts={systemFonts}
        systemFontsBusy={systemFontsBusy}
        systemFontsError={systemFontsError}
        updateDraft={updateDraft}
      />
    )
  }

  function renderAdvancedTab() {
    return (
      <SessionEditorAdvancedTab
        draft={draft}
        isMacOS={isMacOS}
        recommendedGuiHelperName={recommendedGuiHelperName}
        recommendedGuiHelperUrl={recommendedGuiHelperUrl}
        x11DisplayPlaceholder={x11DisplayPlaceholder}
        x11NeedsInstallHelp={x11NeedsInstallHelp}
        x11Support={x11Support}
        x11SupportBusy={x11SupportBusy}
        x11SupportError={x11SupportError}
        onCheckX11Support={() => void checkX11Support()}
        updateDraft={updateDraft}
      />
    )
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel session-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-heading">
            <h2 id="session-editor-title">{session ? 'Edit session' : 'New session'}</h2>
            <p className="modal-subtitle">
              {activeKind.label} profile with connection, terminal, and advanced settings.
            </p>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form
          className="editor-form session-editor-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="session-editor-body">
            <aside className="session-editor-side" aria-label="Session profile">
              {renderGeneralTab()}
              <div className="session-editor-side-title">Type</div>
              <div className="session-editor-kind-strip" role="radiogroup" aria-label="Session type">
                {SESSION_KIND_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const selected = draft.kind === option.kind
                  return (
                    <button
                      key={option.kind}
                      className={`session-editor-kind-pill ${selected ? 'active' : ''}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      title={option.note}
                      onClick={() => handleKindChange(option.kind)}
                    >
                      <span className="session-editor-kind-icon">
                        <Icon size={15} />
                      </span>
                      <span className="session-editor-kind-copy">
                        <strong>{option.label}</strong>
                        <span>{option.note}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="session-editor-main" aria-label="Session settings">
              <div className="session-editor-tabstrip" role="tablist" aria-label="Session settings tabs">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  const selected = tab.id === resolvedActiveTab
                  return (
                    <button
                      key={tab.id}
                      className={`session-editor-tab ${selected ? 'active' : ''}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="session-editor-tab-meta">
                <strong>{visibleTabs.find((tab) => tab.id === resolvedActiveTab)?.label}</strong>
                <span>{tabDescription(resolvedActiveTab, draft.kind)}</span>
              </div>

              <div className="session-editor-scroll">
                {resolvedActiveTab === 'connection' && renderConnectionTab()}
                {resolvedActiveTab === 'terminal' && renderTerminalTab()}
                {resolvedActiveTab === 'advanced' && renderAdvancedTab()}

                {saveError && (
                  <div className="session-editor-error" role="alert" aria-live="polite">
                    {saveError}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="modal-actions">
            <div className="session-editor-action-note">
              {activeKind.label}
            </div>
            <button className="ghost-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="solid-button" type="submit">
              Save session
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
