/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  User,
  Phone,
  Trash2,
  CalendarPlus,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Clock,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Contact } from '../../types/domain';
import { getContactInitials, getAvatarColorClass } from './contacts.fixtures';
import { ContactJobs } from './wdg-contact-jobs';

export interface ContactWorkspaceProps {
  contact: Contact | null;
  onUpdateContact: (id: string, updates: Partial<Contact>) => void | Promise<void>;
  onDeleteContact: (id: string) => void | Promise<void>;
  onScheduleForContact: (phone: string) => void;
  onInspectJob: (jobId: string) => void;
}

export function ContactWorkspace({
  contact,
  onUpdateContact,
  onDeleteContact,
  onScheduleForContact,
  onInspectJob,
}: ContactWorkspaceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  if (!contact) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-card rounded-xl border border-border">
        <User className="h-10 w-10 mb-2 opacity-30 text-sky-500" />
        <h3 className="font-semibold text-sm text-foreground">No Contact Selected</h3>
        <p className="text-xs mt-1">Select a recipient from the directory list to view profile and scoped agenda.</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditName(contact.name || contact.alias);
    setEditPhone(contact.phone);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      toast.error('Name and phone cannot be empty');
      return;
    }
    try {
      await onUpdateContact(contact.id, {
        name: editName.trim(),
        alias: editName.trim(),
        phone: editPhone.trim(),
        updated_at: new Date().toISOString(),
      });
      setIsEditing(false);
      toast.success('Contact profile updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update contact';
      toast.error(msg);
    }
  };

  const handleDeleteAttempt = async () => {
    setConflictError(null);
    const activeJobCount = contact.active_jobs ?? 0;
    if (activeJobCount > 0) {
      setConflictError(
        `409 Conflict: Cannot delete contact with ${activeJobCount} active scheduled jobs. Reassign or cancel jobs first.`
      );
      return;
    }
    try {
      await onDeleteContact(contact.id);
      setIsDeleteModalOpen(false);
      toast.success(`Contact ${contact.name || contact.alias} deleted`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '409 Conflict: Cannot delete contact with active jobs.';
      setConflictError(msg);
    }
  };

  const initials = getContactInitials(contact.name || contact.alias);
  const avatarColor = getAvatarColorClass(contact.id);

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden shadow-xs">
      {/* Workspace Header */}
      <div className="p-4 md:p-6 border-b border-border space-y-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Avatar and Name/Phone */}
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor}`}
            >
              {initials}
            </div>

            {!isEditing ? (
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {contact.name || contact.alias}
                  </h2>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="p-1 text-muted-foreground hover:text-foreground rounded"
                    title="Edit Contact"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground whitespace-nowrap overflow-hidden min-w-0">
                  <Phone size={12} className="shrink-0" />
                  <span className="shrink-0">{contact.phone}</span>
                  <span className="shrink-0">·</span>
                  <span className="text-sky-500 font-sans truncate shrink-0">{contact.role}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-border bg-background text-foreground"
                />
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="px-2.5 py-1 text-xs font-mono rounded border border-border bg-background text-foreground"
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  className="p-1.5 bg-sky-500 text-white rounded hover:bg-sky-600"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 bg-muted text-muted-foreground rounded hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onScheduleForContact(contact.phone)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs"
            >
              <CalendarPlus size={14} />
              <span>Schedule Job for Contact</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConflictError(null);
                setIsDeleteModalOpen(true);
              }}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors min-h-[44px] min-w-[44px] active:scale-[0.98]"
              title="Delete Contact"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Audit Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-muted-foreground pt-1">
          <div className="flex items-center gap-1">
            <Clock size={11} />
            <span>Created: {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '—'}</span>
          </div>
          <div>
            <span>Updated: {contact.updated_at ? new Date(contact.updated_at).toLocaleDateString() : '—'}</span>
          </div>
          <div className="text-foreground">
            <span>ID: {contact.id}</span>
          </div>
        </div>
      </div>

      {/* Scoped Jobs Table Viewport */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3 overflow-hidden min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0">
            Scoped Scheduled & Triggered Jobs
          </h3>
          <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap truncate shrink-0 text-right">
            Recipient (`to`) or Creator (`created_by`)
          </span>
        </div>
        <ContactJobs contact={contact} onInspectJob={onInspectJob} />
      </div>

      {/* Safety Modal for Delete */}
      <Dialog.Root open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-6 shadow-xl rounded-xl text-foreground focus:outline-none">
            <div className="flex items-center gap-2 pb-3 border-b border-border text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              <Dialog.Title className="text-sm font-semibold">
                Delete Contact Profile
              </Dialog.Title>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-foreground">
                Are you sure you want to delete <span className="font-semibold">{contact.name || contact.alias}</span> ({contact.phone})?
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
