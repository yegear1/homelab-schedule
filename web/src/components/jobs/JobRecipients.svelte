<script lang="ts">
  import type { JobDraft } from '../../lib/jobs/composer';
  import { splitRecipients } from '../../lib/jobs/composer';
  import ContactPickerModal from '../ContactPickerModal.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';
  let { draft = $bindable() }: { draft: JobDraft } = $props();
  let picker = $state<'to' | 'created_by' | null>(null);
  function addRecipient(): void {
    draft.recipients = splitRecipients(draft.recipients, draft.recipientInput);
    draft.recipientInput = '';
  }
  function selectContact(value: string): void {
    if (picker === 'to') draft.recipients = splitRecipients(draft.recipients, value);
    else draft.createdBy = value;
  }
</script>

<section class="flex min-w-0 flex-col gap-3" aria-label="Destinatários">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3 class="font-semibold text-label">Destinatários</h3>
    <Button onclick={() => (picker = 'to')}>Adicionar Contato</Button>
  </div>
  <div class="flex flex-wrap gap-2" aria-label="Destinatários selecionados">
    {#each draft.recipients as recipient, index (recipient)}
      <Button aria-label="Remover destinatário {recipient}" onclick={() => (draft.recipients = draft.recipients.filter((_, i) => i !== index))}>{recipient}<span aria-hidden="true">×</span></Button>
    {/each}
  </div>
  <Field id="input-add-recipient" label="Número ou alias" hint="Separe vários destinatários com espaço, vírgula ou ponto e vírgula.">
    <input class="ui-input" id="input-add-recipient" name="to" bind:value={draft.recipientInput} aria-describedby="input-add-recipient-hint" onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addRecipient(); } }} />
  </Field>
  <Button onclick={addRecipient}>Adicionar destinatário</Button>
  <Field id="create-created-by" label="Criador (opcional)">
    <input class="ui-input" id="create-created-by" name="created_by" bind:value={draft.createdBy} />
  </Field>
  <Button onclick={() => (picker = 'created_by')}>Selecionar criador</Button>
</section>
<ContactPickerModal open={picker !== null} onselect={selectContact} onclose={() => (picker = null)} />
