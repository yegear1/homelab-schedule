<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  type Props = HTMLButtonAttributes & { children: Snippet; variant?: 'primary' | 'secondary' | 'quiet' | 'danger' };
  let { children, variant = 'secondary', class: className = '', type = 'button', ...attributes }: Props = $props();
</script>

<button {type} {...attributes} class="ui-button {className}" data-variant={variant}>
  {@render children()}
</button>
