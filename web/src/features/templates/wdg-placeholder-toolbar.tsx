/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Code2 } from 'lucide-react';
import { BUILTIN_SYSTEM_TOKENS } from './templates.fixtures';

export interface PlaceholderToolbarProps {
  onInsertToken: (token: string) => void;
}

export function PlaceholderToolbar({ onInsertToken }: PlaceholderToolbarProps) {
  const customTokens = ['custom_var', 'service', 'status'];

  return (
    <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-sky-500" />
          <span>Insert Dynamic Placeholder at Cursor</span>
        </div>
        <span className="font-mono text-[10px]">Click token to insert</span>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Built-in dynamic tokens */}
        {BUILTIN_SYSTEM_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => onInsertToken(`{{${token}}}`)}
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono bg-card hover:bg-sky-500/10 text-foreground hover:text-sky-500 border border-border hover:border-sky-500/30 transition-all active:scale-[0.98] shadow-2xs"
            title={`Insert {{${token}}} into message body`}
          >
            <span>{`{{${token}}}`}</span>
          </button>
        ))}

        {/* Custom variable tokens */}
        {customTokens.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => onInsertToken(`{{${token}}}`)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all active:scale-[0.98]"
            title={`Custom payload key {{${token}}}`}
          >
            <Code2 size={11} />
            <span>{`{{${token}}}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
