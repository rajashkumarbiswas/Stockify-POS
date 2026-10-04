import Badge from '@/components/ui/Badge';
import { PAYMENT_STATUS_META, PURCHASE_STATUS_META } from '@/lib/constants';

export function PurchaseStatusBadge({ status }) {
  const meta = PURCHASE_STATUS_META[status] || { label: status, tone: 'neutral' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function PaymentStatusBadge({ status }) {
  const meta = PAYMENT_STATUS_META[status] || { label: status, tone: 'neutral' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}