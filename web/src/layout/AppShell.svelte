<script lang="ts">
  import type { Snippet } from 'svelte';
  import { router } from '../lib/router.svelte';
  import { theme, type ThemeMode } from '../lib/theme.svelte';
  import { api } from '../lib/api';
  import Toast from '../components/Toast.svelte';
  import ApiKeyModal from '../components/ApiKeyModal.svelte';
  import Button from '../components/ui/Button.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import SegmentedControl from '../components/ui/SegmentedControl.svelte';
  import StatusBadge from '../components/ui/StatusBadge.svelte';
  import schedulerIcon from '../assets/scheduler.svg';

  type Props = { children: Snippet };
  let { children }: Props = $props();
  let showApiKeyModal = $state(false);
  let hasApiKey = $state(Boolean(api.getApiKey()));
  const themeOptions: { value: ThemeMode; label: string; id: string; icon: 'sun' | 'system' | 'moon' }[] = [
    { value: 'light', label: 'Claro', id: 'theme-btn-light', icon: 'sun' },
    { value: 'system', label: 'Sistema', id: 'theme-btn-system', icon: 'system' },
    { value: 'dark', label: 'Escuro', id: 'theme-btn-dark', icon: 'moon' },
  ];
  const navItems = [
    { name: 'Agenda', icon: 'agenda', path: '/jobs', id: 'scr-jobs', route: 'jobs' },
    { name: 'Contatos', icon: 'contacts', path: '/contacts', id: 'scr-contacts', route: 'contacts' },
    { name: 'Modelos', icon: 'templates', path: '/templates', id: 'scr-templates', route: 'templates' },
    { name: 'Histórico', icon: 'agenda', path: '/history', id: 'scr-history', route: 'history' },
    { name: 'Dados', icon: 'data', path: '/data', id: 'scr-data', route: 'data' },
  ] as const;
  const currentPage = $derived(router.route === 'contact-detail' ? 'Contato' : navItems.find((item) => item.route === router.route)?.name);

  function closeApiKeyModal(): void {
    hasApiKey = Boolean(api.getApiKey());
    showApiKeyModal = false;
  }
</script>

<div class="app-shell">
  <a class="shell-skip" href="#main-content">Pular para o conteúdo</a>
  <aside class="shell-sidebar" aria-label="Biblioteca">
    <div class="shell-brand">
      <img class="rounded-lg" src={schedulerIcon} alt="" width="40" height="40" />
      <div><strong>Homelab Scheduler</strong><span>Sua agenda de mensagens</span></div>
    </div>
    <nav class="shell-navigation" aria-label="Navegação principal">
      {#each navItems as item}
        {@const active = router.route === item.route || (item.route === 'contacts' && router.route === 'contact-detail')}
        <a id="nav-{item.id}" href={item.path} aria-current={active ? 'page' : undefined}>
          <Icon name={item.icon} /><span>{item.name}</span>
        </a>
      {/each}
    </nav>
    <div class="shell-sidebar-footer">
      <div class="shell-sidebar-theme">
        <span class="shell-section-label">Aparência</span>
        <SegmentedControl label="Controle de tema" options={themeOptions} value={theme.mode} onchange={(value) => theme.setMode(value)} />
      </div>
      <div class="shell-sidebar-tools">
        <span class="shell-section-label">Ferramentas</span>
        <Button id="btn-open-backup-modal-sidebar" variant="quiet" onclick={() => router.navigate('/data')}><Icon name="data" />Backup e dados</Button>
        <Button variant="quiet" title="Configurar chave da API" onclick={() => (showApiKeyModal = true)}><Icon name="key" />Configurar acesso</Button>
      </div>
    </div>
  </aside>
  <div class="shell-workspace">
    <header class="shell-header">
      <div class="shell-toolbar">
        <div class="shell-location"><span class="shell-section-label">Biblioteca</span><strong>{currentPage}</strong></div>
        <div class="shell-tools">
          <StatusBadge tone={hasApiKey ? 'neutral' : 'error'}>{hasApiKey ? 'Configurada neste navegador' : 'Configuração pendente'}</StatusBadge>
          <Button id="btn-open-backup-modal-header" title="Backup e dados" onclick={() => router.navigate('/data')}><Icon name="data" /><span>Dados</span></Button>
          <Button title="Configurações da API" onclick={() => (showApiKeyModal = true)}><Icon name="key" /><span>Acesso</span></Button>
        </div>
      </div>
    </header>
    <main class="shell-main" id="main-content" tabindex="-1">{@render children()}</main>
  </div>
</div>

<Toast />
<ApiKeyModal open={showApiKeyModal} onclose={closeApiKeyModal} />
