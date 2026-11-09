/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  FileText,
  History,
  Database,
  Search,
  Server,
  Key,
  Sun,
  Moon,
  Laptop,
  Radio,
  Menu,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { useAuthStore, applyThemeToDocument, AppTheme } from '../stores/auth';
import { useJobsStore } from '../stores/jobs';
import { JobCreate } from '../features/agenda/wdg-job-create';
import { AccessDialog } from './AccessDialog';
import { CommandPalette } from './CommandPalette';

export interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: typeof Calendar;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/jobs', label: 'Operational Agenda', icon: Calendar },
  { path: '/contacts', label: 'Contact Directory', icon: Users },
  { path: '/templates', label: 'Message Templates', icon: FileText },
  { path: '/history', label: 'Execution Audit Logs', icon: History },
  { path: '/data', label: 'Backups & Integrity', icon: Database },
];

export function AppShell({ currentPath, onNavigate, children }: AppShellProps) {
  const {
    baseUrl,
    apiKey,
    theme,
    setTheme,
    isAccessModalOpen,
    setIsAccessModalOpen,
    isConnected,
    latencyMs,
  } = useAuthStore();

  const { isCreateOpen, setIsCreateOpen } = useJobsStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const cycleTheme = () => {
    const next: Record<AppTheme, AppTheme> = {
      dark: 'light',
      light: 'system',
      system: 'dark',
    };
    setTheme(next[theme]);
  };

  const maskedKey = apiKey ? `${apiKey.substring(0, 7)}••••••` : 'None';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 shrink-0 select-none ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-border">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2 truncate">
              <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center font-bold text-sm shrink-0">
                HS
              </div>
              <div className="truncate">
                <span className="font-semibold text-sm tracking-tight block truncate">
                  Homelab Schedule
                </span>
                <span className="text-[11px] text-muted-foreground block truncate">
                  Dispatch & Agenda Plane
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center font-bold text-sm">
              HS
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Quick New Job Action in Sidebar (Available on all desktop views) */}
        <div className="p-3 border-b border-border">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[40px] active:scale-[0.98] shadow-xs ${
              isSidebarCollapsed ? 'px-0' : ''
            }`}
            title="Schedule New Dispatch Job"
          >
            <Plus size={16} />
            {!isSidebarCollapsed && <span>New Job</span>}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.path ||
              (currentPath === '/' && item.path === '/jobs') ||
              (item.path !== '/' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] active:scale-[0.98] ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-500 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* System Heartbeat & Gateway status indicator */}
        <div className="p-3 border-t border-border">
          <div
            onClick={() => setIsAccessModalOpen(true)}
            className={`cursor-pointer rounded-lg border border-border bg-muted/50 p-2.5 flex items-center gap-2 hover:bg-muted transition-colors ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Gateway Heartbeat (Click to configure)"
          >
            <div className="relative flex h-2.5 w-2.5 shrink-0">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">
                  Gateway Connected
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  202 Ready · {latencyMs}ms
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Mobile Title or Search trigger */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setIsCommandOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/60 hover:bg-muted border border-border rounded-lg transition-colors min-h-[44px] active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <Search size={15} />
                <span>Search jobs, commands, tags...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-foreground">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: Actions, Gateway Heartbeat, Instance badge & Theme Toggle */}
          <div className="flex items-center gap-1.5 md:gap-2.5">
            {/* New Job CTA Button in Header (Accessible across all screens and pages) */}
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[40px] active:scale-[0.98] shadow-xs shrink-0"
              title="Schedule New Dispatch Job"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Job</span>
            </button>

            {/* Gateway Heartbeat indicator (Present across all screens/devices, especially on mobile where sidebar is hidden) */}
            <button
              type="button"
              onClick={() => setIsAccessModalOpen(true)}
              className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors min-h-[40px] active:scale-[0.98] shrink-0"
              title="Gateway Heartbeat (Click to configure)"
            >
              <div className="relative flex h-2.5 w-2.5 shrink-0">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                )}
              </div>
              <div className="flex flex-col text-left">
                <div className="text-xs font-medium text-foreground flex items-center gap-1 leading-tight">
                  <span className="hidden xs:inline">Gateway</span>
                  <span>{isConnected ? 'Connected' : 'Offline'}</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono leading-tight">
                  202 Ready · {latencyMs}ms
                </div>
              </div>
            </button>

            {/* Active Homelab Instance with SCHEDULE_API_KEY badge */}
            <button
              type="button"
              onClick={() => setIsAccessModalOpen(true)}
              className="hidden xl:inline-flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted transition-colors min-h-[40px] active:scale-[0.98]"
              title="Click to adjust Operator API Key and Gateway URL"
            >
              <Server size={14} className="text-sky-500 shrink-0" />
              <span className="text-xs font-mono text-foreground font-medium">
                {baseUrl.replace(/^https?:\/\//, '')}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                <Key size={10} />
                {maskedKey}
              </span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors min-h-[40px] min-w-[40px] active:scale-[0.98]"
              title={`Theme: ${theme} (Click to toggle)`}
            >
              {theme === 'dark' ? (
                <Moon size={16} />
              ) : theme === 'light' ? (
                <Sun size={16} />
              ) : (
                <Laptop size={16} />
              )}
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-2 py-1 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentPath === item.path ||
            (currentPath === '/' && item.path === '/jobs') ||
            (item.path !== '/' && currentPath.startsWith(item.path));
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg min-h-[48px] min-w-[48px] transition-colors active:scale-[0.98] ${
                isActive ? 'text-sky-500 font-medium' : 'text-muted-foreground'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] mt-0.5 whitespace-nowrap">
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Global Modals & Notifications */}
      <JobCreate
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
      <AccessDialog
        open={isAccessModalOpen}
        onOpenChange={setIsAccessModalOpen}
      />
      <CommandPalette
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
        onNavigate={onNavigate}
      />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
