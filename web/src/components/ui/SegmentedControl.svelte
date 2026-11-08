<script lang="ts" generics="T extends string">
  type Option = { value: T; label: string; id: string };
  type Props = { label: string; value: T; options: Option[]; onchange: (value: T) => void };
  let { label, value, options, onchange }: Props = $props();
</script>

<div class="ui-segments" role="group" aria-label={label}>
  {#each options as option}
    <button id={option.id} type="button" aria-label="Tema {option.label}" aria-pressed={value === option.value} onclick={() => onchange(option.value)}>{option.label}</button>
  {/each}
</div>
