/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


export const BUILTIN_SYSTEM_TOKENS = [
  'greeting',
  'saudacao',
  'name',
  'time',
  'date',
  'weekday',
  'day_name',
  'month_name',
  'year',
  'date_iso',
  'hour',
  'minute',
];

export const SAMPLE_SIMULATION_VALUES: Record<string, string> = {
  name: 'Carlos',
  greeting: 'Good evening',
  saudacao: 'Boa noite',
  time: '18:32',
  date: '2026-11-08',
  date_iso: '2026-11-08T18:32:00Z',
  weekday: 'Sunday',
  day_name: 'Domingo',
  month_name: 'November',
  year: '2026',
  hour: '18',
  minute: '32',
  service: 'zfs-scrub-daemon',
  status: 'HTTP 502 Gateway Timeout',
  file_count: '1,420',
  custom_var: 'node-alpha-01',
};

export function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const unique = Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, '').trim())));
  return unique;
}
