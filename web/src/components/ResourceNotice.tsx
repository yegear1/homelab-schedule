type ResourceNoticeProps = {
  label: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  stale: boolean;
  onRetry: () => void;
};

export function ResourceNotice({ label, status, error, stale, onRetry }: ResourceNoticeProps) {
  if (status === 'ready') return null;
  if (status === 'idle' || status === 'loading') {
    return <p role="status" className="text-sm text-muted-foreground">Carregando {label}…</p>;
  }
  return (
    <div role="alert" className="rounded-lg border border-rose-500 p-3 text-sm">
      <p>Não foi possível carregar {label}: {error || 'falha de conexão'}.</p>
      {stale && <p>Os dados exibidos são da última consulta e podem estar desatualizados.</p>}
      <button type="button" className="underline" onClick={onRetry}>Tentar novamente</button>
    </div>
  );
}
