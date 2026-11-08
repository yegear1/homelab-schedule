<script lang="ts">
  import { placeholderGroups, samplePreview, unknownPlaceholders } from './placeholders';
  import Button from '../ui/Button.svelte';
  let { body, disabled = false, oninsert }: { body: string; disabled?: boolean; oninsert: (tag: string) => void } = $props();
  const unknown = $derived(unknownPlaceholders(body));
  const preview = $derived(samplePreview(body));
</script>
<section class="grid gap-4" aria-label="Guia de variáveis">
  <h3 class="font-semibold">Inserir variável no cursor</h3>
  {#each placeholderGroups as group}<div class="grid gap-2"><h4 class="ui-hint">{group.title}</h4><div class="flex flex-wrap gap-2">{#each group.tags as key}{@const tag = `{{${key}}}`}<Button {disabled} aria-label="Inserir {tag}" onclick={() => oninsert(tag)}>{tag}</Button>{/each}</div></div>{/each}
  {#if unknown.length}<p id="unknown-tags-warning" class="ui-hint" role="status">Variáveis personalizadas ou desconhecidas: {unknown.join(', ')}. Permanecem literais nesta prévia; valores personalizados podem ser fornecidos no agendamento.</p>{/if}
  <div class="grid gap-2"><h3 class="font-semibold">Prévia ilustrativa</h3><p class="ui-hint">Exemplo com Carlos Silva e o horário local do navegador. O servidor preenche as variáveis no momento do disparo; esta prévia não confirma o conteúdo final.</p><p id="live-preview-box" class="preview">{preview || 'Digite a mensagem para visualizar um exemplo.'}</p></div>
</section>
<style>
  .preview { white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px; border-radius: 12px; background: rgb(var(--fill)); }
</style>
