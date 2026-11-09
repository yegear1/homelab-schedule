/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Template } from '../../types/domain';

export const INITIAL_STUDIO_TEMPLATES: Template[] = [
  {
    id: 'tpl-01',
    name: 'Daily Morning Greeting',
    content: '{{saudacao}}, {{name}}! Lembramos do seu compromisso hoje às {{time}}. Tenha um ótimo {{weekday}}!',
    body: '{{saudacao}}, {{name}}! Lembramos do seu compromisso hoje às {{time}}. Tenha um ótimo {{weekday}}!',
    variables: ['saudacao', 'name', 'time', 'weekday'],
    placeholders: ['saudacao', 'name', 'time', 'weekday'],
    category: 'routine',
    updated_at: '2026-11-01 09:15',
    jobs_count: 2, // Used to trigger 409 Conflict if deleted
  },
  {
    id: 'tpl-02',
    name: 'Server Alert Notification',
    content: '🚨 [HOMELAB ALERT] Serviço {{service}} apresentou falha às {{time}} de {{date}}. Status: {{status}}.',
    body: '🚨 [HOMELAB ALERT] Serviço {{service}} apresentou falha às {{time}} de {{date}}. Status: {{status}}.',
    variables: ['service', 'time', 'date', 'status'],
    placeholders: ['service', 'time', 'date', 'status'],
    category: 'alerts',
    updated_at: '2026-10-24 14:02',
    jobs_count: 1,
  },
  {
    id: 'tpl-03',
    name: 'Weekly Backup Confirmation',
    content: 'Backup semanal finalizado com sucesso em {{date_iso}}. Arquivos salvos: {{file_count}}.',
    body: 'Backup semanal finalizado com sucesso em {{date_iso}}. Arquivos salvos: {{file_count}}.',
    variables: ['date_iso', 'file_count'],
    placeholders: ['date_iso', 'file_count'],
    category: 'backup',
    updated_at: '2026-10-18 22:45',
    jobs_count: 0,
  },
  {
    id: 'tpl-04',
    name: 'Simple Ping',
    content: 'Homelab ping às {{hour}}:{{minute}}.',
    body: 'Homelab ping às {{hour}}:{{minute}}.',
    variables: ['hour', 'minute'],
    placeholders: ['hour', 'minute'],
    category: 'infra',
    updated_at: '2026-11-04 11:30',
    jobs_count: 0,
  },
];

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
