import { ResourceNotice } from '../../components/ResourceNotice';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Template } from '../../types/domain';
import { extractPlaceholders } from './templates.fixtures';
import { TemplateCatalog } from './cmp-template-catalog';
import { TemplateEditor } from './cmp-template-editor';
import { useJobsStore } from '../../stores/jobs';

export function TemplatesPage() {
  const { resources, jobs, templates, fetchTemplates, createTemplate, updateTemplate, deleteTemplate } = useJobsStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates[0]?.id || null
  );
  const [isMobileEditorView, setIsMobileEditorView] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setIsMobileEditorView(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplateId(null);
    setIsMobileEditorView(true);
  };

  const handleSaveTemplate = async (id: string | null, data: { name: string; body: string }) => {
    if (id) {
      await updateTemplate(id, data);
    } else {
      const created = await createTemplate(data);
      setSelectedTemplateId(created.id);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    await deleteTemplate(id);
    const remaining = templates.filter((t) => t.id !== id);
    setSelectedTemplateId(remaining[0]?.id || null);
    setIsMobileEditorView(false);
  };

  return (
    <div id="scr-templates" data-state={resources.templates.status} className="max-w-7xl mx-auto h-[calc(100vh-8rem)] min-h-[620px] flex flex-col space-y-4">
      <ResourceNotice label="modelos" {...resources.templates} onRetry={() => { void fetchTemplates(); }} />
      {/* Mobile Back button when editing */}
      {isMobileEditorView && (
        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileEditorView(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground"
          >
            <ArrowLeft size={14} />
            <span>Back to Template Catalog</span>
          </button>
        </div>
      )}

      {/* Split-Pane Studio Workspace */}
      {(resources.templates.status === 'ready' || resources.templates.stale) && <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Template Catalog Pane */}
        <div
          className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
            isMobileEditorView ? 'hidden md:flex flex-col' : 'flex flex-col'
          }`}
        >
          <TemplateCatalog
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={handleSelectTemplate}
            onCreateNew={handleCreateNew}
          />
        </div>

        {/* Right Template Composer Pane */}
        <div
          className={`flex-1 h-full min-w-0 ${
            !isMobileEditorView ? 'hidden md:flex flex-col' : 'flex flex-col'
          }`}
        >
          <TemplateEditor
            template={selectedTemplate}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        </div>
      </div>}
    </div>
  );
}
