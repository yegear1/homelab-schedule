/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Save, Trash2, AlertTriangle, Braces, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Template } from '../../types/domain';
import { BUILTIN_SYSTEM_TOKENS, extractPlaceholders } from './templates.fixtures';
import { PlaceholderToolbar } from './wdg-placeholder-toolbar';
import { TemplatePreview } from './wdg-template-preview';

export interface TemplateEditorProps {
  template: Template | null;
  onSaveTemplate: (id: string | null, data: { name: string; body: string }) => void | Promise<void>;
  onDeleteTemplate: (id: string) => void | Promise<void>;
}

export function TemplateEditor({
  template,
  onSaveTemplate,
  onDeleteTemplate,
}: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setBody(template.body || template.content || '');
    } else {
      setName('');
      setBody('');
    }
  }, [template]);

  // Insert token at current cursor position
  const handleInsertToken = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setBody((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const nextBody = body.substring(0, start) + token + body.substring(end);
    setBody(nextBody);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // Real-time scanner checking all placeholders
  const { allPlaceholders, unknownPlaceholders } = useMemo(() => {
    const tokens = extractPlaceholders(body);
    const unknowns = tokens.filter((t) => !BUILTIN_SYSTEM_TOKENS.includes(t));
    return { allPlaceholders: tokens, unknownPlaceholders: unknowns };
  }, [body]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    try {
      await onSaveTemplate(template ? template.id : null, {
        name: name.trim(),
        body: body.trim(),
      });
      toast.success('Template saved successfully', {
        description: `Synchronized ${name.trim()} (${allPlaceholders.length} placeholders).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save template';
      toast.error(msg);
    }
  };

  const handleDeleteAttempt = async () => {
    if (!template) return;
    const jobsCount = template.jobs_count ?? 0;
    if (jobsCount > 0) {
      setConflictError(
        `409 Conflict: Template is currently referenced by ${jobsCount} active jobs. Reassign or cancel jobs first.`
      );
      return;
    }
    try {
      await onDeleteTemplate(template.id);
      setIsDeleteModalOpen(false);
      toast.success(`Template ${template.name} deleted`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '409 Conflict: Template is referenced by active jobs.';
      setConflictError(msg);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-y-auto p-4 md:p-6 space-y-5 shadow-xs">
      {/* Editor Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {template ? 'Edit Template Specification' : 'New Template Draft'}
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            {template ? `ID: ${template.id}` : 'Draft'} · {allPlaceholders.length} detected placeholders
          </span>
        </div>
        <div className="flex items-center gap-2">
          {template && (
            <button
              type="button"
              onClick={() => {
                setConflictError(null);
                setIsDeleteModalOpen(true);
              }}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors min-h-[44px] min-w-[44px] active:scale-[0.98]"
              title="Delete Template"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs"
          >
            <Save size={14} />
            <span>Save Template</span>
          </button>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Template Name (1–80 characters) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily Morning Greeting"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[44px]"
          />
        </div>

        {/* Placeholder Toolbar */}
        <PlaceholderToolbar onInsertToken={handleInsertToken} />

        {/* Body textarea with cursor tracking */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">
              Template Body (<span className="font-mono">{'{{placeholder}}'}</span> format)
            </label>
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {body.length} characters
            </span>
          </div>
          <textarea
            ref={textareaRef}
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message with dynamic placeholders, e.g. {{saudacao}}, {{name}}! ..."
            className="w-full p-3 text-xs font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none leading-relaxed"
          />
        </div>

        {/* Real-time Unknown Token Validation Warnings */}
        {unknownPlaceholders.length > 0 && (
          <div id="unknown-tags-warning" className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Custom Dictionary Variable Detected</span>
            </div>
            {unknownPlaceholders.map((u) => (
              <p key={u} className="text-[11px]">
                Note: &lsquo;{`{{${u}}}`}&rsquo; is not a system standard token; ensure it is supplied in the job&apos;s custom variables dictionary.
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Live Preview & Simulation */}
      <div className="pt-2">
        <TemplatePreview body={body} templateName={name} />
      </div>

      {/* Safety Modal for Delete */}
      <Dialog.Root open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-6 shadow-xl rounded-xl text-foreground focus:outline-none">
            <div className="flex items-center gap-2 pb-3 border-b border-border text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              <Dialog.Title className="text-sm font-semibold">
                Delete Template
              </Dialog.Title>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-foreground">
                Are you sure you want to delete <span className="font-semibold">{template?.name}</span>?
              </p>
              {conflictError && (
                <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs font-mono">
                  {conflictError}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDeleteAttempt}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
