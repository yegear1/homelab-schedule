/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Search, Plus, FileText, X, Braces } from 'lucide-react';
import { Template } from '../../types/domain';
import { extractPlaceholders } from './templates.fixtures';

export interface TemplateCatalogProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onCreateNew: () => void;
}

export function TemplateCatalog({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onCreateNew,
}: TemplateCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((tpl) => {
      const matchName = tpl.name.toLowerCase().includes(q);
      const matchId = tpl.id.toLowerCase().includes(q);
      const matchBody = (tpl.body || tpl.content || '').toLowerCase().includes(q);
      return matchName || matchId || matchBody;
    });
  }, [templates, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden shadow-xs">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-500" />
            <h2 className="text-sm font-semibold text-foreground">
              Template Catalog
            </h2>
            <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
              {filteredTemplates.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[36px] active:scale-[0.98] shadow-xs"
          >
            <Plus size={14} />
            <span>New Template</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, ID, or body..."
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

      {/* Catalog List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border p-2 space-y-1">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            No templates match &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const isSelected = template.id === selectedTemplateId;
            const bodyText = template.body || template.content || '';
            const placeholders = extractPlaceholders(bodyText);

            return (
              <div
                key={template.id}
                onClick={() => onSelectTemplate(template.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all active:scale-[0.99] space-y-1.5 ${
                  isSelected
                    ? 'bg-sky-500/10 border border-sky-500/30 ring-1 ring-sky-500/20'
                    : 'hover:bg-muted/60 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-foreground truncate">
                    {template.name}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                    {template.id}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 font-mono leading-relaxed">
                  {bodyText}
                </p>

                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1">
                  <span className="inline-flex items-center gap-1 text-sky-500">
                    <Braces size={12} />
                    <span>{placeholders.length} placeholders</span>
                  </span>
                  <span className="tabular-nums">
                    {bodyText.length} chars
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
