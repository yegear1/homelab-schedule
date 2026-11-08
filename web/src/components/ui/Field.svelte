<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = { id: string; label: string; hint?: string; error?: string; children: Snippet };
  let { id, label, hint, error, children }: Props = $props();
</script>

<div class="ui-field" data-state={error ? 'error' : 'ready'}>
  <label for={id}>{label}</label>
  {@render children()}
  {#if hint}<p id="{id}-hint" class="ui-hint">{hint}</p>{/if}
  {#if error}<p id="{id}-error" class="ui-field-error" role="alert">{error}</p>{/if}
</div>
