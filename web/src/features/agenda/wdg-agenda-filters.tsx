/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import {
  Table,
  Clock,
  CalendarDays,
  Search,
  Plus,
  Download,
  Tag,
  X,
} from 'lucide-react';
import { useJobsStore } from '../../stores/jobs';
import { AgendaViewMode, JobStatus } from '../../types/domain';

export interface AgendaFiltersProps {
  onOpenCreate: () => void;
}

export function AgendaFilters({ onOpenCreate }: AgendaFiltersProps) {
  const {
    jobs,
    viewMode,
    statusFilter,
    selectedTag,
    searchQuery,
    availableTags,
    setViewMode,
    setStatusFilter,
    setSelectedTag,
    setSearchQuery,
    exportCsv,
    exportBusy,
    resources,
  } = useJobsStore();

  // Status counts derived directly
  const counts = useMemo(() => {
    return {
      all: jobs.length,
      scheduled: jobs.filter((j) => j.status === 'scheduled').length,
      done: jobs.filter((j) => j.status === 'done').length,
      paused: jobs.filter((j) => j.status === 'paused').length,
      error: jobs.filter((j) => j.status === 'error').length,
    };
  }, [jobs]);

  const statusTabs: { id: 'all' | JobStatus; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'scheduled', label: 'Upcoming', count: counts.scheduled },
    { id: 'done', label: 'Done', count: counts.done },
    { id: 'paused', label: 'Paused', count: counts.paused },
    { id: 'error', label: 'Error', count: counts.error },
  ];

  return (
    <div className="space-y-3 mb-6">
      {/* Top control bar: Search, Tags, CSV, New Job */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: Search & Tag Selector */}
        <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar título ou conteúdo..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[44px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Tag Dropdown Filter */}
          <div className="relative min-w-[130px]">
            <select
              id="filter-tag"
              value={selectedTag || ''}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              className="w-full appearance-none px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[44px] cursor-pointer"
            >
              <option value="">All Tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
            <Tag className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Right: View Toggles & Actions */}
        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
          {/* View Mode Switcher */}
          <div id="view-mode-switcher" className="flex items-center p-1 bg-muted border border-border rounded-lg">
            <button
              type="button"
              id="tab-view-table"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md text-xs font-medium transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grouped Table"
            >
              <Table size={15} />
            </button>
            <button
              type="button"
              id="tab-view-timeline"
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded-md text-xs font-medium transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                viewMode === 'timeline'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chronological Timeline"
            >
              <Clock size={15} />
            </button>
            <button
              type="button"
              id="tab-view-calendar"
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-md text-xs font-medium transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                viewMode === 'calendar'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Monthly Calendar"
            >
              <CalendarDays size={15} />
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportCsv}
            disabled={exportBusy || resources.jobs.status !== 'ready'}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors min-h-[44px] active:scale-[0.98]"
            title="Export CSV (authenticated GET /jobs/export.csv)"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* New Job CTA */}
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs"
          >
            <Plus size={16} />
            <span className="font-semibold">New Job</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">A contagem mostra apenas os resultados carregados do filtro ativo (até 50).</p>
      {/* Quick Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] active:scale-[0.98] ${
                isActive
                  ? 'bg-foreground text-background font-semibold shadow-xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:bg-muted'
              }`}
            >
              <span>{tab.label}</span>
              {isActive && resources.jobs.status === 'ready' && (
                <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded-full bg-background/20 text-background">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
