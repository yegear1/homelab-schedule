<script lang="ts">
  import { router } from '../lib/router.svelte';
  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
  // Compatibility entry point for callers of the former backup dialog.
  $effect(() => { if (open) { router.navigate('/data'); onclose(); } });
</script>
