<script lang="ts">
  import type { JobDraft } from '../../lib/jobs/composer';
  import Field from '../ui/Field.svelte';
  let { draft = $bindable() }: { draft: JobDraft } = $props();
</script>

<Field id="create-title" label="Título">
  <input class="ui-input" id="create-title" name="title" maxlength="120" required bind:value={draft.title} />
</Field>
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <Field id="create-kind" label="Frequência">
    <select class="ui-input" id="create-kind" name="kind" bind:value={draft.kind}>
      <option value="once">Uma vez</option><option value="cron">Recorrente</option>
    </select>
  </Field>
  {#if draft.kind === 'once'}
    <Field id="create-run-at" label="Data e hora" hint="Horário local deste navegador.">
      <input class="ui-input" id="create-run-at" name="run_at" type="datetime-local" required bind:value={draft.runAt} aria-describedby="create-run-at-hint" />
    </Field>
  {:else}
    <Field id="create-cron-expr" label="Expressão cron" hint="Minuto, hora, dia, mês e dia da semana; fuso do servidor.">
      <input class="ui-input" id="create-cron-expr" name="cron_expr" placeholder="0 9 * * 1-5" required bind:value={draft.cronExpr} aria-describedby="create-cron-expr-hint" />
    </Field>
  {/if}
</div>
