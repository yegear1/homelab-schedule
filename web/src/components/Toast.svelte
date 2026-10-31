<script lang="ts">
  import { toast } from '../lib/toast.svelte';
</script>

<div
  class="toast-surface pointer-events-none flex items-center gap-space-sm font-body-md text-body-md"
  data-visible={toast.state.visible}
  role="status"
  aria-live="polite"
  aria-atomic="true"
  id="toast-notify"
>
  <span aria-hidden="true" class="material-symbols-outlined text-[18px] {toast.state.colorClass}">
    {toast.state.icon}
  </span>
  <span>{toast.state.message}</span>
</div>
