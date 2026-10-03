import { Loader2 } from 'lucide-react';

export default function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex items-center gap-3 text-slate-600" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}