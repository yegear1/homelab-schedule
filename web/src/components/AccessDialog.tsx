/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Server, Key, CheckCircle, RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore, TestConnectionResult } from '../stores/auth';

export interface AccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessDialog({ open, onOpenChange }: AccessDialogProps) {
  const {
    baseUrl,
    apiKey,
    setBaseUrl,
    setApiKey,
    testConnectionDetailed,
    resetDefaults,
  } = useAuthStore();

  const [localUrl, setLocalUrl] = useState(baseUrl);
  const [localKey, setLocalKey] = useState(apiKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  // Sync local inputs when modal opens or store changes
  useEffect(() => {
    if (open) {
      setLocalUrl(baseUrl);
      setLocalKey(apiKey);
      setTestResult(null);
    }
  }, [open, baseUrl, apiKey]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnectionDetailed(localUrl.trim(), localKey.trim());
      setTestResult(result);
      if (result.daemonOk && result.authOk) {
        toast.success('Conexão verificada', {
          description: `Daemon alcançado em ${result.latencyMs}ms e chave x-api-key autenticada.`,
        });
      } else if (result.daemonOk && !result.authOk) {
        if (!localKey.trim()) {
          toast.warning('Daemon online sem chave', {
            description: 'Rotas protegidas exigirão x-api-key.',
          });
        } else {
          toast.error('Erro de autenticação', {
            description: 'Daemon online, mas a chave x-api-key foi rejeitada (HTTP 401).',
          });
        }
      } else {
        toast.error('Falha de conexão', {
          description: 'Não foi possível alcançar o daemon em /health.',
        });
      }
    } catch {
      const fallbackResult: TestConnectionResult = {
        ok: false,
        daemonOk: false,
        authOk: false,
        latencyMs: null,
        message: 'Falha de conexão com o daemon.',
      };
      setTestResult(fallbackResult);
      toast.error('Falha ao testar conexão');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setBaseUrl(localUrl.trim());
    setApiKey(localKey.trim());
    toast.success('Configurações salvas localmente no navegador.', {
      description: 'API key & Base URL sincronizadas no armazenamento local.',
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    resetDefaults();
    setLocalUrl('');
    setLocalKey('');
    setTestResult(null);
    toast.info('Configurações padrão restauradas');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <Dialog.Content
          id="api-key-modal"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-6 shadow-xl rounded-xl text-foreground focus:outline-none max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-sky-500" />
              <Dialog.Title className="text-base font-semibold">
                Acesso à API
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                title="Fechar"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.98]"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="input-base-url" className="block text-xs font-medium text-muted-foreground mb-1">
                URL Base do Daemon
              </label>
              <div className="relative">
                <input
                  id="input-base-url"
                  type="text"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  placeholder="http://localhost:8003 (ou deixe vazio para mesmo host)"
                  className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Endpoint REST do daemon homelab-schedule. Vazio utiliza a mesma origem.
              </p>
            </div>

            <div>
              <label htmlFor="input-api-key" className="block text-xs font-medium text-muted-foreground mb-1">
                Chave do Operador (<span className="font-mono">x-api-key</span>)
              </label>
              <div className="relative">
                <input
                  id="input-api-key"
                  type="password"
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="SCHEDULE_API_KEY..."
                  style={{ fontSize: '16px' }}
                  className="w-full font-mono text-base px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enviada no cabeçalho x-api-key para autenticar rotas administrativas e operacionais.
              </p>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  testResult.daemonOk && testResult.authOk
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : testResult.daemonOk && !testResult.authOk
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                }`}
              >
                {testResult.daemonOk && testResult.authOk ? (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                ) : testResult.daemonOk ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                )}
                <div className="space-y-1">
                  <div className="font-medium">{testResult.message}</div>
                  <div className="text-[11px] opacity-80 font-mono">
                    Liveness (/health): {testResult.daemonOk ? `Online (${testResult.latencyMs}ms)` : 'Inalcançável'} ·
                    Auth (/jobs/tags): {testResult.authOk ? 'Válida' : localKey.trim() ? 'Recusada' : 'Não informada'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2 flex items-center"
            >
              Restaurar Padrão
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors min-h-[44px] active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-muted hover:bg-accent text-foreground transition-colors min-h-[44px] active:scale-[0.98]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Testar Conexão</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                data-variant="primary"
                className="ui-button inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98]"
              >
                <Key className="h-3.5 w-3.5" />
                <span>Salvar</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
