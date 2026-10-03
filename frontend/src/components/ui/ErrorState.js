import { CircleAlert, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <CircleAlert className="h-6 w-6 text-red-600" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-5">
          Try again
        </Button>
      )}
    </div>
  );
}