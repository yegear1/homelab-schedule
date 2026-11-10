/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
