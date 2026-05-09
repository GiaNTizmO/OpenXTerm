import {
  Cable,
  HardDrive,
  Server,
  Terminal,
  Usb,
} from 'lucide-react'

import type { SessionKind } from '../../types/domain'

export const SESSION_KIND_OPTIONS: Array<{
  kind: SessionKind
  label: string
  note: string
  icon: typeof Server
}> = [
  { kind: 'local', label: 'Local', note: 'This computer', icon: Terminal },
  { kind: 'ssh', label: 'SSH', note: 'Shell access', icon: Server },
  { kind: 'telnet', label: 'Telnet', note: 'Legacy terminal', icon: Cable },
  { kind: 'serial', label: 'Serial', note: 'Direct line', icon: Usb },
  { kind: 'sftp', label: 'SFTP', note: 'Secure file browser', icon: HardDrive },
  { kind: 'ftp', label: 'FTP', note: 'File transfer', icon: HardDrive },
]
