/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw, AlertTriangle, CheckCircle2, Server, Terminal, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { JobRun } from '../../types/domain';
import { useJobsStore } from '../../stores/jobs';

export interface RunDetailsSheetProps {
  run: JobRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInspectJob: (jobId: string) => void;
}

export function RunDetailsSheet({
  run,
  open,
  onOpenChange,
  onInspectJob,
}: RunDetailsSheetProps) {
  const { runJobNow } = useJobsStore();

  if (!run) return null;

  const isSuccess = run.status_code === 202;

  const handleRerun = async () => {
    toast.loading(`Re-running dispatch for ${run.job_title}...`, { id: `rerun-${run.id}` });
    const success = await runJobNow(run.job_id);
    if (success) {
      toast.success(`Dispatched ${run.job_title}`, {
        id: `rerun-${run.id}`,
        description: `HTTP 202 Accepted → Sent to ${run.recipient}`,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg border-l border-border bg-card p-6 shadow-2xl overflow-y-auto text-foreground focus:outline-none flex flex-col justify-between">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium ${
                      isSuccess
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}
                  >
                    {isSuccess ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    <span>HTTP {run.status_code}</span>
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {run.trigger_mode === 'manual' ? 'Manual Operator Run' : 'Scheduled Cron Dispatch'}
                  </span>
                </div>
                <Dialog.Title className="text-base font-semibold leading-tight">
                  {run.job_title}
                </Dialog.Title>
                <div className="text-xs font-mono text-muted-foreground">
                  Run ID: {run.id} · {run.timestamp}
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>

            {/* Error & Stacktrace banner if failed */}
            {run.error_message && (
              <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-xs font-mono">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{run.error_message}</span>
                </div>
                {run.stack_trace && (
                  <pre className="p-2.5 rounded-lg bg-black/40 text-[11px] font-mono text-rose-300 overflow-x-auto whitespace-pre leading-relaxed">
                    {run.stack_trace}
                  </pre>
                )}
              </div>
            )}

            {/* Dispatched Payload Snapshot */}
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                Dispatched Payload Snapshot (<span className="font-mono">POST /send</span>)
              </span>
              <div className="p-3.5 rounded-xl border border-border bg-background font-mono text-xs whitespace-pre-wrap text-foreground leading-relaxed">
                {run.rendered_payload || run.payload_preview}
              </div>
            </div>

            {/* Gateway Response Headers */}
            {run.response_headers && (
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Gateway Downstream Response Headers
                </span>
                <div className="rounded-xl border border-border bg-background overflow-hidden font-mono text-[11px]">
                  {Object.entries(run.response_headers).map(([k, v]) => (
                    <div key={k} className="flex justify-between px-3 py-1.5 border-b border-border last:border-b-0">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source Job Quick Link */}
            <div className="p-3 bg-muted/30 border border-border rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Associated Schedule</span>
                <span className="font-semibold text-foreground">{run.job_title}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onInspectJob(run.job_id);
                  onOpenChange(false);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors min-h-[36px]"
              >
                <span>Edit Job</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-4 border-t border-border mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted min-h-[44px]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleRerun}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs"
            >
              <RefreshCw size={14} />
              <span>Re-run / Retry Now</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
