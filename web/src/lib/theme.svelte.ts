export type ThemeMode = 'light' | 'system' | 'dark';

const STORAGE_KEY = 'homelab_theme';

class ThemeManager {
  mode = $state<ThemeMode>('system');

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        this.mode = saved;
      }
      this.apply();

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.mode === 'system') {
          this.apply();
        }
      });
    }
  }

  setMode(newMode: ThemeMode) {
    this.mode = newMode;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newMode);
      this.apply();
    }
  }

  apply() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', this.mode);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = this.mode === 'dark' || (this.mode === 'system' && prefersDark);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }
}

export const theme = new ThemeManager();
