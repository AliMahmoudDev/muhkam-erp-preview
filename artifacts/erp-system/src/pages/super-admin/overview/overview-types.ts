/* ── Local types shared by the overview dashboard sub-components ── */

export interface HealthData {
  health: { status: string; db: boolean; memory_mb: number; uptime_hours: number; db_read_latency_ms: number; db_write_latency_ms: number };
  metrics: { total_requests: number; status_codes: Record<string, number>; latency_ms: { p50: number; p95: number; p99: number; samples: number } };
  pool: { total: number; idle: number; waiting: number };
  memory: { heap_used_mb: number; rss_mb: number };
  process: { uptime_hours: number; node_version: string; pid: number; env: string };
  timestamp: string;
}

export interface OverviewAuditRow {
  id: number; action: string; record_type: string; record_id: number;
  user_id: number | null; username: string | null; note: string | null;
  company_id: number | null; created_at: string;
}

export type SettingsCard = 'support' | 'backup' | 'security' | 'audit_log' | 'managers' | 'plans' | 'telegram';

export interface ActionMeta { label: string; color: string }
