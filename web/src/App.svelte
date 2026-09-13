<script lang="ts">
  import AppShell from './layout/AppShell.svelte';
  import { router } from './lib/router.svelte';
  import ContactsPage from './pages/ContactsPage.svelte';
  import ContactDetailPage from './pages/ContactDetailPage.svelte';
  import TemplatesPage from './pages/TemplatesPage.svelte';
  import JobsPage from './pages/JobsPage.svelte';
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
  {/if}
</AppShell>
