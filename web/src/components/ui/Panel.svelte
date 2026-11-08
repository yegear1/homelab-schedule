<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = { children: Snippet; class?: string };
  let { children, class: className = '' }: Props = $props();
</script>

<div class="ui-panel {className}">{@render children()}</div>
