<script lang="ts">
  import { api } from '../../lib/api';
  import { toast } from '../../lib/toast.svelte';
  import { buildPayload, newDraft } from '../../lib/jobs/composer';
  import type { MessageTemplate } from '../../lib/types';
  import Dialog from '../ui/Dialog.svelte';
  import Button from '../ui/Button.svelte';
  import JobScheduleFields from './JobScheduleFields.svelte';
  import JobRecipients from './JobRecipients.svelte';
  import JobMessageFields from './JobMessageFields.svelte';
  import JobAdvancedFields from './JobAdvancedFields.svelte';

  type Props = { open?: boolean; inline?: boolean; recipient?: string; createdBy?: string;
    onclose?: () => void; oncreated: () => void | Promise<void> };
  let { open = false, inline = false, recipient = 'eu', createdBy = '', onclose, oncreated }: Props = $props();
  let draft = $state(newDraft());
  let busy = $state(false);
  let error = $state('');
  let templates = $state<MessageTemplate[]>([]);
  let tags = $state<string[]>([]);
  let loadingCatalog = $state(false);
  let catalogError = $state('');
  let catalogVersion = 0;

  $effect(() => {
    if (inline || open) {
      draft = newDraft(recipient, createdBy);
      error = '';
      void loadCatalog();
      return () => { catalogVersion += 1; };
    }
  });

  async function loadCatalog(): Promise<void> {
    const version = ++catalogVersion;
    loadingCatalog = true;
    catalogError = '';
    const [templateResult, tagResult] = await Promise.allSettled([api.getTemplates(), api.getTags()]);
    if (version !== catalogVersion) return;
    templates = templateResult.status === 'fulfilled' ? templateResult.value : [];
    tags = tagResult.status === 'fulfilled' ? tagResult.value : [];
    if (templateResult.status === 'rejected' || tagResult.status === 'rejected') {
      catalogError = 'Não foi possível carregar todos os modelos e tags. Você pode usar texto e valores manuais.';
    }
    loadingCatalog = false;
  }

  function close(): void { if (!busy) onclose?.(); }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const result = buildPayload(draft);
    if (!result.ok) { error = result.error; return; }
    busy = true;
    error = '';
    const { common, recipients } = result.payload;
    try {
      if (recipients.length > 1) await api.createBatchJobs({ ...common, recipients });
      else await api.createJob({ ...common, to: recipients[0] });
    } catch (cause: unknown) {
      error = cause instanceof Error ? cause.message : 'Não foi possível agendar. Tente novamente.';
      busy = false;
      return;
    }
    draft = newDraft(recipient, createdBy);
    toast.success(recipients.length > 1 ? 'Grupo de agendamentos criado.' : 'Agendamento criado.');
    try { await oncreated(); }
    catch { toast.error('Agendamento criado. Atualize a lista para visualizar.'); }
    busy = false;
    if (!inline) onclose?.();
  }
</script>

{#snippet form()}
  <form id="form-job-create" class="ui-form" onsubmit={handleSubmit} data-state={busy ? 'busy' : error ? 'error' : 'ready'} aria-busy={busy}>
    {#if error}<p class="ui-field-error" role="alert">{error}</p>{/if}
    {#if loadingCatalog}<p class="ui-hint" role="status">Carregando modelos e tags…</p>{/if}
    {#if catalogError}
      <div class="flex flex-col gap-2"><p class="ui-field-error" role="alert">{catalogError}</p><Button disabled={busy} onclick={loadCatalog}>Recarregar modelos e tags</Button></div>
    {/if}
    {#key draft}
    <fieldset disabled={busy} class="flex min-w-0 flex-col gap-6 border-0 p-0">
      <legend class="sr-only">Novo agendamento</legend>
      <JobScheduleFields bind:draft />
      <JobRecipients bind:draft />
      <JobMessageFields bind:draft {templates} />
      <JobAdvancedFields bind:draft {tags} />
      <footer class="ui-form-actions">
        {#if !inline}<Button onclick={close}>Cancelar</Button>{/if}
        <Button id="btn-create-job-submit" type="submit" variant="primary">{busy ? 'Agendando…' : 'Agendar Recado'}</Button>
      </footer>
    </fieldset>
    {/key}
  </form>
{/snippet}

{#if inline}
  <section class="ui-panel" id="wdg-job-create" aria-labelledby="composer-heading">
    <h2 id="composer-heading" class="text-xl font-semibold text-label">Novo agendamento</h2>
    {@render form()}
  </section>
{:else if open}
  <div id="modal-job-create">
    <Dialog id="wdg-job-create" title="Novo agendamento" description="Defina quem recebe, a mensagem e quando ela será enviada." onclose={close}>
      {@render form()}
    </Dialog>
  </div>
{/if}
