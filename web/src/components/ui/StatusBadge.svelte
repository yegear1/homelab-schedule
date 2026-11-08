<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = { children: Snippet; tone?: 'neutral' | 'success' | 'error' };
  let { children, tone = 'neutral' }: Props = $props();
</script>

<span class="ui-status" data-tone={tone}><span aria-hidden="true" class="ui-status-dot"></span>{@render children()}</span>
