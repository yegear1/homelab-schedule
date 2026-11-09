/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { JobRun } from '../../types/domain';

export const INITIAL_AUDIT_RUNS: JobRun[] = [
  {
    id: 'run-101',
    job_id: 'job-02',
    job_title: 'Morning Smart Home Briefing',
    recipient: '+5511988887777',
    timestamp: '2026-11-08 08:00:02',
    relative_time: '10 hours ago',
    trigger_mode: 'scheduled',
    status_code: 202,
    status: 'success',
    duration_ms: 135,
    payload_preview: 'Good morning Carlos! Outdoor temp: 19.4°C, solar generation 4.8 kWh...',
    rendered_payload: 'Good morning Carlos! Outdoor temp: 19.4°C, solar generation 4.8 kWh, 3 scheduled routines today. Battery state: 78% SoC.',
    response_headers: {
      'content-type': 'application/json',
      'x-gateway-dispatch-id': 'dsp-98a2-11ef-93a0',
      'x-ratelimit-remaining': '994',
      'x-upstream-latency-ms': '112',
    },
  },
  {
    id: 'run-102',
    job_id: 'job-03',
    job_title: 'Immediate Alert Test',
    recipient: '+5521977776666',
    timestamp: '2026-11-08 14:15:30',
    relative_time: '4 hours ago',
    trigger_mode: 'manual',
    status_code: 202,
    status: 'success',
    duration_ms: 210,
    payload_preview: '🔔 Manual Operator Test: WhatsApp bridge echo verification dispatch.',
    rendered_payload: '🔔 Manual Operator Test: WhatsApp bridge echo verification dispatch. Triggered from Homelab Control Plane.',
    response_headers: {
      'content-type': 'application/json',
      'x-gateway-dispatch-id': 'dsp-cc41-11ef-93b5',
      'x-ratelimit-remaining': '993',
      'x-upstream-latency-ms': '185',
    },
  },
  {
    id: 'run-103',
    job_id: 'job-01',
    job_title: 'Server Disk Space Warning',
    recipient: '+5511988887777',
    timestamp: '2026-11-08 18:30:00',
    relative_time: '15 mins ago',
    trigger_mode: 'scheduled',
    status_code: 502,
    status: 'failed',
    duration_ms: 5004,
    payload_preview: 'Warning: Volume /mnt/nvme-pool has reached 91.4% capacity (870GB free of 9.2TB)...',
    rendered_payload: 'Warning: Volume /mnt/nvme-pool has reached 91.4% capacity (870GB free of 9.2TB). Immediate pruning recommended.',
    error_message: 'Gateway connection timeout (502): wa-bridge downstream unreachable after 5000ms',
    stack_trace: `httpx.ConnectTimeout: Connection to http://wa-bridge:8080/v1/messages timed out after 5.0 seconds.
  File "/usr/local/lib/python3.12/site-packages/homelab_schedule/gateway.py", line 142, in dispatch_http
    response = client.post(endpoint, json=payload, headers=auth_headers)
  File "/usr/local/lib/python3.12/site-packages/httpx/_client.py", line 1148, in post`,
    response_headers: {
      'content-type': 'application/json',
      'x-error-code': 'ERR_DOWNSTREAM_TIMEOUT',
      'x-gateway-status': '502 Bad Gateway',
    },
  },
  {
    id: 'run-104',
    job_id: 'job-10',
    job_title: 'ZFS Pool Scrub Verification Alert',
    recipient: '+5511900000000',
    timestamp: '2026-11-08 15:00:12',
    relative_time: '3 hours ago',
    trigger_mode: 'scheduled',
    status_code: 422,
    status: 'failed',
    duration_ms: 89,
    payload_preview: 'Scrub alert: Node storage-z2 reported unresolved template parameter {{target_pool}}.',
    rendered_payload: 'Scrub alert: Node storage-z2 reported unresolved template parameter {{target_pool}}.',
    error_message: '422 Validation Error: Unresolved variable {{target_pool}} in template tpl-alert-v1',
    stack_trace: `ValidationError: Missing required parameter 'target_pool' for template schema.
  File "/app/dispatch/renderer.py", line 58, in render_template_strict
    raise ParameterMissingError(f"Token '{token}' not present in job variables.")`,
    response_headers: {
      'content-type': 'application/json',
      'x-error-reason': 'SCHEMA_VALIDATION_FAILED',
    },
  },
  {
    id: 'run-105',
    job_id: 'job-05',
    job_title: 'Daily Database Snapshot',
    recipient: '+5511988887777',
    timestamp: '2026-11-07 23:00:04',
    relative_time: '19 hours ago',
    trigger_mode: 'scheduled',
    status_code: 202,
    status: 'success',
    duration_ms: 168,
    payload_preview: '📦 Automated routine: Daily SQLite dispatch DB snapshot archived and SHA-256 verified.',
    rendered_payload: '📦 Automated routine: Daily SQLite dispatch DB snapshot archived and SHA-256 verified.',
    response_headers: {
      'content-type': 'application/json',
      'x-gateway-dispatch-id': 'dsp-1102-11ef-8890',
      'x-ratelimit-remaining': '998',
    },
  },
  {
    id: 'run-106',
    job_id: 'job-04',
    job_title: 'Weekly Standup Reminder',
    recipient: '+5511999990001',
    timestamp: '2026-11-08 17:45:00',
    relative_time: '1 hour ago',
    trigger_mode: 'manual',
    status_code: 202,
    status: 'success',
    duration_ms: 142,
    payload_preview: '🔔 Reminder: Homelab Sprint sync in 15 minutes on Discord Voice #ops.',
    rendered_payload: '🔔 Reminder: Homelab Sprint sync in 15 minutes on Discord Voice #ops. Agenda: Storage upgrades & Router config.',
    response_headers: {
      'content-type': 'application/json',
      'x-gateway-dispatch-id': 'dsp-ff01-11ef-93e8',
      'x-ratelimit-remaining': '995',
    },
  },
];
