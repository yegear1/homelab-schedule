<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { focusTrap } from '../lib/focusTrap';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let keyInput = $state(api.getApiKey());
  let urlInput = $state(typeof window !== 'undefined' ? localStorage.getItem('homelab_api_base_url') || '' : '');

  $effect(() => {
    if (open) {
      keyInput = api.getApiKey();
      urlInput = localStorage.getItem('homelab_api_base_url') || '';

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onclose();
      };
      window.addEventListener('keydown', handleKeydown);
      return () => window.removeEventListener('keydown', handleKeydown);
    }
  });

  function handleSave(e: SubmitEvent) {
    e.preventDefault();
    api.setApiKey(keyInput.trim());
    api.setBaseUrl(urlInput.trim());
    toast.success('Configurações salvas localmente no navegador.');
    onclose();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-space-md cursor-pointer"
    onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
    role="presentation"
  >
    <div
      use:focusTrap
      class="bg-surface-container-low max-w-md w-full rounded p-space-lg shadow-xl flex flex-col gap-space-md border border-outline-variant/30 cursor-default"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-center justify-between pb-space-xs">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[20px]">key</span>
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Configurar Acesso à API</h3>
        </div>
        <button
          class="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container"
          onclick={onclose}
          type="button"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <p class="font-body-sm text-body-sm text-on-surface-variant">
        A chave <code class="font-label-code text-tertiary">x-api-key</code> é transmitida no cabeçalho das requisições para autorização no daemon local.
      </p>

      <form class="flex flex-col gap-space-md" onsubmit={handleSave}>
        <div class="flex flex-col gap-1">
          <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="input-api-key">
            Chave SCHEDULE_API_KEY
          </label>
          <input
            id="input-api-key"
            class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary"
            type="password"
            bind:value={keyInput}
            placeholder="Cole aqui o valor de SCHEDULE_API_KEY..."
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="input-base-url">
            URL Base da API (Opcional)
          </label>
          <input
            id="input-base-url"
            class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary"
            type="text"
            bind:value={urlInput}
            placeholder="Padrão: mesma origem (vazio) ou http://localhost:8003"
          />
          <span class="font-body-sm text-body-sm text-outline">Deixe em branco se a UI estiver rodando no mesmo host.</span>
        </div>

        <div class="flex items-center justify-end gap-space-sm pt-space-xs">
          <button
            class="px-space-md py-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-ui text-label-ui uppercase"
            onclick={onclose}
            type="button"
          >
            Cancelar
          </button>
          <button
            class="px-space-md py-space-sm rounded bg-primary hover:bg-primary-fixed-dim text-on-primary font-label-ui text-label-ui uppercase font-semibold transition-all"
            type="submit"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
