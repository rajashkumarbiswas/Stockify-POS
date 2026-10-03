import Badge from '@/components/ui/Badge';

const MAP = {
  IN_STOCK: { tone: 'success', label: 'In stock' },
  LOW_STOCK: { tone: 'warning', label: 'Low stock' },
  OUT_OF_STOCK: { tone: 'danger', label: 'Out of stock' },
};

export default function StockBadge({ status }) {
  const { tone, label } = MAP[status] || { tone: 'neutral', label: status };
  return <Badge tone={tone}>{label}</Badge>;
}