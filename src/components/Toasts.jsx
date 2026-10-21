function ToastIcon({ kind }) {
  if (kind === "pending") {
    return (
      <svg className="spinner h-5 w-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    );
  }
  if (kind === "success") {
    return (
      <svg className="h-5 w-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg className="h-5 w-5 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 8h.01M12 11v5" />
    </svg>
  );
}

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="card animate-enter flex items-start gap-3 p-4"
        >
          <ToastIcon kind={t.kind} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-inktext dark:text-white">{t.title}</p>
            {t.message && (
              <p className="mono mt-1 break-words text-stone-600 dark:text-slate-400">{t.message}</p>
            )}
            {t.link && (
              <a
                href={t.link}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-xs font-semibold text-branddeep hover:underline dark:text-brand"
              >
                View on explorer
              </a>
            )}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-black/5 hover:text-inktext dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
