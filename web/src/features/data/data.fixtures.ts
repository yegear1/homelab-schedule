/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SystemIntegrityReport {
  status: 'ok' | 'degraded' | 'corrupt';
  db_size_bytes: number;
  db_size_formatted: string;
  journal_mode: string;
  page_size: number;
  page_count: number;
  integrity_check: string;
  foreign_key_violations: number;
  active_wal_frames: number;
  last_checkpoint: string;
}

export const INITIAL_INTEGRITY_REPORT: SystemIntegrityReport = {
  status: 'ok',
  db_size_bytes: 4404019,
  db_size_formatted: '4.2 MB',
  journal_mode: 'WAL',
  page_size: 4096,
  page_count: 1075,
  integrity_check: 'ok',
  foreign_key_violations: 0,
  active_wal_frames: 42,
  last_checkpoint: '2026-11-08 18:00:00 (passive)',
};

export interface SampleJsonBundle {
  schema_version: string;
  exported_at: string;
  environment: string;
  generator: string;
  stats: {
    contacts_count: number;
    templates_count: number;
    jobs_count: number;
    runs_count: number;
  };
}

export const SAMPLE_JSON_BUNDLE: SampleJsonBundle = {
  schema_version: '1.4.0',
  exported_at: '2026-11-08T18:30:00Z',
  environment: 'homelab-production',
  generator: 'homelab-schedule/v2.1',
  stats: {
    contacts_count: 4,
    templates_count: 4,
    jobs_count: 9,
    runs_count: 140,
  },
};
