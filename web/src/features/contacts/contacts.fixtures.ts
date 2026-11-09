/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contact } from '../../types/domain';

export const INITIAL_CONTACT_DIRECTORY: Contact[] = [
  {
    id: 'cnt-01',
    name: 'Carlos Homelab',
    alias: 'Carlos Homelab',
    phone: '+5511988887777',
    role: 'Root Operator',
    tags: ['admin', 'infra', 'alerts'],
    active_jobs: 3,
    created_at: '2026-08-10T12:00:00Z',
    updated_at: '2026-11-04T10:15:00Z',
    last_dispatch: '12m ago',
    active: true,
  },
  {
    id: 'cnt-02',
    name: 'Mariana Costa',
    alias: 'Mariana Costa',
    phone: '+5521977776666',
    role: 'Primary Resident',
    tags: ['family', 'routine'],
    active_jobs: 1,
    created_at: '2026-09-01T15:30:00Z',
    updated_at: '2026-10-28T09:40:00Z',
    last_dispatch: '2h ago',
    active: true,
  },
  {
    id: 'cnt-03',
    name: 'Alerts Bot Gateway',
    alias: 'Alerts Bot Gateway',
    phone: '+5511900000000',
    role: 'Webhook Forwarder',
    tags: ['pager', 'alerts', 'system'],
    active_jobs: 12,
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-11-08T18:00:00Z',
    last_dispatch: '1m ago',
    active: true,
  },
  {
    id: 'cnt-04',
    name: 'Test Recipient (Staging)',
    alias: 'Test Recipient (Staging)',
    phone: '+5511912345678',
    role: 'QA Verification',
    tags: ['test', 'staging'],
    active_jobs: 0,
    created_at: '2026-10-20T19:45:00Z',
    updated_at: '2026-10-20T19:45:00Z',
    last_dispatch: 'Never',
    active: true,
  },
];

export function getContactInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export function getAvatarColorClass(id: string): string {
  const colors = [
    'bg-sky-500/10 text-sky-500 border-sky-500/20',
    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'bg-rose-500/10 text-rose-500 border-rose-500/20',
  ];
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return colors[sum % colors.length];
}
