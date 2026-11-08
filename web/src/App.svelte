<script lang="ts">
  import AppShell from './layout/AppShell.svelte';
  import { router } from './lib/router.svelte';
  import ContactsPage from './pages/ContactsPage.svelte';
  import ContactDetailPage from './pages/ContactDetailPage.svelte';
  import TemplatesPage from './pages/TemplatesPage.svelte';
  import JobsPage from './pages/JobsPage.svelte';
  import HistoryPage from './pages/HistoryPage.svelte';
  import DataPage from './pages/DataPage.svelte';
</script>

<AppShell>
  {#if router.route === 'contacts'}
    <ContactsPage />
  {:else if router.route === 'contact-detail'}
    <ContactDetailPage />
  {:else if router.route === 'templates'}
    <TemplatesPage />
  {:else if router.route === 'jobs'}
    <JobsPage />
  {:else if router.route === 'history'}
    <HistoryPage />
  {:else if router.route === 'data'}
    <DataPage />
  {/if}
</AppShell>
