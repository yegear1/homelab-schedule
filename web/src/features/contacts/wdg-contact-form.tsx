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
  onSave: (contactData: { name: string; phone: string; role?: string }) => void;
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
  const [role, setRole] = useState('Resident');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; conflict?: string }>({});

  useEffect(() => {
    if (contactToEdit) {
      setName(contactToEdit.name || contactToEdit.alias || '');
      setPhone(contactToEdit.phone || '');
      setRole(contactToEdit.role || 'Resident');
    } else {
      setName('');
      setPhone('');
      setRole('Resident');
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

    // 2. Phone E.164 validation (e.g. +5511999990000)
    const trimmedPhone = phone.trim();
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!trimmedPhone) {
      errs.phone = 'Phone number is required (E.164 format).';
    } else if (!e164Regex.test(trimmedPhone)) {
      errs.phone = '422 Unprocessable Entity: Must be valid E.164 format (e.g., +5511999990000).';
    } else {
      // 3. Duplicate phone simulation (409 Conflict)
      const duplicate = existingContacts.find(
        (c) => c.phone === trimmedPhone && c.id !== contactToEdit?.id
      );
      if (duplicate) {
        errs.conflict = `409 Conflict: Phone is already assigned to "${duplicate.name || duplicate.alias}".`;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      name: name.trim(),
      phone: phone.trim(),
      role: role.trim() || 'Resident',
    });

    toast.success('Contact saved', {
      description: `Synchronized ${name.trim()} to SQLite contact directory.`,
    });
    onOpenChange(false);
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
                International Phone (E.164) <span className="text-rose-500">*</span>
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
                  Include country code: e.g. +5511988887777 or +14155552671
                </p>
              )}
            </div>

            {/* Role input */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Role / Escalation Group
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Root Operator, Resident, Pager"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[44px]"
              />
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
