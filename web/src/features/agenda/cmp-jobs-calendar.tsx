/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Job } from '../../types/domain';
import { StatusBadge } from '../../components/wdg-status-badge';

export interface JobsCalendarProps {
  jobs: Job[];
  onInspect: (jobId: string) => void;
}

export function JobsCalendar({ jobs, onInspect }: JobsCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<number>(8); // Default Nov 8, 2026
  const daysInMonth = 30; // November
  const firstDayOffset = 0; // Nov 1 2026 was Sunday

  // Map dummy distribution of scheduled jobs across November 2026 days
  const getJobsForDay = (day: number): Job[] => {
    return jobs.filter((job) => {
      if (job.status !== 'scheduled' && job.status !== 'snoozed') return false;
      // Spread across days based on id hash for calendar visualization
      const dayHash = (job.id.charCodeAt(job.id.length - 1) % 20) + 1;
      return dayHash === day || (job.cron_expr && day % 3 === 0);
    });
  };

  const selectedDayJobs = getJobsForDay(selectedDay);

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-xs space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-sky-500" />
          <h2 className="text-sm font-semibold text-foreground">
            November 2026 Schedule Dispatch Grid
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">Today: Nov 8, 2026</span>
          <div className="flex items-center border border-border rounded-lg bg-muted p-0.5">
            <button
              type="button"
              className="p-1 hover:bg-card rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="p-1 hover:bg-card rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 cols on large screen) */}
        <div className="lg:col-span-2">
          {/* Day of week labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[70px] p-1.5 rounded-lg bg-muted/10 opacity-30" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayJobs = getJobsForDay(day);
              const isSelected = selectedDay === day;
              const isToday = day === 8;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[72px] p-2 rounded-lg border text-left flex flex-col justify-between transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'border-sky-500 bg-sky-500/10 text-foreground ring-1 ring-sky-500'
                      : 'border-border bg-card hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-mono font-medium ${
                        isToday ? 'bg-sky-500 text-white rounded-full px-1.5 py-0.2' : ''
                      }`}
                    >
                      {day}
                    </span>
                    {dayJobs.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {dayJobs.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-1 overflow-hidden">
                    {dayJobs.slice(0, 3).map((j) => (
                      <div
                        key={j.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          j.kind === 'cron' ? 'bg-sky-500' : 'bg-emerald-500'
                        }`}
                        title={j.title}
                      />
                    ))}
                    {dayJobs.length > 3 && (
                      <span className="text-[9px] text-muted-foreground font-mono">
                        +{dayJobs.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda Side Column */}
        <div className="border border-border rounded-xl p-4 bg-muted/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-xs text-muted-foreground">Selected Day</span>
                <h3 className="text-base font-semibold text-foreground">
                  November {selectedDay}, 2026
                </h3>
              </div>
              <span className="text-xs font-mono font-medium text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-md">
                {selectedDayJobs.length} Dispatches
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {selectedDayJobs.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  <Clock className="mx-auto h-6 w-6 mb-2 opacity-40" />
                  No dispatches scheduled on this day.
                </div>
              ) : (
                selectedDayJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => onInspect(job.id)}
                    className="p-3 rounded-lg border border-border bg-card hover:border-sky-500/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {job.title}
                      </span>
                      <StatusBadge status={job.status} size="sm" showIcon={false} />
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                      <span>{job.kind === 'cron' ? job.cron_expr : 'Once'}</span>
                      <span>{job.recipient}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-4 text-[11px] text-muted-foreground font-mono">
            Blue dots: Recurring cron · Green dots: One-off
          </div>
        </div>
      </div>
    </div>
  );
}
