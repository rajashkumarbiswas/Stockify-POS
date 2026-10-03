import Badge from '@/components/ui/Badge';
import { MOVEMENT_TYPE_META } from '@/lib/constants';

export default function MovementTypeBadge({ type }) {
  const meta = MOVEMENT_TYPE_META[type] || { label: type, tone: 'neutral' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}