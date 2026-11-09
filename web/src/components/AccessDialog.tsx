/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Server, Key, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/auth';

export interface AccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessDialog({ open, onOpenChange }: AccessDialogProps) {
  const {
    baseUrl,
    apiKey,
    latencyMs,
    gatewayStatus,
    setBaseUrl,
    setApiKey,
    testConnection,
    resetDefaults,
  } = useAuthStore();

  const [localUrl, setLocalUrl] = useState(baseUrl);
  const [localKey, setLocalKey] = useState(apiKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await testConnection();
      setTestResult({
        ok: true,
        message: `HTTP 200 OK — Gateway responded in ${latencyMs}ms (${gatewayStatus})`,
      });
      toast.success('Gateway connection verified', {
        description: `Endpoint ${localUrl} is active.`,
      });
    } catch {
      setTestResult({
        ok: false,
        message: 'Connection failed. Check network route and host URL.',
      });
      toast.error('Gateway connection failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setBaseUrl(localUrl.trim());
    setApiKey(localKey.trim());
    toast.success('Credentials updated', {
      description: 'API key & Base URL synchronized in localStorage.',
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    resetDefaults();
    setLocalUrl('');
    setLocalKey('');
    setTestResult(null);
    toast.info('Default homelab endpoints restored');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-6 shadow-xl rounded-xl text-foreground focus:outline-none">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-sky-500" />
              <Dialog.Title className="text-base font-semibold">
                Homelab Gateway Access
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.98]"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Gateway Base URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  placeholder="http://localhost:8003"
                  className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Local SQLite & WhatsApp bridge daemon REST endpoint.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Operator API Key (<span className="font-mono">x-api-key</span>)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="SCHEDULE_API_KEY..."
                  className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Injected in HTTP headers for mutual auth on dispatch endpoints.
              </p>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  testResult.ok
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2 flex items-center"
            >
              Reset to Defaults
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-muted hover:bg-accent text-foreground transition-colors min-h-[44px] active:scale-[0.98]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Test Ping</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity min-h-[44px] active:scale-[0.98]"
              >
                <Key className="h-3.5 w-3.5" />
                <span>Save & Sync</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
