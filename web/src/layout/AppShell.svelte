<script lang="ts">
  import type { Snippet } from 'svelte';
  import { router } from '../lib/router.svelte';
  import { theme, type ThemeMode } from '../lib/theme.svelte';
  import { api } from '../lib/api';
  import Toast from '../components/Toast.svelte';
  import ApiKeyModal from '../components/ApiKeyModal.svelte';
  import BackupModal from '../components/BackupModal.svelte';
  import schedulerIcon from '../assets/scheduler.svg';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let showApiKeyModal = $state(false);
  let showBackupModal = $state(false);
  let hasApiKey = $derived(Boolean(api.getApiKey()));

  const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Claro', icon: 'light_mode' },
    { mode: 'system', label: 'Sistema', icon: 'desktop_windows' },
    { mode: 'dark', label: 'Escuro', icon: 'dark_mode' },
  ];
  const themeIndex = $derived(themeOptions.findIndex((option) => option.mode === theme.mode));

  const navItems = [
    { name: 'Contatos', icon: 'contacts', path: '/contacts', id: 'scr-contacts', routeName: 'contacts', subRoute: 'contact-detail' },
    { name: 'Modelos', icon: 'description', path: '/templates', id: 'scr-templates', routeName: 'templates', subRoute: '' },
    { name: 'Agendas', icon: 'calendar_month', path: '/jobs', id: 'scr-jobs', routeName: 'jobs', subRoute: '' },
  ];
</script>

<aside class="fixed inset-y-0 left-0 z-40 flex w-20 flex-col border-r border-separator/40 bg-system-background/85 backdrop-blur-xl md:w-60">
  <div class="flex h-20 shrink-0 items-center justify-center gap-3 px-4 md:justify-start">
    <img src={schedulerIcon} alt="" width="36" height="36" class="h-9 w-9 shrink-0 rounded-xl shadow-sm" />
    <div class="hidden min-w-0 md:block">
      <span class="block truncate font-headline-sm text-body-lg font-semibold text-label">Homelab Scheduler</span>
      <span class="text-body-sm text-secondary-label">Sua agenda de mensagens</span>
    </div>
  </div>

  <nav aria-label="Navegação principal" class="flex-1 space-y-1 px-3 pt-4">
    <p class="mb-3 hidden px-3 text-body-sm font-semibold text-secondary-label md:block">Biblioteca</p>
    {#each navItems as item}
      {@const isActive = router.route === item.routeName || (item.subRoute && router.route === item.subRoute)}
      <a
        id="nav-{item.id}"
        href={item.path}
        title={item.name}
        aria-label={item.name}
        aria-current={isActive ? 'page' : undefined}
        class="shell-action flex min-h-11 items-center justify-center gap-3 rounded-lg px-3 text-body-lg md:justify-start {isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-secondary-label hover:bg-fill/60 hover:text-label'}"
      >
        <span aria-hidden="true" class="material-symbols-outlined text-[21px]">{item.icon}</span>
        <span class="hidden md:inline">{item.name}</span>
      </a>
    {/each}
  </nav>

  <div class="space-y-2 border-t border-separator/40 p-3">
    <button id="btn-open-backup-modal-sidebar" type="button" title="Backup e dados"
      class="shell-action flex min-h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-secondary-label hover:bg-fill/60 hover:text-label md:justify-start"
      onclick={() => (showBackupModal = true)}>
      <span aria-hidden="true" class="material-symbols-outlined text-[21px]">database</span>
      <span class="hidden text-body-md md:inline">Backup e dados</span>
    </button>
    <button type="button" title="Configurar chave da API"
      class="shell-action flex min-h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-secondary-label hover:bg-fill/60 hover:text-label md:justify-start"
      onclick={() => (showApiKeyModal = true)}>
      <span aria-hidden="true" class="material-symbols-outlined text-[21px]">key</span>
      <span class="hidden text-left md:block">
        <span class="block text-body-md text-label">Chave da API</span>
        <span class="text-body-sm {hasApiKey ? 'text-secondary-label' : 'text-error'}">{hasApiKey ? 'Configurada neste navegador' : 'Configuração pendente'}</span>
      </span>
    </button>
  </div>
</aside>

<div class="pl-20 md:pl-60">
  <header class="fixed left-20 right-0 top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-separator/40 bg-secondary-system-background/80 px-3 backdrop-blur-xl md:left-60 md:px-6">
    <span class="hidden text-body-md font-medium text-secondary-label sm:block">{router.route === 'contact-detail' ? 'Contato' : navItems.find((item) => item.routeName === router.route)?.name}</span>
    <div class="ml-auto flex items-center gap-2 md:gap-4">
      <button type="button" id="btn-open-backup-modal-header" title="Backup e dados"
        onclick={() => (showBackupModal = true)}
        class="shell-action hidden min-h-10 items-center gap-2 rounded-lg px-3 text-body-md text-secondary-label hover:bg-fill/60 hover:text-label lg:flex">
        <span aria-hidden="true" class="material-symbols-outlined text-[18px]">database</span>
        Backup e dados
      </button>
      <div aria-label="Controle de tema" class="segmented-control" role="group" style:--selected-index={themeIndex}>
        <span class="segmented-indicator" aria-hidden="true"></span>
        {#each themeOptions as option}
          <button id="theme-btn-{option.mode}" type="button" title="Tema {option.label}"
            aria-label="Tema {option.label}" aria-pressed={theme.mode === option.mode}
            class="shell-action flex min-h-9 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 text-body-sm {theme.mode === option.mode ? 'font-semibold text-label' : 'text-secondary-label hover:text-label'}"
            onclick={() => theme.setMode(option.mode)}>
            <span aria-hidden="true" class="material-symbols-outlined text-[16px]">{option.icon}</span>
            <span class="hidden lg:inline">{option.label}</span>
          </button>
        {/each}
      </div>
      <button type="button" title="Configurações da API"
        class="shell-action flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
        onclick={() => (showApiKeyModal = true)}>
        <span aria-hidden="true" class="material-symbols-outlined text-[20px]">tune</span>
      </button>
    </div>
  </header>

  <main class="min-h-screen w-full bg-system-background px-3 pb-8 pt-24 md:px-6">
    {@render children()}
  </main>
</div>

<Toast />
<ApiKeyModal open={showApiKeyModal} onclose={() => (showApiKeyModal = false)} />
<BackupModal open={showBackupModal} onclose={() => (showBackupModal = false)} />
