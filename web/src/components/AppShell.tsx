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
  id: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/contacts', label: 'Contact Directory', icon: Users, id: 'nav-scr-contacts' },
  { path: '/jobs', label: 'Operational Agenda', icon: Calendar, id: 'nav-scr-jobs' },
  { path: '/templates', label: 'Message Templates', icon: FileText, id: 'nav-scr-templates' },
  { path: '/history', label: 'Execution Audit Logs', icon: History, id: 'nav-scr-history' },
  { path: '/data', label: 'Backups & Integrity', icon: Database, id: 'btn-open-backup-modal-sidebar' },
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
    authStatus,
    settingsRevision,
    testConnection,
  } = useAuthStore();

  const { isCreateOpen, setIsCreateOpen } = useJobsStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // Test authentic connection whenever URL or API Key changes
  useEffect(() => {
    void testConnection();
  }, [baseUrl, apiKey, testConnection]);

  // When settings revision changes, announce to accessibility region and refresh shared reads
  useEffect(() => {
    if (settingsRevision > 0) {
      setStatusAnnouncement('Configurações salvas localmente no navegador.');
      const store = useJobsStore.getState();
      void store.fetchJobs();
      void store.fetchTags();
      void store.fetchContacts();
      void store.fetchTemplates();
    }
  }, [settingsRevision]);

  const cycleTheme = () => {
    const next: Record<AppTheme, AppTheme> = {
      dark: 'light',
      light: 'system',
      system: 'dark',
    };
    setTheme(next[theme]);
  };

  const maskedKey = apiKey ? `${apiKey.substring(0, Math.min(apiKey.length, 6))}••••••` : 'None';

  return (
    <div
      className="app-shell min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased"
      inert={isAccessModalOpen ? true : undefined}
    >
      {/* Skip to Main Content Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="shell-skip sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-sky-500 text-white rounded-md font-medium text-sm shadow-md"
      >
        Pular para o conteúdo principal
      </a>

      {/* Polite Live Region for Settings Announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {statusAnnouncement}
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={`shell-sidebar hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 shrink-0 select-none ${
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
            id="btn-open-create-modal"
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
        <nav className="shell-navigation flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.path ||
              (currentPath === '/' && item.path === '/contacts') ||
              (item.path !== '/' && currentPath.startsWith(item.path));

            return (
              <button
                key={item.path}
                type="button"
                id={item.id}
                aria-current={isActive ? 'page' : undefined}
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

        {/* Theme Segmented Control in Sidebar Footer */}
        <div className="p-3 pt-0 border-t border-border mt-auto">
          <div className="text-[11px] font-medium text-muted-foreground mb-1.5 px-0.5">
            {!isSidebarCollapsed && <span>Aparência</span>}
          </div>
          <div className="ui-segments flex items-center justify-between gap-1 p-1 bg-muted/60 rounded-lg border border-border">
            <button
              type="button"
              id="theme-btn-light"
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
              className={`flex-1 py-1.5 px-1.5 text-xs rounded-md flex items-center justify-center gap-1 min-h-[44px] transition-colors ${
                theme === 'light'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Tema claro"
            >
              <Sun size={14} />
              {!isSidebarCollapsed && <span className="text-[11px]">Claro</span>}
            </button>
            <button
              type="button"
              id="theme-btn-system"
              aria-pressed={theme === 'system'}
              onClick={() => setTheme('system')}
              className={`flex-1 py-1.5 px-1.5 text-xs rounded-md flex items-center justify-center gap-1 min-h-[44px] transition-colors ${
                theme === 'system'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Tema do sistema"
            >
              <Laptop size={14} />
              {!isSidebarCollapsed && <span className="text-[11px]">Auto</span>}
            </button>
            <button
              type="button"
              id="theme-btn-dark"
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
              className={`flex-1 py-1.5 px-1.5 text-xs rounded-md flex items-center justify-center gap-1 min-h-[44px] transition-colors ${
                theme === 'dark'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Tema escuro"
            >
              <Moon size={14} />
              {!isSidebarCollapsed && <span className="text-[11px]">Escuro</span>}
            </button>
          </div>
        </div>

        {/* System Heartbeat & Auth status indicator in Sidebar */}
        <div className="p-3 border-t border-border">
          <button
            type="button"
            onClick={() => setIsAccessModalOpen(true)}
            className={`w-full text-left rounded-lg border border-border bg-muted/50 p-2.5 flex items-center gap-2 hover:bg-muted transition-colors min-h-[44px] ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Conexão do daemon"
          >
            <div className="relative flex h-2.5 w-2.5 shrink-0">
              {isConnected ? (
                authStatus === 'authenticated' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : authStatus === 'unauthorized' ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                )
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">
                  {isConnected
                    ? authStatus === 'authenticated'
                      ? 'Daemon Autenticado'
                      : authStatus === 'unauthorized'
                      ? 'Chave Inválida (401)'
                      : 'Daemon Online'
                    : 'Daemon Offline'}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {latencyMs !== null ? `${latencyMs}ms · ` : ''}
                  {authStatus === 'authenticated'
                    ? 'Autenticado'
                    : authStatus === 'unauthorized'
                    ? 'HTTP 401'
                    : authStatus === 'no_key'
                    ? 'Sem chave'
                    : isConnected
                    ? 'Liveness OK'
                    : 'Inacessível'}
                </div>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="shell-header h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Search trigger / Command palette */}
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

          {/* Right: Actions, Heartbeat & Access trigger, Instance badge & Theme Toggle */}
          <div className="flex items-center gap-1.5 md:gap-2.5">
            {/* New Job CTA Button in Header */}
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs shrink-0"
              title="Schedule New Dispatch Job"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Job</span>
            </button>

            {/* Daemon Heartbeat & Auth indicator */}
            <button
              type="button"
              onClick={() => setIsAccessModalOpen(true)}
              className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors min-h-[44px] active:scale-[0.98] shrink-0"
              title="Configurações da API"
            >
              <div className="relative flex h-2.5 w-2.5 shrink-0">
                {isConnected ? (
                  authStatus === 'authenticated' ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  ) : authStatus === 'unauthorized' ? (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                  )
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                )}
              </div>
              <div className="flex flex-col text-left">
                <div className="text-xs font-medium text-foreground flex items-center gap-1 leading-tight">
                  <span className="hidden xs:inline">Daemon</span>
                  <span>
                    {isConnected
                      ? authStatus === 'authenticated'
                        ? 'Online'
                        : authStatus === 'unauthorized'
                        ? '401'
                        : 'Ativo'
                      : 'Offline'}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono leading-tight">
                  {latencyMs !== null ? `${latencyMs}ms` : 'offline'} ·{' '}
                  {authStatus === 'authenticated'
                    ? 'auth'
                    : authStatus === 'unauthorized'
                    ? 'chave inválida'
                    : authStatus === 'no_key'
                    ? 'sem chave'
                    : isConnected
                    ? 'liveness'
                    : 'desconectado'}
                </div>
              </div>
            </button>

            {/* Active Homelab Instance with SCHEDULE_API_KEY badge */}
            <button
              type="button"
              onClick={() => setIsAccessModalOpen(true)}
              className="hidden xl:inline-flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted transition-colors min-h-[44px] active:scale-[0.98]"
              title="Instância ativa"
            >
              <Server size={14} className="text-sky-500 shrink-0" />
              <span className="text-xs font-mono text-foreground font-medium">
                {baseUrl ? baseUrl.replace(/^https?:\/\//, '') : 'same-origin'}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                <Key size={10} />
                {maskedKey}
              </span>
            </button>

            {/* Theme Toggle (Mobile & compact desktop) */}
            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors min-h-[44px] min-w-[44px] active:scale-[0.98]"
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
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 focus:outline-none"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-2 py-1 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentPath === item.path ||
            (currentPath === '/' && item.path === '/contacts') ||
            (item.path !== '/' && currentPath.startsWith(item.path));
          return (
            <button
              key={item.path}
              type="button"
              id={item.path === '/data' ? 'btn-open-backup-modal-header' : undefined}
              aria-current={isActive ? 'page' : undefined}
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
