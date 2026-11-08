<script lang="ts">
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';
  let { tags = $bindable(), available }: { tags: string[]; available: string[] } = $props();
  let input = $state('');
  function addTag(): void {
    tags = [...new Set([...tags, ...input.split(/[,;\s]+/)].map((t) => t.trim().toLowerCase()).filter(Boolean))];
    input = '';
  }
</script>

<section class="flex min-w-0 flex-col gap-3" id="section-tags" aria-label="Tags">
  <h3 class="font-semibold text-label">Tags</h3>
  <div class="flex flex-wrap gap-2">
    {#each tags as tag}<Button aria-label="Remover tag {tag}" onclick={() => (tags = tags.filter((t) => t !== tag))}>{tag}<span aria-hidden="true">×</span></Button>{/each}
  </div>
  <Field id="input-tag" label="Nova tag">
    <input class="ui-input" id="input-tag" list="modal-tags-datalist" bind:value={input} onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} />
  </Field>
  <datalist id="modal-tags-datalist">{#each available as tag}<option value={tag}></option>{/each}</datalist>
  <Button id="btn-add-tag" onclick={addTag}>Adicionar tag</Button>
</section>
