export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink/60" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-status-rejected/30 bg-red-50 p-4 text-status-rejected"
      role="alert"
    >
      <p className="text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-[36px] rounded-md border border-status-rejected px-3 py-1 text-sm font-semibold hover:bg-status-rejected hover:text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-8 text-center text-ink/60">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
    </div>
  );
}
