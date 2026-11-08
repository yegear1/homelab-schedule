<script lang="ts">
  import type { JobDraft } from '../../lib/jobs/composer';
  import type { MessageTemplate } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';
  let { draft = $bindable(), templates }: { draft: JobDraft; templates: MessageTemplate[] } = $props();
  const selected = $derived(templates.find((t) => t.id === draft.templateId));
  function clearTemplate(): void {
    draft.templateId = '';
    draft.payloadMode = 'direct';
    draft.content = '';
  }
</script>

<section class="flex min-w-0 flex-col gap-4" id="wdg-template-pick" aria-label="Mensagem">
  <Field id="create-payload-mode" label="Mensagem">
    <select class="ui-input" id="create-payload-mode" name="payload_mode" bind:value={draft.payloadMode}>
      <option value="direct">Texto direto</option><option value="template">Modelo salvo</option>
    </select>
  </Field>
  {#if draft.payloadMode === 'direct'}
    <Field id="create-content" label="Texto da mensagem">
      <textarea class="ui-input" id="create-content" name="content" rows="4" required bind:value={draft.content}></textarea>
    </Field>
  {:else}
    <Field id="create-template-id" label="Modelo">
      <select class="ui-input" id="create-template-id" name="template_id" required bind:value={draft.templateId}>
        <option value="">Selecione um modelo</option>
        {#each templates as template}<option value={template.id}>{template.name}</option>{/each}
      </select>
    </Field>
    {#if selected}<p class="ui-hint whitespace-pre-wrap break-words" aria-label="Texto do modelo">{selected.body}</p>{/if}
    <Button aria-label="Remover modelo selecionado" onclick={clearTemplate}>Voltar ao texto direto</Button>
  {/if}
</section>
