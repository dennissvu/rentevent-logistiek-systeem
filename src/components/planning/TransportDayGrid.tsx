import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, Truck, Package, ExternalLink, Check, AlertTriangle } from 'lucide-react';
import { DailyTransportOrder } from '@/hooks/useDailyTransportData';

interface TransportDayGridProps {
  orders: DailyTransportOrder[];
  isLoading: boolean;
}

export function TransportDayGrid({ orders, isLoading }: TransportDayGridProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Laden...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Geen orders voor deze dag.
      </div>
    );
  }

  const withTransport = orders.filter(o => o.hasTransport);
  const withoutTransport = orders.filter(o => !o.hasTransport);

  return (
    <div className="space-y-6">
      {/* Orders without transport */}
      {withoutTransport.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-sm">
              Zonder transport ({withoutTransport.length})
            </h3>
          </div>
          <div className="space-y-2">
            {withoutTransport.map(order => (
              <OrderTransportCard key={order.orderId} order={order} onNavigate={() => navigate(`/orders/${order.orderId}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Orders with transport */}
      {withTransport.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-sm">
              Transport toegewezen ({withTransport.length})
            </h3>
          </div>
          <div className="space-y-2">
            {withTransport.map(order => (
              <OrderTransportCard key={order.orderId} order={order} onNavigate={() => navigate(`/orders/${order.orderId}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderTransportCard({ order, onNavigate }: { order: DailyTransportOrder; onNavigate: () => void }) {
  return (
    <div
      className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onNavigate}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {order.segments.map(seg => (
            seg === 'leveren' ? (
              <Badge key={seg} className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1 text-[11px]">
                <ArrowDown className="h-3 w-3" />
                {order.leverenTime}
              </Badge>
            ) : (
              <Badge key={seg} className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 gap-1 text-[11px]">
                <ArrowUp className="h-3 w-3" />
                {order.ophalenTime}
              </Badge>
            )
          ))}
          <span className="font-semibold text-sm">{order.orderNumber}</span>
          <span className="text-sm text-muted-foreground">{order.customerName}</span>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Vehicle load */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Package className="h-3 w-3" />
        {order.vehicleSummary || 'Geen voertuigen'}
      </div>

      {/* Transport assignments */}
      {order.assignedTransport.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {order.assignedTransport.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <Truck className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{a.transportName}</span>
              {a.driverName && (
                <span className="text-muted-foreground">({a.driverName})</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          Geen transport toegewezen
        </div>
      )}
    </div>
  );
}
