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

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/jobs';
    }
    return '/jobs';
  });

  const navigate = useCallback((path: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/jobs');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const renderActiveView = () => {
    if (currentPath.startsWith('/contacts')) {
      const contactId = currentPath.split('/contacts/')[1];
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
      case '/':
      default:
        return <AgendaPage />;
    }
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={navigate}>
      {renderActiveView()}
    </AppShell>
  );
}
