import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, ExternalLink, Clock, ArrowDown, ArrowUp, CalendarDays, Truck, User, Timer } from 'lucide-react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Order } from '@/data/planningData';
import { vehicleTypes } from '@/data/transportData';
import { useTransport } from '@/context/TransportContext';
import { calculateDriverScheduleSync, needsTrailer as checkNeedsTrailer } from '@/utils/driverScheduleCalculator';

interface WeekCalendarViewProps {
  orders: Order[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

type ViewMode = 'logistiek' | 'boekingen';

export function WeekCalendarView({ orders, selectedDate, onDateChange }: WeekCalendarViewProps) {
  const navigate = useNavigate();
  const { allTransportMaterials, combis, drivers } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];
  const [viewMode, setViewMode] = useState<ViewMode>('logistiek');
  
  // Both views start from selected date and show 7 days forward
  const displayDays = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));

  // === LOGISTIEK VIEW: entries grouped by order when same day + same driver ===
  interface LogisticEntry {
    order: Order;
    segmentTypes: ('leveren' | 'ophalen')[];
    date: string;
  }

  const getLogisticEntries = (date: Date): LogisticEntry[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const orderMap = new Map<string, { order: Order; types: ('leveren' | 'ophalen')[] }>();

    for (const order of orders) {
      const hasDelivery = order.logisticDeliveryDate === dateStr;
      const hasPickup = order.logisticPickupDate === dateStr;
      if (!hasDelivery && !hasPickup) continue;

      const leverenSeg = order.segments.find(s => s.type === 'leveren');
      const ophalenSeg = order.segments.find(s => s.type === 'ophalen');

      // Check if both are on same day with same driver → combine
      if (hasDelivery && hasPickup && leverenSeg?.assignedDriver && leverenSeg.assignedDriver === ophalenSeg?.assignedDriver) {
        orderMap.set(order.id, { order, types: ['leveren', 'ophalen'] });
      } else {
        if (hasDelivery) {
          const existing = orderMap.get(order.id);
          if (existing) {
            existing.types.push('leveren');
          } else {
            orderMap.set(order.id, { order, types: ['leveren'] });
          }
        }
        if (hasPickup) {
          const existing = orderMap.get(order.id);
          if (existing) {
            existing.types.push('ophalen');
          } else {
            orderMap.set(order.id, { order, types: ['ophalen'] });
          }
        }
      }
    }

    return Array.from(orderMap.values()).map(({ order, types }) => ({
      order,
      segmentTypes: types,
      date: dateStr,
    }));
  };

  // === BOEKINGEN VIEW: orders spanning their booking period ===
  const getBookingOrders = (date: Date): Order[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return orders.filter(o => o.bookingStartDate <= dateStr && o.bookingEndDate >= dateStr);
  };

  // Helper for transport/driver names
  const getTransportShort = (segment: Order['segments'][0]) => {
    if (!segment?.assignedTransport) return null;
    const transport = allTransport.find(t => t.id === segment.assignedTransport);
    return transport?.name || null;
  };

  const getDriverName = (segment: Order['segments'][0]) => {
    if (!segment?.assignedDriver) return null;
    const driver = drivers.find(d => d.id === segment.assignedDriver);
    return driver?.name || null;
  };

  // === LOGISTIC ENTRY CARD (supports combined lev+oph) ===
  const renderLogisticCard = (entry: LogisticEntry) => {
    const { order, segmentTypes } = entry;
    const isCombined = segmentTypes.length > 0 && segmentTypes.includes('leveren') && segmentTypes.includes('ophalen');
    const primaryType = segmentTypes[0];
    const primarySegment = order.segments.find(s => s.type === primaryType);
    if (!primarySegment) return null;

    const isOptie = order.status === 'optie';

    // For combined: show both segments info
    const leverenSeg = isCombined ? order.segments.find(s => s.type === 'leveren') : null;
    const ophalenSeg = isCombined ? order.segments.find(s => s.type === 'ophalen') : null;

    const displaySegment = leverenSeg || primarySegment;
    const transportName = getTransportShort(displaySegment);
    const driverName = getDriverName(displaySegment);

    // Vehicle summary from primary segment
    const vehicleSummary = primarySegment.vehicleTypes || [];
    const totalVehicles = vehicleSummary.reduce((sum, v) => sum + v.count, 0);

    // Driver start time for leveren
    const leverenForCalc = leverenSeg || (primaryType === 'leveren' ? primarySegment : null);
    const hasTrailer = leverenForCalc?.assignedTransport ? checkNeedsTrailer(leverenForCalc.assignedTransport) : false;
    const driverCalc = leverenForCalc?.startTime
      ? calculateDriverScheduleSync({
          customerStartTime: leverenForCalc.startTime,
          vehicleCount: totalVehicles,
          needsTrailer: hasTrailer,
        })
      : null;

    const borderColor = isCombined
      ? 'border-l-primary'
      : primaryType === 'leveren' ? 'border-l-green-500' : 'border-l-red-500';
    const bgColor = isOptie
      ? 'bg-orange-50 border-orange-200'
      : 'bg-background border-border';

    return (
      <Card
        key={`${order.id}-${segmentTypes.join('-')}`}
        className={`p-2.5 mb-2 cursor-pointer transition-colors hover:shadow-md border-l-[3px] ${borderColor} ${bgColor} text-xs`}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/orders/${order.id}`);
        }}
      >
        {/* Header: order info + segment badges */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="font-semibold text-xs leading-tight flex items-center gap-1">
            {order.orderNumber} - {order.customerName}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="flex gap-0.5">
            {segmentTypes.map(type => (
              <Badge
                key={type}
                variant={type === 'leveren' ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0 gap-0.5 shrink-0"
              >
                {type === 'leveren' ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />}
                {type === 'leveren' ? 'Lev' : 'Oph'}
              </Badge>
            ))}
          </div>
        </div>

        {/* Times */}
        {isCombined ? (
          <div className="text-[11px] text-muted-foreground mb-1 space-y-0.5">
            <div className="flex items-center gap-1">
              <ArrowDown className="h-2.5 w-2.5 text-green-600" />
              <span>{leverenSeg?.startTime}</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUp className="h-2.5 w-2.5 text-red-600" />
              <span>{ophalenSeg?.startTime}</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground mb-1">
            {primarySegment.startTime}
          </div>
        )}

        {/* Driver start time for leveren */}
        {driverCalc && (
          <div className="text-[11px] bg-primary/10 rounded px-1.5 py-0.5 mb-1 flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" />
            <span className="font-medium text-primary">Start: {driverCalc.driverStartTime}</span>
          </div>
        )}

        {/* Customer time windows */}
        {segmentTypes.map(type => {
          const windowStart = type === 'leveren' ? order.deliveryWindowStart : order.pickupWindowStart;
          const windowEnd = type === 'leveren' ? order.deliveryWindowEnd : order.pickupWindowEnd;
          if (!windowStart || !windowEnd) return null;
          return (
            <div key={`window-${type}`} className="text-[10px] bg-accent/50 rounded px-1.5 py-0.5 mb-0.5 flex items-center gap-1">
              <Timer className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {type === 'leveren' ? 'Lev' : 'Oph'} venster: {windowStart}–{windowEnd}
              </span>
            </div>
          );
        })}

        {/* Driver + Transport */}
        <div className="text-[11px] space-y-0.5 mt-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            {driverName 
              ? <span className="font-medium text-foreground">{driverName}</span>
              : <span className="italic">Geen chauffeur</span>
            }
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Truck className="h-3 w-3 shrink-0" />
            {transportName 
              ? <span className="font-medium text-foreground">{transportName}</span>
              : <span className="italic">Geen transport</span>
            }
          </div>
        </div>

        {/* Vehicles */}
        <div className="text-[11px] font-medium mt-1">
          {vehicleSummary.map((v, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {v.count}x {vehicleTypes.find(vt => vt.id === v.type)?.name || v.type}
            </span>
          ))}
        </div>
      </Card>
    );
  };

  // === BOOKING ORDER CARD (spanning view) ===
  const renderBookingCard = (order: Order, dateStr: string) => {
    const isStart = order.bookingStartDate === dateStr;
    const isEnd = order.bookingEndDate === dateStr;
    const isOptie = order.status === 'optie';

    // Show delivery/pickup info on the appropriate dates
    const showDeliveryInfo = order.logisticDeliveryDate === dateStr;
    const showPickupInfo = order.logisticPickupDate === dateStr;

    const bgColor = isOptie
      ? 'bg-orange-100 border-orange-300'
      : 'bg-blue-50 border-blue-200';

    return (
      <Card
        key={`booking-${order.id}-${dateStr}`}
        className={`p-2.5 mb-2 cursor-pointer transition-colors hover:shadow-md ${bgColor} text-xs`}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/orders/${order.id}`);
        }}
      >
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="font-semibold text-xs leading-tight flex items-center gap-1">
            {order.orderNumber}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="flex gap-0.5">
            {isStart && <Badge className="bg-green-500/20 text-green-700 text-[9px] px-1">Start</Badge>}
            {isEnd && <Badge className="bg-red-500/20 text-red-700 text-[9px] px-1">Einde</Badge>}
            {!isStart && !isEnd && <Badge variant="outline" className="text-[9px] px-1">Actief</Badge>}
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground mb-1">
          {order.customerName}
        </div>

        {/* Show transport info on logistic dates */}
        {showDeliveryInfo && (
          <div className="text-[10px] text-green-600 flex items-center gap-1">
            <ArrowDown className="h-2.5 w-2.5" />
            <span className="font-medium">Leveren {order.segments.find(s => s.type === 'leveren')?.startTime}</span>
          </div>
        )}
        {showPickupInfo && (
          <div className="text-[10px] text-red-600 flex items-center gap-1">
            <ArrowUp className="h-2.5 w-2.5" />
            <span className="font-medium">Ophalen {order.segments.find(s => s.type === 'ophalen')?.startTime}</span>
          </div>
        )}

        {/* Vehicles */}
        <div className="text-[11px] font-medium mt-1">
          {(order.segments[0]?.vehicleTypes || []).map((v, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {v.count}x {vehicleTypes.find(vt => vt.id === v.type)?.name || v.type}
            </span>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {`${format(selectedDate, 'd MMM', { locale: nl })} – ${format(addDays(selectedDate, 6), 'd MMM yyyy', { locale: nl })}`}
          </h2>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="logistiek" className="text-xs gap-1.5 px-3">
                <Truck className="h-3.5 w-3.5" />
                Logistiek
              </TabsTrigger>
              <TabsTrigger value="boekingen" className="text-xs gap-1.5 px-3">
                <CalendarDays className="h-3.5 w-3.5" />
                Boekingen
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => onDateChange(addDays(selectedDate, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline"
            onClick={() => onDateChange(new Date())}
            className="text-sm"
          >
            Vandaag
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => onDateChange(addDays(selectedDate, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="border rounded-lg overflow-hidden w-full">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {displayDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const dateStr = format(day, 'yyyy-MM-dd');
            
            // Count entries for this day
            const entryCount = viewMode === 'logistiek'
              ? getLogisticEntries(day).length
              : getBookingOrders(day).length;

            return (
              <div 
                key={day.toISOString()} 
                className="p-2 text-center border-r last:border-r-0"
              >
                <div className="text-sm text-muted-foreground">
                  {format(day, 'EEE', { locale: nl })}
                </div>
                <div 
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    isToday 
                      ? 'bg-primary text-primary-foreground' 
                      : isSelected 
                        ? 'bg-primary/20 text-primary'
                        : ''
                  }`}
                >
                  {format(day, 'd')}
                </div>
                {entryCount > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {entryCount} {viewMode === 'logistiek' ? (entryCount === 1 ? 'rit' : 'ritten') : (entryCount === 1 ? 'boeking' : 'boekingen')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Day Columns */}
        <div className="grid grid-cols-7 min-h-[500px]">
          {displayDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            return (
              <div 
                key={day.toISOString()} 
                className="p-2 border-r last:border-r-0 bg-background"
                onClick={() => onDateChange(day)}
              >
                {viewMode === 'logistiek'
                  ? getLogisticEntries(day).map(entry => renderLogisticCard(entry))
                  : getBookingOrders(day).map(order => renderBookingCard(order, dateStr))
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
