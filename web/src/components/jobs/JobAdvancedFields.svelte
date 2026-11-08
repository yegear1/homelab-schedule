<script lang="ts">
  import type { JobDraft } from '../../lib/jobs/composer';
  import Field from '../ui/Field.svelte';
  import VariableEditor from './VariableEditor.svelte';
  import TagInput from './TagInput.svelte';
  let { draft = $bindable(), tags }: { draft: JobDraft; tags: string[] } = $props();
</script>

<details class="rounded-xl border border-separator p-4">
  <summary class="min-h-11 cursor-pointer font-semibold text-label">Opções avançadas</summary>
  <div class="mt-4 flex min-w-0 flex-col gap-6">
    <Field id="create-until" label="Data limite (opcional)">
      <input class="ui-input" id="create-until" name="until" type="datetime-local" bind:value={draft.until} />
    </Field>
    <Field id="create-max-runs" label="Máximo de execuções (opcional)">
      <input class="ui-input" id="create-max-runs" name="max_runs" type="number" min="1" step="1" bind:value={draft.maxRuns} />
    </Field>
    <VariableEditor bind:entries={draft.variables} />
    <TagInput bind:tags={draft.tags} available={tags} />
  </div>
</details>
