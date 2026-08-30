import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Could not load this section",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-status-medium/30 bg-status-medium/10 text-status-medium">
        <AlertTriangle size={18} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-text-secondary">{message}</p>
      {onRetry && (
        <Button icon={RotateCw} onClick={onRetry} className="mt-4">
          Retry
        </Button>
      )}
    </div>
  );
}
