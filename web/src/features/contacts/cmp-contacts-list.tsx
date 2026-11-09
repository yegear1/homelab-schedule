/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Search, Plus, X, Users, Phone, CalendarClock } from 'lucide-react';
import { Contact } from '../../types/domain';
import { getContactInitials, getAvatarColorClass } from './contacts.fixtures';

export interface ContactsListProps {
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  onOpenCreate: () => void;
}

export function ContactsList({
  contacts,
  selectedContactId,
  onSelectContact,
  onOpenCreate,
}: ContactsListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Instant client-side filtering by name, phone number, or ID
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter((c) => {
      const matchName = (c.name || c.alias || '').toLowerCase().includes(q);
      const matchPhone = c.phone.toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q);
      const matchRole = c.role.toLowerCase().includes(q);
      return matchName || matchPhone || matchId || matchRole;
    });
  }, [contacts, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden shadow-xs">
      {/* Header with Title, Count and + Add Contact */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            <h2 className="text-sm font-semibold text-foreground">
              Contact Directory
            </h2>
            <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
              {filteredContacts.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[36px] active:scale-[0.98] shadow-xs"
          >
            <Plus size={14} />
            <span>Add Contact</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or ID..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[40px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Contacts List View */}
      <div className="flex-1 overflow-y-auto divide-y divide-border p-2 space-y-1">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            No contacts match &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isSelected = contact.id === selectedContactId;
            const initials = getContactInitials(contact.name || contact.alias);
            const avatarColor = getAvatarColorClass(contact.id);
            const activeJobs = contact.active_jobs ?? 0;

            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact.id)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all active:scale-[0.99] ${
                  isSelected
                    ? 'bg-sky-500/10 border border-sky-500/30 ring-1 ring-sky-500/20'
                    : 'hover:bg-muted/60 border border-transparent'
                }`}
              >
                {/* Left: Avatar & Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor}`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {contact.name || contact.alias}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground font-mono">
                      <Phone size={11} className="shrink-0" />
                      <span className="truncate">{contact.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Active Jobs Pill Badge */}
                <div className="shrink-0 ml-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                      activeJobs > 0
                        ? 'bg-sky-500/10 text-sky-500 border-sky-500/20 font-medium'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                    title={`${activeJobs} active scheduled jobs`}
                  >
                    <CalendarClock size={11} />
                    <span>{activeJobs}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
