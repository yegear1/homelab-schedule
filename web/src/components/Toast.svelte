<script lang="ts">
  import { toast } from '../lib/toast.svelte';
</script>

<div
  class="fixed bottom-6 right-6 z-50 transition-all duration-300 pointer-events-none flex items-center gap-space-xs px-space-md py-space-sm rounded bg-surface-container-highest text-on-surface shadow-xl font-label-code text-label-code font-mono {toast.state.visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}"
  id="toast-notify"
>
  <span class="material-symbols-outlined text-[18px] {toast.state.colorClass}">
    {toast.state.icon}
  </span>
  <span>{toast.state.message}</span>
</div>
