<script lang="ts">
  import type { Snippet } from 'svelte';
  import { focusTrap } from '../../lib/focusTrap';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  type Props = { id: string; title: string; description?: string; children: Snippet; onclose: () => void };
  let { id, title, description, children, onclose }: Props = $props();
</script>

<div class="ui-dialog-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onclose(); }}>
  <div use:focusTrap={{ onclose }} class="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="{id}-title" aria-describedby={description ? `${id}-description` : undefined} tabindex="-1" {id}>
    <header class="ui-dialog-header">
      <h2 id="{id}-title">{title}</h2>
      <Button variant="quiet" aria-label="Fechar" onclick={onclose}><Icon name="close" /></Button>
    </header>
    {#if description}<p class="ui-hint" id="{id}-description">{description}</p>{/if}
    {@render children()}
  </div>
</div>
