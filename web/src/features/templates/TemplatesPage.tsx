/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Template } from '../../types/domain';
import { INITIAL_STUDIO_TEMPLATES, extractPlaceholders } from './templates.fixtures';
import { TemplateCatalog } from './cmp-template-catalog';
import { TemplateEditor } from './cmp-template-editor';
import { useJobsStore } from '../../stores/jobs';

export function TemplatesPage() {
  const { jobs } = useJobsStore();
  const [templates, setTemplates] = useState<Template[]>(INITIAL_STUDIO_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    INITIAL_STUDIO_TEMPLATES[0]?.id || null
  );
  const [isMobileEditorView, setIsMobileEditorView] = useState(false);

  // Dynamically calculate jobs_count for each template by scanning jobs store
  const templatesWithLiveCounts = useMemo(() => {
    return templates.map((tpl) => {
      const referencedJobs = jobs.filter(
        (j) => j.template_id === tpl.id && (j.status === 'scheduled' || j.status === 'snoozed')
      ).length;
      return { ...tpl, jobs_count: referencedJobs };
    });
  }, [templates, jobs]);

  const selectedTemplate = useMemo(() => {
    return templatesWithLiveCounts.find((t) => t.id === selectedTemplateId) || null;
  }, [templatesWithLiveCounts, selectedTemplateId]);

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setIsMobileEditorView(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplateId(null);
    setIsMobileEditorView(true);
  };

  const handleSaveTemplate = (id: string | null, data: { name: string; body: string }) => {
    const placeholders = extractPlaceholders(data.body);

    if (id) {
      // Update existing
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                name: data.name,
                body: data.body,
                content: data.body,
                placeholders,
                variables: placeholders,
                updated_at: new Date().toISOString().replace('T', ' ').substring(0, 16),
              }
            : t
        )
      );
    } else {
      // Create new draft
      const newTemplate: Template = {
        id: `tpl-${Date.now().toString(36)}`,
        name: data.name,
        body: data.body,
        content: data.body,
        placeholders,
        variables: placeholders,
        category: 'custom',
        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 16),
        jobs_count: 0,
      };
      setTemplates([newTemplate, ...templates]);
      setSelectedTemplateId(newTemplate.id);
    }
  };

  const handleDeleteTemplate = (id: string) => {
    const remaining = templates.filter((t) => t.id !== id);
    setTemplates(remaining);
    setSelectedTemplateId(remaining[0]?.id || null);
    setIsMobileEditorView(false);
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] min-h-[620px] flex flex-col space-y-4">
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
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Template Catalog Pane */}
        <div
          className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
            isMobileEditorView ? 'hidden md:flex flex-col' : 'flex flex-col'
          }`}
        >
          <TemplateCatalog
            templates={templatesWithLiveCounts}
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
      </div>
    </div>
  );
}
