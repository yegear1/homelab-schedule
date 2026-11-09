/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CalendarClock,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  AlarmClock,
  FileCode,
  Database,
} from 'lucide-react';
import { JobSource, JobStatus } from '../types/domain';

export interface StatusBadgeProps {
  status: JobStatus;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function StatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: StatusBadgeProps) {
  const iconSize = size === 'sm' ? 12 : 14;

  switch (status) {
    case 'scheduled':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap shrink-0 transition-colors ${
            size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
          } bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20`}
        >
          {showIcon && <CalendarClock size={iconSize} className="shrink-0" />}
          <span className="capitalize">Scheduled</span>
        </span>
      );
    case 'done':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap shrink-0 transition-colors ${
            size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
          } bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`}
        >
          {showIcon && <CheckCircle2 size={iconSize} className="shrink-0" />}
          <span className="capitalize">Done</span>
        </span>
      );
    case 'paused':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap shrink-0 transition-colors ${
            size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
          } bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`}
        >
          {showIcon && <PauseCircle size={iconSize} className="shrink-0" />}
          <span className="capitalize">Paused</span>
        </span>
      );
    case 'error':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap shrink-0 transition-colors ${
            size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
          } bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`}
        >
          {showIcon && <AlertTriangle size={iconSize} className="shrink-0" />}
          <span className="capitalize">Error</span>
        </span>
      );
    case 'snoozed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap shrink-0 transition-colors ${
            size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
          } bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20`}
        >
          {showIcon && <AlarmClock size={iconSize} className="shrink-0" />}
          <span className="capitalize">Snoozed</span>
        </span>
      );
    default:
      return null;
  }
}

export interface SourceBadgeProps {
  source: JobSource;
  size?: 'sm' | 'md';
}

export function SourceBadge({ source, size = 'sm' }: SourceBadgeProps) {
  const iconSize = size === 'sm' ? 11 : 13;

  if (source === 'yaml') {
    return (
      <span
        title="Managed via routines.yaml (immutable in SQLite)"
        className={`inline-flex items-center gap-1 font-mono font-medium border rounded-md whitespace-nowrap shrink-0 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
        } bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20`}
      >
        <FileCode size={iconSize} className="shrink-0" />
        <span>yaml</span>
      </span>
    );
  }

  return (
    <span
      title="Dynamic record stored in SQLite"
      className={`inline-flex items-center gap-1 font-mono font-medium border rounded-md whitespace-nowrap shrink-0 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      } bg-muted text-muted-foreground border-border`}
    >
      <Database size={iconSize} className="shrink-0" />
      <span>sqlite</span>
    </span>
  );
}
