/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Contact } from '../../types/domain';
import { INITIAL_CONTACT_DIRECTORY } from './contacts.fixtures';
import { ContactsList } from './cmp-contacts-list';
import { ContactWorkspace } from './cmp-contact-workspace';
import { ContactForm } from './wdg-contact-form';
import { JobCreate } from '../agenda/wdg-job-create';
import { JobInspector } from '../agenda/wdg-job-inspector';
import { useJobsStore } from '../../stores/jobs';

export interface ContactsPageProps {
  initialContactId?: string;
  onNavigateContact?: (id: string) => void;
}

export function ContactsPage({ initialContactId }: ContactsPageProps) {
  const { jobs, contacts, createContact, updateContact, deleteContact } = useJobsStore();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialContactId || contacts[0]?.id || null
  );

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleRecipient, setScheduleRecipient] = useState<string>('');
  const [inspectJobId, setInspectJobId] = useState<string | null>(null);
  const [isMobileDetailView, setIsMobileDetailView] = useState(false);

  // Compute active_jobs dynamically by cross-referencing jobs store
  const contactsWithDynamicJobCounts = useMemo(() => {
    return contacts.map((c) => {
      const activeJobs = jobs.filter(
        (j) =>
          (j.recipient === c.phone || (j.created_by && j.created_by === c.alias)) &&
          (j.status === 'scheduled' || j.status === 'snoozed')
      ).length;
      return { ...c, active_jobs: activeJobs };
    });
  }, [contacts, jobs]);

  const selectedContact = useMemo(() => {
    return (
      contactsWithDynamicJobCounts.find((c) => c.id === selectedContactId) || null
    );
  }, [contactsWithDynamicJobCounts, selectedContactId]);

  const selectedInspectJob = useMemo(() => {
    return jobs.find((j) => j.id === inspectJobId) || null;
  }, [jobs, inspectJobId]);

  const handleSelectContact = (id: string) => {
    setSelectedContactId(id);
    setIsMobileDetailView(true);
  };

  const handleCreateContact = (data: { name: string; phone: string; role?: string }) => {
    const created = createContact(data);
    setSelectedContactId(created.id);
  };

  const handleUpdateContact = (id: string, updates: Partial<Contact>) => {
    updateContact(id, updates);
  };

  const handleDeleteContact = (id: string) => {
    deleteContact(id);
    const remaining = contacts.filter((c) => c.id !== id);
    setSelectedContactId(remaining[0]?.id || null);
    setIsMobileDetailView(false);
  };

  const handleScheduleForContact = (phone: string) => {
    setScheduleRecipient(phone);
    setIsScheduleOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] min-h-[600px] flex flex-col space-y-4">
      {/* Mobile Back button when viewing detail */}
      {isMobileDetailView && (
        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileDetailView(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground"
          >
            <ArrowLeft size={14} />
            <span>Back to Contacts List</span>
          </button>
        </div>
      )}

      {/* Split-Pane / Master-Detail Layout */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Master List Pane */}
        <div
          className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
            isMobileDetailView ? 'hidden md:flex flex-col' : 'flex flex-col'
          }`}
        >
          <ContactsList
            contacts={contactsWithDynamicJobCounts}
            selectedContactId={selectedContactId}
            onSelectContact={handleSelectContact}
            onOpenCreate={() => {
              setContactToEdit(null);
              setIsFormOpen(true);
            }}
          />
        </div>

        {/* Right Detail Workspace Pane */}
        <div
          className={`flex-1 h-full min-w-0 ${
            !isMobileDetailView ? 'hidden md:flex flex-col' : 'flex flex-col'
          }`}
        >
          <ContactWorkspace
            contact={selectedContact}
            onUpdateContact={handleUpdateContact}
            onDeleteContact={handleDeleteContact}
            onScheduleForContact={handleScheduleForContact}
            onInspectJob={(jobId) => setInspectJobId(jobId)}
          />
        </div>
      </div>

      {/* Modals & Drawers */}
      <ContactForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        contactToEdit={contactToEdit}
        existingContacts={contacts}
        onSave={handleCreateContact}
      />

      <JobCreate
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        initialRecipient={scheduleRecipient}
        lockRecipient={true}
      />

      <JobInspector
        job={selectedInspectJob}
        open={!!inspectJobId}
        onOpenChange={(open) => {
          if (!open) setInspectJobId(null);
        }}
      />
    </div>
  );
}
