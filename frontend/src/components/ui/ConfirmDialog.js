'use client';

import { TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

/** "Are you sure?" dialog. `error` shows the server's reason when an action is refused. */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading = false,
  error = '',
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-slate-700">{message}</p>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </Modal>
  );
}