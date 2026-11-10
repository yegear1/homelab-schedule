/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from './components/AppShell';
import { AgendaPage } from './features/agenda/AgendaPage';
import { ContactsPage } from './features/contacts/ContactsPage';
import { TemplatesPage } from './features/templates/TemplatesPage';
import { HistoryPage } from './features/history/HistoryPage';
import { DataPage } from './features/data/DataPage';
import { useAuthStore } from './stores/auth';

export default function App() {
  const { settingsRevision } = useAuthStore();
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p === '/' ? '/contacts' : (p || '/contacts');
    }
    return '/contacts';
  });

  const navigate = useCallback((path: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p === '/' ? '/contacts' : (p || '/contacts'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const renderActiveView = () => {
    if (currentPath === '/' || currentPath.startsWith('/contacts')) {
      const contactId = currentPath.startsWith('/contacts/') ? currentPath.split('/contacts/')[1] : undefined;
      return (
        <ContactsPage
          initialContactId={contactId}
          onNavigateContact={(id) => navigate(`/contacts/${id}`)}
        />
      );
    }
    switch (currentPath) {
      case '/templates':
        return <TemplatesPage />;
      case '/history':
        return <HistoryPage />;
      case '/data':
        return <DataPage />;
      case '/jobs':
      default:
        return <AgendaPage />;
    }
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={navigate}>
      <div key={`${currentPath}:${settingsRevision}`} className="w-full">
        {renderActiveView()}
      </div>
    </AppShell>
  );
}
