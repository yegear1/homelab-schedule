/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, User, Phone, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Contact } from '../../types/domain';

export interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactToEdit?: Contact | null;
  existingContacts: Contact[];
  onSave: (contactData: { name: string; phone: string }) => Promise<void>;
}

export function ContactForm({
  open,
  onOpenChange,
  contactToEdit,
  existingContacts,
  onSave,
}: ContactFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; conflict?: string }>({});

  useEffect(() => {
    if (contactToEdit) {
      setName(contactToEdit.name || contactToEdit.alias || '');
      setPhone(contactToEdit.phone || '');
    } else {
      setName('');
      setPhone('');
    }
    setErrors({});
  }, [contactToEdit, open]);

  const validate = (): boolean => {
    const errs: { name?: string; phone?: string; conflict?: string } = {};

    // 1. Name validation (1 to 80 chars)
    const trimmedName = name.trim();
    if (!trimmedName) {
      errs.name = 'Name is required (1 to 80 characters).';
    } else if (trimmedName.length > 80) {
      errs.name = 'Name cannot exceed 80 characters.';
    }

    if (!phone.trim()) errs.phone = 'Phone number is required.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), phone: phone.trim() });
      toast.success('Contact saved');
      onOpenChange(false);
    } catch (error: unknown) {
      setErrors({ conflict: error instanceof Error ? error.message : 'Failed to save contact' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-6 shadow-xl rounded-xl text-foreground focus:outline-none">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-sky-500" />
              <Dialog.Title className="text-base font-semibold">
                {contactToEdit ? 'Edit Contact Profile' : 'Add New Contact'}
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

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Global Conflict error alert */}
            {errors.conflict && (
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errors.conflict}</span>
              </div>
            )}

            {/* Name input */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Carlos Homelab"
                className={`w-full px-3 py-2 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-1 min-h-[44px] ${
                  errors.name
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-border focus:ring-sky-500'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-[11px] text-rose-500">{errors.name}</p>
              )}
            </div>

            {/* Phone input with E.164 hint */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+5511999990000"
                className={`w-full px-3 py-2 text-sm font-mono rounded-lg border bg-background text-foreground focus:outline-none focus:ring-1 min-h-[44px] ${
                  errors.phone
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-border focus:ring-sky-500'
                }`}
              />
              {errors.phone ? (
                <p className="mt-1 text-[11px] text-rose-500 font-mono">{errors.phone}</p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                  Include the country code.
                </p>
              )}
            </div>

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
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs"
              >
                <Save size={14} />
                <span>Save Contact</span>
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
