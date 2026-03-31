import { OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      ORDER_STATUS_COLORS[status]
    )}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}
