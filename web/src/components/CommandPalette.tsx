/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import {
  Calendar,
  Users,
  FileText,
  History,
  Database,
  PlusCircle,
  Sun,
  Moon,
  Laptop,
  Download,
  Server,
  Search,
} from 'lucide-react';
import { useJobsStore } from '../stores/jobs';
import { useAuthStore } from '../stores/auth';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
}: CommandPaletteProps) {
  const { jobs, contacts, setIsCreateOpen, openInspector, exportCsv } = useJobsStore();
  const { setTheme, setIsAccessModalOpen } = useAuthStore();
  const [search, setSearch] = useState('');

  // Global keydown handler for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const runAndClose = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl z-10 text-foreground">
        <Command
          value={search}
          onValueChange={setSearch}
          className="w-full flex flex-col"
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Search jobs, run commands, or jump to view..."
              className="flex h-12 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
              No matching commands or jobs found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-[11px] font-medium text-muted-foreground px-2 py-1">
              <Command.Item
                onSelect={() => runAndClose(() => onNavigate('/jobs'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Calendar className="h-4 w-4 text-sky-500" />
                <span>Operational Agenda</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => onNavigate('/contacts'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Users className="h-4 w-4 text-emerald-500" />
                <span>Contact Directory</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => onNavigate('/templates'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <FileText className="h-4 w-4 text-amber-500" />
                <span>Message Templates & Simulator</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => onNavigate('/history'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <History className="h-4 w-4 text-purple-500" />
                <span>Execution Audit Logs</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => onNavigate('/data'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Database className="h-4 w-4 text-slate-400" />
                <span>Backups & SQLite Integrity</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Actions" className="text-[11px] font-medium text-muted-foreground px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => runAndClose(() => setIsCreateOpen(true))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-sky-500" />
                <span>Create New Job</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => exportCsv())}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Download className="h-4 w-4 text-emerald-500" />
                <span>Export Jobs to CSV</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => setIsAccessModalOpen(true))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Server className="h-4 w-4 text-amber-500" />
                <span>Gateway Configuration & API Key</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Recent Scheduled Jobs" className="text-[11px] font-medium text-muted-foreground px-2 py-1 mt-2">
              {jobs.slice(0, 5).map((job) => (
                <Command.Item
                  key={job.id}
                  value={`${job.title} ${job.recipient} ${job.tags.join(' ')}`}
                  onSelect={() => runAndClose(() => openInspector(job.id))}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium truncate">{job.title}</span>
                    <span className="text-xs text-muted-foreground truncate font-mono">
                      {job.recipient}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize font-mono shrink-0 ml-2">
                    {job.status}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Contacts Directory" className="text-[11px] font-medium text-muted-foreground px-2 py-1 mt-2">
              {contacts.map((contact) => (
                <Command.Item
                  key={contact.id}
                  value={`${contact.name || contact.alias} ${contact.phone} ${contact.role}`}
                  onSelect={() => runAndClose(() => onNavigate(`/contacts/${contact.id}`))}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium truncate">{contact.name || contact.alias}</span>
                    <span className="text-xs text-muted-foreground font-mono">{contact.phone}</span>
                  </div>
                  <span className="text-xs text-sky-500 font-sans">{contact.role}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Appearance" className="text-[11px] font-medium text-muted-foreground px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => runAndClose(() => setTheme('dark'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Moon className="h-4 w-4" />
                <span>Dark Theme</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => setTheme('light'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Sun className="h-4 w-4" />
                <span>Light Theme</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => setTheme('system'))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <Laptop className="h-4 w-4" />
                <span>System Theme</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
