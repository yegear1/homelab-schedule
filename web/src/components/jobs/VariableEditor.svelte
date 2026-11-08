<script lang="ts">
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';
  type Entry = { key: string; value: string };
  let { entries = $bindable() }: { entries: Entry[] } = $props();
  let key = $state('');
  let value = $state('');
  function addCustomVar(): void {
    const clean = key.trim().replace(/[{}]/g, '');
    if (!clean) return;
    entries = [...entries.filter((entry) => entry.key !== clean), { key: clean, value: value.trim() }];
    key = ''; value = '';
  }
  function handleEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter') { event.preventDefault(); addCustomVar(); }
  }
</script>

<section class="flex min-w-0 flex-col gap-3" id="section-custom-variables" aria-label="Variáveis">
  <h3 class="font-semibold text-label">Variáveis</h3>
  <p class="ui-hint">Adicione uma chave e seu valor para usar na mensagem ou no modelo.</p>
  {#each entries as entry (entry.key)}
    <div class="flex flex-wrap items-center justify-between gap-2 break-all">
      <span>{entry.key}: {entry.value}</span>
      <Button aria-label="Remover variável {entry.key}" onclick={() => (entries = entries.filter((v) => v.key !== entry.key))}>Remover</Button>
    </div>
  {/each}
  <Field id="input-var-key" label="Chave"><input class="ui-input" id="input-var-key" bind:value={key} onkeydown={handleEnter} /></Field>
  <Field id="input-var-value" label="Valor"><input class="ui-input" id="input-var-value" bind:value={value} onkeydown={handleEnter} /></Field>
  <Button id="btn-add-var" onclick={addCustomVar}>Adicionar variável</Button>
</section>
