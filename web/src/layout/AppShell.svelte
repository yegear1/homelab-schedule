<script lang="ts">
  import type { Snippet } from 'svelte';
  import { router } from '../lib/router.svelte';
  import { theme, type ThemeMode } from '../lib/theme.svelte';
  import { api } from '../lib/api';
  import Toast from '../components/Toast.svelte';
  import ApiKeyModal from '../components/ApiKeyModal.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let showApiKeyModal = $state(false);
  let hasApiKey = $derived(Boolean(api.getApiKey()));

  const navItems = [
    { name: 'Contatos', path: '/contacts', id: 'scr-contacts', routeName: 'contacts', subRoute: 'contact-detail' },
    { name: 'Modelos', path: '/templates', id: 'scr-templates', routeName: 'templates', subRoute: '' },
    { name: 'Agendas', path: '/jobs', id: 'scr-jobs', routeName: 'jobs', subRoute: '' },
  ];
</script>

<!-- ASIDE: Navigation Rail -->
<aside class="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest flex flex-col z-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-outline-variant/10">
  <div class="h-16 px-space-md flex items-center gap-space-sm bg-surface-container-low/40">
    <div class="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-headline-sm">
      <span class="material-symbols-outlined text-[22px]">calendar_clock</span>
    </div>
    <div class="flex flex-col min-w-0">
      <span class="font-headline-sm text-headline-sm text-on-surface truncate tracking-tight">Homelab Scheduler</span>
      <span class="font-label-ui text-label-ui text-primary uppercase tracking-wider truncate">Despachante</span>
    </div>
  </div>

  <div class="px-space-md py-space-sm">
    <div class="bg-surface-container-low px-space-sm py-space-xs rounded flex items-center justify-between">
      <div class="flex items-center gap-space-xs">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
        </span>
        <span class="font-label-code-sm text-label-code-sm text-on-surface-variant">Tick local (SQLite)</span>
      </div>
      <span class="font-label-code-sm text-label-code-sm text-tertiary">SYNC</span>
    </div>
  </div>

  <nav class="flex-1 px-space-sm py-space-xs flex flex-col gap-space-xs">
    {#each navItems as item}
      {@const isActive = router.route === item.routeName || (item.subRoute && router.route === item.subRoute)}
      <a
        aria-current={isActive ? 'page' : undefined}
        class="flex items-center justify-between px-space-md py-space-sm transition-colors rounded {isActive ? 'bg-surface-container-high text-primary font-headline-sm' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}"
        href={item.path}
        id="nav-{item.id}"
      >
        <span class="font-body-md text-body-md">{item.name}</span>
        <span class="font-label-code-sm text-label-code-sm {isActive ? 'text-primary/70' : 'text-outline'}">{item.path}</span>
      </a>
    {/each}
  </nav>

  <div class="p-space-md bg-surface-container-lowest flex flex-col gap-space-sm border-t border-outline-variant/10">
    <button
      class="bg-surface-container-low p-space-sm rounded flex flex-col gap-space-xs text-left hover:bg-surface-container transition-colors cursor-pointer"
      onclick={() => (showApiKeyModal = true)}
      type="button"
    >
      <div class="flex items-center justify-between">
        <span class="font-label-ui text-label-ui uppercase text-on-surface-variant">Credencial API</span>
        <span class="h-1.5 w-1.5 rounded-full {hasApiKey ? 'bg-tertiary' : 'bg-error'}"></span>
      </div>
      <span class="font-label-code-sm text-label-code-sm {hasApiKey ? 'text-tertiary' : 'text-error'} truncate">
        {hasApiKey ? 'x-api-key: configurada' : 'x-api-key: pendente'}
      </span>
      <span class="font-label-code-sm text-label-code-sm text-outline">Armazenada no cliente</span>
    </button>

    <div class="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm pt-space-xs">
      <span>Node: hl-node-01</span>
      <span>v0.2.0</span>
    </div>
  </div>
</aside>

<!-- TOP HEADER -->
<div class="pl-64">
  <header class="fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-gutter-desktop border-b border-outline-variant/10">
    <div class="flex items-center gap-space-md">
      <div class="flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-surface-container-low text-tertiary">
        <span class="material-symbols-outlined text-[16px]">bolt</span>
        <span class="font-label-code text-label-code font-semibold">DISPATCHER PRONTO</span>
      </div>
      <div class="hidden lg:flex items-center gap-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm">
        <span class="text-outline">DRIVER:</span>
        <span class="text-on-surface font-mono">SQLite WAL-mode</span>
      </div>
    </div>

    <div class="flex items-center gap-space-md">
      <!-- Theme Switcher Group (light | system | dark) -->
      <div aria-label="Controle de tema" class="flex items-center p-0.5 rounded bg-surface-container-low" role="group">
        <button
          id="theme-btn-light"
          aria-label="Tema Claro (Light)"
          aria-pressed={theme.mode === 'light'}
          title="Tema Claro"
          class="px-space-sm py-0.5 rounded font-label-ui text-label-ui transition-colors {theme.mode === 'light' ? 'bg-surface-container text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}"
          onclick={() => theme.setMode('light')}
          type="button"
        >
          light
        </button>
        <button
          id="theme-btn-system"
          aria-label="Tema do Sistema (System)"
          aria-pressed={theme.mode === 'system'}
          title="Tema do Sistema"
          class="px-space-sm py-0.5 rounded font-label-ui text-label-ui transition-colors {theme.mode === 'system' ? 'bg-surface-container text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}"
          onclick={() => theme.setMode('system')}
          type="button"
        >
          system
        </button>
        <button
          id="theme-btn-dark"
          aria-label="Tema Escuro (Dark)"
          aria-pressed={theme.mode === 'dark'}
          title="Tema Escuro"
          class="px-space-sm py-0.5 rounded font-label-ui text-label-ui transition-colors {theme.mode === 'dark' ? 'bg-surface-container text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}"
          onclick={() => theme.setMode('dark')}
          type="button"
        >
          dark
        </button>
      </div>

      <button
        class="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity"
        onclick={() => (showApiKeyModal = true)}
        title="Configurações da API"
        type="button"
      >
        <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
      </button>
    </div>
  </header>

  <!-- MAIN VIEW CONTAINER -->
  <main class="w-full pt-16 bg-surface min-h-screen px-gutter-desktop py-margin-desktop">
    {@render children()}
  </main>
</div>

<!-- GLOBAL TOAST AND MODALS -->
<Toast />
<ApiKeyModal open={showApiKeyModal} onclose={() => (showApiKeyModal = false)} />
