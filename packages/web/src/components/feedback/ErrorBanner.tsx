"use client";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  dismissible?: boolean;
}

export function ErrorBanner({
  message,
  onDismiss,
  dismissible = true,
}: ErrorBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
      role="alert"
    >
      <span className="flex-1">{message}</span>
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/50"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
