<script lang="ts" generics="T extends string">
  import Icon from './Icon.svelte';

  type Option = {
    value: T;
    label: string;
    id: string;
    icon?: 'sun' | 'moon' | 'system' | 'agenda' | 'contacts' | 'templates' | 'data' | 'key' | 'close' | 'check' | 'info' | 'warning';
  };
  type Props = { label: string; value: T; options: Option[]; onchange: (value: T) => void };
  let { label, value, options, onchange }: Props = $props();
</script>

<div class="ui-segments" role="group" aria-label={label}>
  {#each options as option}
    <button
      id={option.id}
      type="button"
      aria-label="Tema {option.label}"
      aria-pressed={value === option.value}
      onclick={() => onchange(option.value)}
    >
      {#if option.icon}
        <Icon name={option.icon} size={15} />
      {/if}
      <span>{option.label}</span>
    </button>
  {/each}
</div>
