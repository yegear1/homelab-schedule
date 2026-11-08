<script lang="ts">
  import { toast } from '../lib/toast.svelte';
  import Icon from './ui/Icon.svelte';
</script>

<div class="ui-toast" data-visible={toast.state.visible} data-tone={toast.state.isError ? 'error' : 'neutral'} role="status" aria-live="polite" aria-atomic="true" id="toast-notify">
  {#if toast.state.visible}
    <Icon name={toast.state.isError ? 'warning' : toast.state.icon === 'check_circle' ? 'check' : 'info'} />
    <span>{toast.state.message}</span>
  {/if}
</div>
