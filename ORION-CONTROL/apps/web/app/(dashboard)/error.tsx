'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Card, CardBody } from '@/components/ui/primitives';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto mt-10 max-w-2xl">
      <CardBody className="p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-signal-danger/30 bg-signal-danger/10 text-signal-danger">
          <AlertTriangle size={18} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-100">This view could not be rendered</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && <p className="mono mt-2 text-[11px] text-slate-600">digest: {error.digest}</p>}
        <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
          Check the server logs for the full stack trace. If this is a fresh deployment, confirm
          DATABASE_URL is set and migrations have been applied.
        </p>
        <div className="mt-6">
          <Button onClick={reset}>
            <RefreshCw size={15} /> Try again
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
