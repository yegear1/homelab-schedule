<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import Dialog from './ui/Dialog.svelte';
  import Field from './ui/Field.svelte';
  import Button from './ui/Button.svelte';
  import Panel from './ui/Panel.svelte';

  type Props = { open: boolean; onclose: () => void };
  let { open, onclose }: Props = $props();
  let keyInput = $state('');
  let urlInput = $state('');
  let error = $state('');

  $effect(() => {
    if (open) {
      keyInput = api.getApiKey();
      urlInput = localStorage.getItem('homelab_api_base_url') || '';
      error = '';
    }
  });

  function handleSave(event: SubmitEvent): void {
    event.preventDefault();
    try {
      api.setApiKey(keyInput.trim());
      api.setBaseUrl(urlInput.trim());
      toast.success('Configurações salvas localmente no navegador.');
      onclose();
    } catch {
      error = 'Não foi possível salvar. Verifique se o navegador permite armazenamento local.';
    }
  }
</script>

{#if open}
  <Dialog id="api-key-modal" title="Acesso à API" description="Configure a conexão usada por este navegador." {onclose}>
    <form class="ui-form" onsubmit={handleSave}>
      <Field id="input-api-key" label="Chave da API" hint="Salva apenas neste navegador. Deixe vazia para remover o acesso.">
        <input class="ui-input" id="input-api-key" name="api_key" type="password" autocomplete="off" spellcheck="false" bind:value={keyInput} aria-describedby="input-api-key-hint" />
      </Field>
      <Field id="input-base-url" label="URL da API (opcional)" hint="Deixe em branco para usar o mesmo endereço da aplicação.">
        <input class="ui-input" id="input-base-url" name="base_url" type="text" inputmode="url" placeholder="http://localhost:8003" bind:value={urlInput} aria-describedby="input-base-url-hint" />
      </Field>
      <Panel><p class="ui-hint">Sua agenda continua no servidor. Estas configurações alteram apenas o acesso neste navegador.</p></Panel>
      {#if error}<p class="ui-field-error" role="alert">{error}</p>{/if}
      <footer class="ui-form-actions">
        <Button onclick={onclose}>Cancelar</Button>
        <Button type="submit" variant="primary">Salvar</Button>
      </footer>
    </form>
  </Dialog>
{/if}
