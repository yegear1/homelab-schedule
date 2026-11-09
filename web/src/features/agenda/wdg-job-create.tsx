/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Calendar,
  Repeat,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  User,
  Users,
  Search,
  Check,
  Zap,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { useJobsStore } from '../../stores/jobs';
import { REFRESH_FAILED } from '../../lib/jobs/mutations';
import { Contact, ScheduleKind } from '../../types/domain';

export interface JobCreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRecipient?: string;
  lockRecipient?: boolean;
}

export function JobCreate({
  open,
  onOpenChange,
  initialRecipient,
  lockRecipient = false,
}: JobCreateProps) {
  const { createJob, templates, contacts } = useJobsStore();

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ScheduleKind>('once');
  const [runAt, setRunAt] = useState('2026-11-09T09:00');
  const [cronExpr, setCronExpr] = useState('0 8 * * *');
  const [cronHuman, setCronHuman] = useState('Every day at 08:00');
  const [messageType, setMessageType] = useState<'direct' | 'template'>('direct');
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');
  const [recipientChips, setRecipientChips] = useState<string[]>(
    initialRecipient ? [initialRecipient] : ['+5511988887777']
  );
  const [chipText, setChipText] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Advanced accordion state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [createdBy, setCreatedBy] = useState('operator');
  const [maxRuns, setMaxRuns] = useState<number | undefined>(undefined);
  const [until, setUntil] = useState('');
  const [variables, setVariables] = useState<Array<{ key: string; val: string }>>([
    { key: 'name', val: 'Admin' },
  ]);

  // Keep recipientChips in sync if initialRecipient prop changes when opened
  useEffect(() => {
    if (open && initialRecipient) {
      setRecipientChips([initialRecipient]);
    }
  }, [open, initialRecipient]);

  const cronPresets = [
    { label: 'Daily at 08:00', expr: '0 8 * * *', human: 'Every day at 08:00' },
    { label: 'Weekly Monday', expr: '0 9 * * 1', human: 'Every Monday at 09:00' },
    { label: 'Hourly', expr: '0 * * * *', human: 'Hourly at minute 0' },
    { label: 'Weekday Mornings', expr: '30 7 * * 1-5', human: 'Weekdays at 07:30' },
  ];

  // Helper to match a recipient string with a saved Contact
  const getContactForRecipient = (value: string): Contact | undefined => {
    const norm = value.trim().toLowerCase();
    return contacts.find(
      (c) =>
        c.phone.toLowerCase() === norm ||
        c.alias.toLowerCase() === norm ||
        (c.name && c.name.toLowerCase() === norm)
    );
  };

  // Check if a saved contact is already added in the recipient chips
  const isContactSelected = (contact: Contact): boolean => {
    return recipientChips.some((chip) => {
      const norm = chip.trim().toLowerCase();
      return (
        norm === contact.phone.toLowerCase() ||
        norm === contact.alias.toLowerCase() ||
        (contact.name && norm === contact.name.toLowerCase())
      );
    });
  };

  // Toggle contact selection via quick shortcut pill
  const toggleContact = (contact: Contact) => {
    if (lockRecipient) return;
    if (isContactSelected(contact)) {
      setRecipientChips(
        recipientChips.filter((chip) => {
          const norm = chip.trim().toLowerCase();
          return (
            norm !== contact.phone.toLowerCase() &&
            norm !== contact.alias.toLowerCase() &&
            (!contact.name || norm !== contact.name.toLowerCase())
          );
        })
      );
      toast.info(`Removido alias: ${contact.alias}`);
    } else {
      setRecipientChips([...recipientChips, contact.phone]);
      toast.success(`Adicionado alias: ${contact.alias}`, {
        description: `Telefone mapeado: ${contact.phone}`,
      });
    }
  };

  // Quick action: Add all saved contacts for broadcast
  const addAllContacts = () => {
    if (lockRecipient) return;
    const allPhones = contacts.map((c) => c.phone);
    const merged = Array.from(new Set([...recipientChips, ...allPhones]));
    setRecipientChips(merged);
    toast.success(`Adicionados todos os ${contacts.length} contatos salvos`, {
      description: 'Modo de envio em lote ativado.',
    });
  };

  // Add custom typed recipient or matched contact
  const addRecipientChip = (customValue?: string) => {
    const raw = (customValue !== undefined ? customValue : chipText).trim();
    if (!raw) return;

    const matched = getContactForRecipient(raw);
    const toAdd = matched ? matched.phone : raw;

    if (!recipientChips.includes(toAdd)) {
      setRecipientChips([...recipientChips, toAdd]);
      if (matched) {
        toast.success(`Alias "${matched.alias}" adicionado`);
      }
    }
    setChipText('');
  };

  const removeChip = (recipientId: string) => {
    setRecipientChips(recipientChips.filter((c) => c !== recipientId));
  };

  // Filter contacts for the quick shortcut bar
  const filteredShortcutContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        c.alias.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        (c.role || '').toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [contacts, contactSearch]);

  // Suggestions for autocomplete when typing in recipient input
  const suggestions = useMemo(() => {
    const q = chipText.trim().toLowerCase();
    if (!q) return [];
    return contacts.filter(
      (c) =>
        c.alias.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [contacts, chipText]);

  const handleAddVariable = () => {
    setVariables([...variables, { key: '', val: '' }]);
  };

  const handleVariableChange = (idx: number, field: 'key' | 'val', value: string) => {
    const updated = [...variables];
    updated[idx][field] = value;
    setVariables(updated);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    const finalRecipients = recipientChips.length > 0 ? recipientChips : [chipText.trim()];
    if (finalRecipients.length === 0 || !finalRecipients[0]) {
      toast.error('At least one recipient phone number or contact alias is required');
      return;
    }
    if (messageType === 'direct' && !text.trim()) {
      toast.error('Message text is required for direct dispatch');
      return;
    }
    if (messageType === 'template' && !templateId) {
      toast.error('Please select a template');
      return;
    }

    const varMap: Record<string, string> = {};
    variables.forEach(({ key, val }) => {
      if (key.trim()) varMap[key.trim()] = val;
    });

    setIsSubmitting(true);
    try {
      const outcome = await createJob(
        {
          title: title.trim(),
          kind,
          run_at: kind === 'once' ? new Date(runAt).toISOString() : undefined,
          cron_expr: kind === 'cron' ? cronExpr : undefined,
          cron_human: kind === 'cron' ? cronHuman : undefined,
          message_type: messageType,
          text: messageType === 'direct' ? text.trim() : undefined,
          template_id: messageType === 'template' ? templateId : undefined,
          variables: varMap,
          created_by: createdBy || 'operator',
          max_runs: maxRuns ? Number(maxRuns) : undefined,
          until: until ? new Date(until).toISOString() : undefined,
          tags: ['alerts', 'custom'],
        },
        finalRecipients
      );

      const isBatch = finalRecipients.length > 1;
      toast.success(
        isBatch
          ? `Batch job scheduled successfully (${finalRecipients.length} recipients)`
          : 'Job scheduled successfully',
        {
          description: 'Saved to the agenda; delivery happens at the scheduled time.',
        }
      );
      if (!outcome.refreshed) toast.warning(REFRESH_FAILED);

      setTitle('');
      setText('');
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule job';
      toast.error(`Scheduling failed: ${msg}`);
      // Draft is intentionally kept so the operator can correct it and submit again.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg border-l border-border bg-card p-6 shadow-2xl overflow-y-auto text-foreground focus:outline-none">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sky-500" />
              <Dialog.Title className="text-base font-semibold">
                Schedule New Dispatch Job
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-[0.98]"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Job Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Daily Temperature Alert"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-sky-500 focus:outline-none min-h-[44px]"
              />
            </div>

            {/* Schedule Type Radio Pills */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Schedule Cadence
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setKind('once')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors min-h-[40px] ${
                    kind === 'once'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Calendar size={14} />
                  <span>Once (One-off)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setKind('cron')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors min-h-[40px] ${
                    kind === 'cron'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Repeat size={14} />
                  <span>Recurring Cron</span>
                </button>
              </div>

              {kind === 'once' ? (
                <div className="mt-3">
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Execute Date & Time (UTC converted)
                  </label>
                  <input
                    type="datetime-local"
                    value={runAt}
                    onChange={(e) => setRunAt(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-sky-500 focus:outline-none min-h-[44px]"
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    {cronPresets.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setCronExpr(p.expr);
                          setCronHuman(p.human);
                        }}
                        className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${
                          cronExpr === p.expr
                            ? 'border-sky-500 bg-sky-500/10 text-sky-500 font-semibold'
                            : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={cronExpr}
                    onChange={(e) => setCronExpr(e.target.value)}
                    placeholder="0 8 * * *"
                    className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-sky-500 focus:outline-none min-h-[44px]"
                  />
                </div>
              )}
            </div>

            {/* Recipients multi-chip field & Contact Alias Shortcuts */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  Recipients (Phone numbers or Contact Aliases) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {recipientChips.length > 1
                    ? `Batch Mode (${recipientChips.length})`
                    : recipientChips.length === 1
                    ? '1 Destinatário'
                    : 'Nenhum'}
                </span>
              </div>

              {/* Chips Input Box with Autocomplete */}
              <div className="relative">
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-background min-h-[44px] items-center focus-within:ring-1 focus-within:ring-sky-500">
                  {recipientChips.map((chip) => {
                    const matched = getContactForRecipient(chip);
                    return (
                      <span
                        key={chip}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          matched
                            ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                            : 'bg-muted text-foreground border-border'
                        }`}
                      >
                        {matched ? (
                          <User size={12} className="text-sky-500 shrink-0" />
                        ) : (
                          <Phone size={12} className="text-muted-foreground shrink-0" />
                        )}
                        <div className="flex items-center gap-1 font-mono">
                          {matched ? (
                            <>
                              <span className="font-semibold text-foreground font-sans">
                                {matched.alias}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({matched.phone})
                              </span>
                            </>
                          ) : (
                            <span>{chip}</span>
                          )}
                        </div>
                        {!lockRecipient ? (
                          <button
                            type="button"
                            onClick={() => removeChip(chip)}
                            className="text-muted-foreground hover:text-rose-500 ml-0.5 p-0.5 rounded transition-colors"
                            title="Remover destinatário"
                          >
                            <X size={12} />
                          </button>
                        ) : (
                          <span className="text-[10px] text-sky-500 font-sans font-medium px-1">
                            Locked
                          </span>
                        )}
                      </span>
                    );
                  })}

                  {!lockRecipient && (
                    <input
                      type="text"
                      value={chipText}
                      onChange={(e) => setChipText(e.target.value)}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => {
                        // Small timeout to allow mousedown on suggestions to trigger
                        setTimeout(() => setIsInputFocused(false), 200);
                        addRecipientChip();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          if (suggestions.length > 0 && chipText.trim()) {
                            const first = suggestions[0];
                            if (!isContactSelected(first)) {
                              setRecipientChips([...recipientChips, first.phone]);
                              toast.success(`Alias "${first.alias}" selecionado`);
                            }
                            setChipText('');
                          } else {
                            addRecipientChip();
                          }
                        }
                      }}
                      placeholder={
                        recipientChips.length === 0
                          ? 'Digite alias, nome ou telefone...'
                          : 'Adicionar outro...'
                      }
                      className="flex-1 min-w-[130px] bg-transparent text-xs font-mono focus:outline-none text-foreground placeholder:text-muted-foreground"
                    />
                  )}
                </div>

                {/* Autocomplete Dropdown when typing in recipient input */}
                {isInputFocused && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-border bg-popover shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 border-b border-border flex items-center justify-between">
                      <span>Contatos correspondentes (Alias)</span>
                      <span className="text-[9px] lowercase font-normal">Pressione Enter ou clique</span>
                    </div>
                    {suggestions.map((s) => {
                      const selected = isContactSelected(s);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!selected) {
                              setRecipientChips([...recipientChips, s.phone]);
                              toast.success(`Alias "${s.alias}" adicionado`);
                            }
                            setChipText('');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-sky-500 shrink-0" />
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <span>{s.alias}</span>
                                {selected && (
                                  <span className="text-[10px] px-1 py-0.2 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20 font-normal">
                                    Já adicionado
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {s.role} · {s.tags.slice(0, 2).map((t) => `#${t}`).join(' ')}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                            {s.phone}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Contact Alias Shortcuts Panel */}
              <div className="mt-2.5 rounded-lg border border-border/80 bg-muted/30 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap size={13} className="text-amber-500" />
                    <span className="text-xs font-semibold text-foreground">
                      Atalhos Rápidos de Contatos Salvos
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-muted border border-border text-muted-foreground">
                      {contacts.length}
                    </span>
                  </div>

                  {!lockRecipient && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={addAllContacts}
                        className="text-[11px] text-sky-500 hover:text-sky-600 font-medium px-1.5 py-0.5 rounded hover:bg-sky-500/10 transition-colors"
                        title="Adicionar todos os contatos salvos a este schedule"
                      >
                        + Adicionar Todos
                      </button>
                      {recipientChips.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setRecipientChips([])}
                          className="text-[11px] text-muted-foreground hover:text-rose-500 px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition-colors"
                          title="Limpar todos os destinatários"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline filter when contacts count >= 4 */}
                {contacts.length >= 4 && (
                  <div className="relative mb-2">
                    <Search
                      size={12}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Filtrar atalhos por alias, nome ou telefone..."
                      className="w-full pl-7 pr-6 py-1 text-[11px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    {contactSearch && (
                      <button
                        type="button"
                        onClick={() => setContactSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[11px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Clickable Alias Shortcut Pills */}
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                  {filteredShortcutContacts.map((c) => {
                    const selected = isContactSelected(c);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={lockRecipient}
                        onClick={() => toggleContact(c)}
                        className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                          selected
                            ? 'bg-sky-500 text-white border-sky-600 shadow-xs font-semibold'
                            : 'bg-background hover:bg-muted text-foreground border-border hover:border-sky-500/50 active:scale-[0.98]'
                        } ${lockRecipient ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={`${selected ? 'Remover' : 'Adicionar'} alias ${c.alias} (${c.phone})`}
                      >
                        {selected ? (
                          <Check size={12} className="text-white shrink-0" />
                        ) : (
                          <Plus
                            size={12}
                            className="text-muted-foreground group-hover:text-sky-500 shrink-0"
                          />
                        )}
                        <span className="truncate max-w-[140px]">{c.alias}</span>
                        <span
                          className={`text-[10px] font-mono tabular-nums ${
                            selected ? 'text-sky-100' : 'text-muted-foreground'
                          }`}
                        >
                          {c.phone.slice(-4)}
                        </span>
                      </button>
                    );
                  })}

                  {filteredShortcutContacts.length === 0 && (
                    <div className="text-[11px] text-muted-foreground italic py-1 px-1">
                      Nenhum contato encontrado para &ldquo;{contactSearch}&rdquo;
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-1.5">
                  <span>💡 Clique em qualquer alias para adicionar/remover rapidamente.</span>
                  <span>Separe manuais com Enter</span>
                </div>
              </div>
            </div>

            {/* Message Content Mode */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Message Content
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMessageType('direct')}
                    className={`px-2 py-0.5 rounded ${
                      messageType === 'direct'
                        ? 'bg-sky-500 text-white font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Direct Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageType('template')}
                    className={`px-2 py-0.5 rounded ${
                      messageType === 'template'
                        ? 'bg-sky-500 text-white font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Template
                  </button>
                </div>
              </div>

              {messageType === 'direct' ? (
                <div>
                  <textarea
                    rows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter notification text to be dispatched via WhatsApp/HTTP..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-sky-500 focus:outline-none resize-none"
                  />
                  <div className="mt-1 text-right text-[11px] font-mono text-muted-foreground">
                    {text.length} characters
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-sky-500 focus:outline-none min-h-[44px]"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.variables.map((v) => `{${v}}`).join(', ')})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Advanced Options Accordion */}
            <div className="border border-border rounded-lg p-3 bg-muted/20">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full flex items-center justify-between text-xs font-medium text-foreground min-h-[36px]"
              >
                <span>Advanced Parameters (Variables, Limits, Creator)</span>
                {isAdvancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isAdvancedOpen && (
                <div className="mt-3 space-y-3 pt-3 border-t border-border">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] text-muted-foreground">
                        Created By (Alias / Service)
                      </label>
                      <span className="text-[10px] text-muted-foreground">Atalhos de Alias:</span>
                    </div>
                    <input
                      type="text"
                      value={createdBy}
                      onChange={(e) => setCreatedBy(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background font-mono text-foreground"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                      {['operator', ...contacts.map((c) => c.alias)].slice(0, 5).map((aliasOption) => (
                        <button
                          key={aliasOption}
                          type="button"
                          onClick={() => setCreatedBy(aliasOption)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                            createdBy === aliasOption
                              ? 'bg-sky-500/10 border-sky-500 text-sky-500 font-semibold'
                              : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {aliasOption}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        Max Runs (Optional)
                      </label>
                      <input
                        id="create-max-runs"
                        type="number"
                        min={1}
                        value={maxRuns || ''}
                        onChange={(e) =>
                          setMaxRuns(e.target.value ? Number(e.target.value) : undefined)
                        }
                        placeholder="Unlimited"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background font-mono text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        Until Expiration
                      </label>
                      <input
                        id="create-until"
                        type="date"
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background font-mono text-foreground"
                      />
                    </div>
                  </div>

                  {/* Variable mapper */}
                  <div id="section-custom-variables">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-muted-foreground">
                        Template Variables
                      </label>
                      <button
                        type="button"
                        id="btn-add-var"
                        onClick={handleAddVariable}
                        className="text-[11px] text-sky-500 hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={10} /> Add
                      </button>
                    </div>
                    {variables.map((v, i) => (
                      <div key={i} className="flex items-center gap-1.5 mb-1.5">
                        <input
                          type="text"
                          id={i === 0 ? 'input-var-key' : undefined}
                          placeholder="key"
                          value={v.key}
                          onChange={(e) => handleVariableChange(i, 'key', e.target.value)}
                          className="w-1/3 px-2 py-1 text-xs font-mono rounded border border-border bg-background text-foreground"
                        />
                        <input
                          type="text"
                          id={i === 0 ? 'input-var-value' : undefined}
                          placeholder="value"
                          value={v.val}
                          onChange={(e) => handleVariableChange(i, 'val', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs font-mono rounded border border-border bg-background text-foreground"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Tags section */}
                  <div id="section-tags">
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Tags
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        id="input-tag"
                        placeholder="e.g. alerts, critical"
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-border bg-background font-mono text-foreground"
                      />
                      <button
                        type="button"
                        id="btn-add-tag"
                        className="px-3 py-1.5 text-xs bg-muted hover:bg-accent rounded-md border border-border"
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px] active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule Dispatch'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
