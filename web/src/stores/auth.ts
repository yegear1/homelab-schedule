/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { api } from '../lib/api';

export type AppTheme = 'dark' | 'light' | 'system';

interface AuthState {
  baseUrl: string;
  apiKey: string;
  theme: AppTheme;
  isAccessModalOpen: boolean;
  isConnected: boolean;
  latencyMs: number;
  gatewayStatus: string;
  setBaseUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setTheme: (theme: AppTheme) => void;
  setIsAccessModalOpen: (open: boolean) => void;
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
  isConnected: true,
  latencyMs: 14,
  gatewayStatus: '202 Ready',

  setBaseUrl: (url: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BASE_URL, url);
    }
    api.setBaseUrl(url);
    set({ baseUrl: url });
  },

  setApiKey: (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
    }
    api.setApiKey(key);
    set({ apiKey: key });
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

  testConnection: async (targetUrl?: string, targetKey?: string) => {
    const start = performance.now();
    try {
      const rawUrl = targetUrl !== undefined ? targetUrl : (api.getBaseUrl() || get().baseUrl);
      const url = rawUrl.replace(/\/+$/, '');
      const key = targetKey !== undefined ? targetKey : (api.getApiKey() || get().apiKey);
      const headers: Record<string, string> = {};
      if (key) headers['x-api-key'] = key;
      const res = await fetch(`${url}/health`, { headers, cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      const ok = res.ok;
      set({
        isConnected: ok,
        latencyMs: latency,
        gatewayStatus: ok ? '202 Ready' : `HTTP ${res.status}`,
      });
      return ok;
    } catch {
      set({
        isConnected: false,
        latencyMs: 0,
        gatewayStatus: 'Offline',
      });
      return false;
    }
  },

  resetDefaults: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_BASE_URL);
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
    api.setBaseUrl('');
    api.setApiKey('');
    set({
      baseUrl: '',
      apiKey: '',
      isConnected: true,
      latencyMs: 14,
      gatewayStatus: '202 Ready',
    });
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
