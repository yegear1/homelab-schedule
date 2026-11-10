/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Smartphone, CheckCheck, Info } from 'lucide-react';
import { SAMPLE_SIMULATION_VALUES } from './templates.fixtures';

export interface TemplatePreviewProps {
  body: string;
  templateName?: string;
}

export function TemplatePreview({ body, templateName }: TemplatePreviewProps) {
  // Real-time interpolation of {{tokens}} based on sample simulation context
  const simulatedText = useMemo(() => {
    if (!body) return 'No message content defined yet.';
    return body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, token) => {
      if (token in SAMPLE_SIMULATION_VALUES) {
        return SAMPLE_SIMULATION_VALUES[token];
      }
      return match;
    });
  }, [body]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <Smartphone size={14} className="text-sky-500" />
          <span>Live WhatsApp Notification Simulation (Prévia ilustrativa)</span>
        </div>
        <span className="font-mono text-[11px] text-foreground">
          Recipient: Carlos (+5511988887777)
        </span>
      </div>

      {/* Simulated Mobile Chat Screen Viewport */}
      <div id="live-preview-box" className="p-4 md:p-6 bg-muted/20 flex flex-col justify-center min-h-[160px]">
        {/* Chat bubble */}
        <div className="max-w-md w-full mx-auto bg-card border border-border p-4 rounded-2xl rounded-tl-xs shadow-xs space-y-2">
          {templateName && (
            <div className="text-[11px] font-semibold text-sky-500 font-mono">
              Homelab Gateway · {templateName}
            </div>
          )}
          <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
            {simulatedText}
          </p>
          <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground font-mono tabular-nums pt-1">
            <span>18:32</span>
            <CheckCheck size={13} className="text-sky-500" />
          </div>
        </div>
      </div>

      {/* Disclaimer footer */}
      <div className="p-3 bg-muted/10 border-t border-border flex items-start gap-2 text-[11px] text-muted-foreground">
        <Info size={13} className="text-muted-foreground shrink-0 mt-0.5" />
        <span>
          Illustrative simulation only. Dynamic values are computed server-side by the backend at actual dispatch time.
        </span>
      </div>
    </div>
  );
}
