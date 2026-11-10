/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { api } from '../lib/api';

export type AppTheme = 'dark' | 'light' | 'system';
export type DaemonStatus = 'idle' | 'checking' | 'online' | 'offline';
export type AuthStatus = 'untested' | 'authenticated' | 'unauthorized' | 'no_key' | 'offline' | 'error';

export interface TestConnectionResult {
  ok: boolean;
  daemonOk: boolean;
  authOk: boolean;
  latencyMs: number | null;
  message: string;
}

interface AuthState {
  baseUrl: string;
  apiKey: string;
  theme: AppTheme;
  isAccessModalOpen: boolean;
  isConnected: boolean;
  latencyMs: number | null;
  daemonStatus: DaemonStatus;
  authStatus: AuthStatus;
  gatewayStatus: string;
  authMessage: string;
  settingsRevision: number;

  setBaseUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setTheme: (theme: AppTheme) => void;
  setIsAccessModalOpen: (open: boolean) => void;
  testConnectionDetailed: (targetUrl?: string, targetKey?: string) => Promise<TestConnectionResult>;
  testConnection: (targetUrl?: string, targetKey?: string) => Promise<boolean>;
  resetDefaults: () => void;
}

const STORAGE_KEY_BASE_URL = 'homelab_api_base_url';
const STORAGE_KEY_API_KEY = 'SCHEDULE_API_KEY';
const STORAGE_KEY_THEME = 'homelab_theme';

const getInitialBaseUrl = (): string => {
  return (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BASE_URL) : '') || '';
};

const getInitialApiKey = (): string => {
  return (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEY) : '') || '';
};

const getInitialTheme = (): AppTheme => {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(STORAGE_KEY_THEME) as AppTheme | null;
  return saved || 'system';
};

export const useAuthStore = create<AuthState>((set, get) => ({
  baseUrl: getInitialBaseUrl(),
  apiKey: getInitialApiKey(),
  theme: getInitialTheme(),
  isAccessModalOpen: false,
  isConnected: false,
  latencyMs: null,
  daemonStatus: 'idle',
  authStatus: 'untested',
  gatewayStatus: 'Unchecked',
  authMessage: '',
  settingsRevision: 0,

  setBaseUrl: (url: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BASE_URL, url);
    }
    api.setBaseUrl(url);
    set((s) => ({ baseUrl: url, settingsRevision: s.settingsRevision + 1 }));
  },

  setApiKey: (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
    }
    api.setApiKey(key);
    set((s) => ({ apiKey: key, settingsRevision: s.settingsRevision + 1 }));
  },

  setTheme: (theme: AppTheme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    }
    set({ theme });
    applyThemeToDocument(theme);
  },

  setIsAccessModalOpen: (open: boolean) => {
    set({ isAccessModalOpen: open });
  },

  testConnectionDetailed: async (targetUrl?: string, targetKey?: string): Promise<TestConnectionResult> => {
    const rawUrl = targetUrl !== undefined ? targetUrl : (api.getBaseUrl() || get().baseUrl);
    const url = rawUrl.replace(/\/+$/, '');
    const key = targetKey !== undefined ? targetKey : (api.getApiKey() || get().apiKey);

    set({ daemonStatus: 'checking' });
    const start = performance.now();

    // 1. Check application liveness only via public /health
    let daemonOk = false;
    let latencyMs: number | null = null;
    try {
      const res = await fetch(`${url}/health`, { cache: 'no-store' });
      latencyMs = Math.round(performance.now() - start);
      daemonOk = res.ok;
    } catch {
      daemonOk = false;
      latencyMs = null;
    }

    if (!daemonOk) {
      set({
        isConnected: false,
        latencyMs: null,
        daemonStatus: 'offline',
        authStatus: 'offline',
        gatewayStatus: 'Offline',
        authMessage: 'Daemon offline ou inalcançável',
      });
      return {
        ok: false,
        daemonOk: false,
        authOk: false,
        latencyMs: null,
        message: 'Falha de conexão com o daemon. Verifique a URL e a conectividade de rede.',
      };
    }

    // 2. Validate authentication separately using an existing authenticated endpoint
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      set({
        isConnected: true,
        latencyMs,
        daemonStatus: 'online',
        authStatus: 'no_key',
        gatewayStatus: 'Online (Sem Chave)',
        authMessage: 'Daemon online · Nenhuma chave x-api-key configurada',
      });
      return {
        ok: true,
        daemonOk: true,
        authOk: false,
        latencyMs,
        message: `Daemon ativo (${latencyMs}ms), mas nenhuma chave x-api-key foi informada. Rotas protegidas retornarão 401.`,
      };
    }

    try {
      const authRes = await fetch(`${url}/jobs/tags`, {
        headers: { 'x-api-key': trimmedKey },
        cache: 'no-store',
      });
      if (authRes.ok) {
        set({
          isConnected: true,
          latencyMs,
          daemonStatus: 'online',
          authStatus: 'authenticated',
          gatewayStatus: 'Online · Autenticado',
          authMessage: 'Daemon online e chave x-api-key autenticada com sucesso',
        });
        return {
          ok: true,
          daemonOk: true,
          authOk: true,
          latencyMs,
          message: `Daemon ativo (${latencyMs}ms) e chave x-api-key autenticada com sucesso.`,
        };
      } else if (authRes.status === 401) {
        set({
          isConnected: true,
          latencyMs,
          daemonStatus: 'online',
          authStatus: 'unauthorized',
          gatewayStatus: 'Online · Chave Inválida (401)',
          authMessage: 'Chave x-api-key recusada (HTTP 401)',
        });
        return {
          ok: false,
          daemonOk: true,
          authOk: false,
          latencyMs,
          message: `Daemon ativo (${latencyMs}ms), mas a chave x-api-key foi rejeitada (HTTP 401).`,
        };
      } else {
        set({
          isConnected: true,
          latencyMs,
          daemonStatus: 'online',
          authStatus: 'error',
          gatewayStatus: `Online · HTTP ${authRes.status}`,
          authMessage: `Erro ao validar chave (HTTP ${authRes.status})`,
        });
        return {
          ok: false,
          daemonOk: true,
          authOk: false,
          latencyMs,
          message: `Daemon ativo (${latencyMs}ms), mas a rota de validação retornou HTTP ${authRes.status}.`,
        };
      }
    } catch {
      set({
        isConnected: true,
        latencyMs,
        daemonStatus: 'online',
        authStatus: 'error',
        gatewayStatus: 'Online · Erro Auth',
        authMessage: 'Erro de rede ao validar credenciais',
      });
      return {
        ok: false,
        daemonOk: true,
        authOk: false,
        latencyMs,
        message: 'Daemon alcançado em /health, mas ocorreu erro de rede ao validar credenciais.',
      };
    }
  },

  testConnection: async (targetUrl?: string, targetKey?: string): Promise<boolean> => {
    const res = await get().testConnectionDetailed(targetUrl, targetKey);
    return res.daemonOk && (res.authOk || get().authStatus === 'no_key');
  },

  resetDefaults: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_BASE_URL);
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
    api.setBaseUrl('');
    api.setApiKey('');
    set((s) => ({
      baseUrl: '',
      apiKey: '',
      isConnected: false,
      latencyMs: null,
      daemonStatus: 'idle',
      authStatus: 'no_key',
      gatewayStatus: 'Unchecked',
      authMessage: '',
      settingsRevision: s.settingsRevision + 1,
    }));
  },
}));

export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}
