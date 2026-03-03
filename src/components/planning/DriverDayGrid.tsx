import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Truck, MapPin, Clock, ArrowDown, ArrowUp, CheckCircle2 } from 'lucide-react';
import { DriverDaySummary } from '@/hooks/useDriverDayOverview';

interface DriverDayGridProps {
  drivers: DriverDaySummary[];
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  gepland: 'bg-muted text-muted-foreground',
  onderweg: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  geladen: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  geleverd: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  opgehaald: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  afgerond: 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function DriverDayGrid({ drivers, isLoading }: DriverDayGridProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const busyDrivers = drivers.filter(d => !d.isFree);
  const freeDrivers = drivers.filter(d => d.isFree);

  return (
    <div className="space-y-4">
      {/* Busy drivers */}
      {busyDrivers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Ingepland ({busyDrivers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {busyDrivers.map(driver => (
              <Card key={driver.driverId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Driver header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{driver.driverName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {driver.totalOrders} {driver.totalOrders === 1 ? 'order' : 'orders'}
                        </p>
                      </div>
                    </div>
                    {driver.canDriveTrailer && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <Truck className="h-2.5 w-2.5 mr-0.5" />
                        AH
                      </Badge>
                    )}
                  </div>

                  {/* Assignments */}
                  <div className="space-y-2">
                    {driver.assignments.map((a, i) => (
                      <div
                        key={`${a.orderId}-${a.segment}-${i}`}
                        className="p-2 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => navigate(`/orders/${a.orderId}`)}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            {a.segment === 'leveren' ? (
                              <ArrowDown className="h-3 w-3 text-green-600" />
                            ) : (
                              <ArrowUp className="h-3 w-3 text-red-600" />
                            )}
                            <span className="font-medium text-xs">{a.time}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-medium truncate">{a.orderNumber}</span>
                          </div>
                          <Badge className={`text-[9px] px-1 py-0 ${statusColors[a.tripStatus] || statusColors.gepland}`}>
                            {a.tripStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{a.customerName}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {a.transportName} · {a.vehicleSummary}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Free drivers */}
      {freeDrivers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Beschikbaar ({freeDrivers.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {freeDrivers.map(driver => (
              <Badge 
                key={driver.driverId} 
                variant="outline" 
                className="py-1.5 px-3 text-sm gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                {driver.driverName}
                {driver.canDriveTrailer && (
                  <span className="text-[10px] text-muted-foreground ml-1">(AH)</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
