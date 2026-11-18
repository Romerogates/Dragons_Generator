import type { SupportTicket, SupportTicketThread } from '@core/models/support-ticket';

export interface AdminUserEdit {
  email: string;
  displayName: string;
  role: string;
  newPassword: string;
  emailConfirmed: boolean;
  disabled: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastLoginAt?: string;
  characterCount: number;
  passwordStatus: string;
  disabled?: boolean;
}

export type AdminTicket = SupportTicket;
export type TicketThread = SupportTicketThread;

export interface HostBackupFile {
  name: string;
  size: number;
  modified: string;
}

export interface InboxMail {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
}

export interface OpsEvent {
  id: string;
  kind: string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface CronRow {
  name: string;
  schedule: string;
  lastKind: string;
}

export interface OutboundEmail {
  id: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  htmlBody: string;
  status: string;
  error?: string | null;
  createdAt: string;
}

export interface Overview {
  users: number;
  confirmedUsers: number;
  campaigns: number;
  ticketsOpen: number;
  ticketsInProgress: number;
  ticketsClosed: number;
  remindersLast24h: number;
  lastBackup: OpsEvent | null;
  lastAlert: OpsEvent | null;
  recentOps: OpsEvent[];
  crons: CronRow[];
}

export interface AdminStatsKind {
  kind: string;
  total: number;
  ok: number;
  tokens: number;
}

export interface AdminStatsProvider {
  provider: string;
  total: number;
  ok: number;
  tokens: number;
}

export interface AdminServer {
  machineName: string;
  framework: string;
  osDescription: string;
  environmentName: string;
  startedAt: string;
  uptimeSeconds: number;
  cpuProcessPercent: number;
  threadCount: number;
  processorCount: number;
  workingSetBytes: number;
  privateMemoryBytes: number;
  gcHeapBytes: number;
  availableMemoryBytes: number | null;
  containerMemoryBytes: number | null;
  containerMemoryLimitBytes: number | null;
  hostMemoryTotalBytes: number | null;
  hostMemoryAvailableBytes: number | null;
  hostDiskTotalBytes: number | null;
  hostDiskAvailableBytes: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
}

export interface AdminHttpPath {
  path: string;
  count: number;
  errors: number;
  avgDurationMs: number;
}

export interface AdminHttpRecent {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  at: string;
}

export interface AdminHttp {
  requestsSinceStart: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  inFlight: number;
  topPaths: AdminHttpPath[];
  recent: AdminHttpRecent[];
}

export interface AdminSupportCategory {
  category: string;
  total: number;
  waitingOnStaff: number;
}

export interface AdminSupportDesk {
  open: number;
  inProgress: number;
  closed: number;
  waitingOnStaff: number;
  waitingOnPlayer: number;
  oldestWaitingHours: number | null;
  byCategory: AdminSupportCategory[];
}

export interface AdminStats {
  users: number;
  confirmedUsers: number;
  googleUsers: number;
  usersLast7Days: number;
  characters: number;
  charactersLast7Days: number;
  campaigns: number;
  campaignsActive: number;
  campaignsLast7Days: number;
  campaignMembers: number;
  dungeons: number;
  dungeonsLast7Days: number;
  friendshipsAccepted: number;
  friendMessages: number;
  supportTickets: number;
  supportMessages: number;
  guideComments: number;
  generations: number;
  generationsOk: number;
  generationsLast24h: number;
  generationsLast7Days: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokensLast24h: number;
  tokensLast7Days: number;
  generationsByKind: AdminStatsKind[];
  generationsByProvider: AdminStatsProvider[];
  server: AdminServer;
  http: AdminHttp;
  supportDesk: AdminSupportDesk;
}

export type AdminTab =
  | 'overview'
  | 'stats'
  | 'tickets'
  | 'ops'
  | 'mails'
  | 'users'
  | 'announcements'
  | 'patchnotes';

export const ADMIN_TABS: readonly AdminTab[] = [
  'overview',
  'stats',
  'tickets',
  'ops',
  'mails',
  'users',
  'announcements',
  'patchnotes',
];
