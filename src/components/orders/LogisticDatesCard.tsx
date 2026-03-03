import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Calendar, Clock, Truck, ArrowDown, ArrowUp, Pencil, X, Check, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface LogisticDatesCardProps {
  // Booking dates (klantperiode)
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  // Logistic dates (nullable overrides)
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  // Time windows (klant-flexibiliteit)
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  pickupWindowStart?: string | null;
  pickupWindowEnd?: string | null;
  // Callback
  onUpdate: (updates: {
    deliveryDate?: string | null;
    deliveryTime?: string | null;
    pickupDate?: string | null;
    pickupTime?: string | null;
    deliveryWindowStart?: string | null;
    deliveryWindowEnd?: string | null;
    pickupWindowStart?: string | null;
    pickupWindowEnd?: string | null;
  }) => void;
}

export function LogisticDatesCard({
  startDate,
  endDate,
  startTime,
  endTime,
  deliveryDate,
  deliveryTime,
  pickupDate,
  pickupTime,
  deliveryWindowStart,
  deliveryWindowEnd,
  pickupWindowStart,
  pickupWindowEnd,
  onUpdate,
}: LogisticDatesCardProps) {
  const [editing, setEditing] = useState<'leveren' | 'ophalen' | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editTime, setEditTime] = useState('');
  const [editWindowStart, setEditWindowStart] = useState('');
  const [editWindowEnd, setEditWindowEnd] = useState('');

  const effectiveDeliveryDate = deliveryDate || startDate;
  const effectiveDeliveryTime = deliveryTime || startTime;
  const effectivePickupDate = pickupDate || endDate;
  const effectivePickupTime = pickupTime || endTime;

  const hasCustomDelivery = !!deliveryDate || !!deliveryTime;
  const hasCustomPickup = !!pickupDate || !!pickupTime;
  const hasAnyCustom = hasCustomDelivery || hasCustomPickup;

  const hasDeliveryWindow = !!deliveryWindowStart && !!deliveryWindowEnd;
  const hasPickupWindow = !!pickupWindowStart && !!pickupWindowEnd;

  const startEdit = (segment: 'leveren' | 'ophalen') => {
    const date = segment === 'leveren' ? effectiveDeliveryDate : effectivePickupDate;
    const time = segment === 'leveren' ? effectiveDeliveryTime : effectivePickupTime;
    setEditDate(parseISO(date));
    setEditTime(time);
    if (segment === 'leveren') {
      setEditWindowStart(deliveryWindowStart || '');
      setEditWindowEnd(deliveryWindowEnd || '');
    } else {
      setEditWindowStart(pickupWindowStart || '');
      setEditWindowEnd(pickupWindowEnd || '');
    }
    setEditing(segment);
  };

  const saveEdit = () => {
    if (!editing || !editDate) return;
    const dateStr = format(editDate, 'yyyy-MM-dd');
    const timeStr = editTime;

    if (editing === 'leveren') {
      const newDate = dateStr !== startDate ? dateStr : null;
      const newTime = timeStr !== startTime ? timeStr : null;
      onUpdate({
        deliveryDate: newDate,
        deliveryTime: newTime,
        deliveryWindowStart: editWindowStart || null,
        deliveryWindowEnd: editWindowEnd || null,
      });
    } else {
      const newDate = dateStr !== endDate ? dateStr : null;
      const newTime = timeStr !== endTime ? timeStr : null;
      onUpdate({
        pickupDate: newDate,
        pickupTime: newTime,
        pickupWindowStart: editWindowStart || null,
        pickupWindowEnd: editWindowEnd || null,
      });
    }
    setEditing(null);
  };

  const resetToBooking = (segment: 'leveren' | 'ophalen') => {
    if (segment === 'leveren') {
      onUpdate({ deliveryDate: null, deliveryTime: null, deliveryWindowStart: null, deliveryWindowEnd: null });
    } else {
      onUpdate({ pickupDate: null, pickupTime: null, pickupWindowStart: null, pickupWindowEnd: null });
    }
    setEditing(null);
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'EEE d MMM yyyy', { locale: nl });
  };

  const renderSegment = (
    segment: 'leveren' | 'ophalen',
    icon: React.ReactNode,
    label: string,
    effectiveDate: string,
    effectiveTime: string,
    hasCustom: boolean,
    hasWindow: boolean,
    windowStart: string | null | undefined,
    windowEnd: string | null | undefined,
    bookingDate: string,
    bookingTime: string,
  ) => (
    <div className={cn(
      "p-3 rounded-lg border",
      hasCustom ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : "bg-muted/30"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="font-semibold text-sm">{label}</span>
          {hasCustom && (
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300">
              Aangepast
            </Badge>
          )}
        </div>
        {editing !== segment ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => startEdit(segment)}>
            <Pencil className="h-3 w-3" />
            Wijzig
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(null)}>
              <X className="h-3 w-3" />
            </Button>
            {(hasCustom || hasWindow) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-700" onClick={() => resetToBooking(segment)}>
                Reset
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs gap-1" onClick={saveEdit}>
              <Check className="h-3 w-3" />
              Opslaan
            </Button>
          </div>
        )}
      </div>

      {editing === segment ? (
        <div className="space-y-3">
          {/* Date + Time */}
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9">
                  <Calendar className="h-3.5 w-3.5" />
                  {editDate ? format(editDate, 'd MMM yyyy', { locale: nl }) : 'Kies datum'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={editDate}
                  onSelect={setEditDate}
                  locale={nl}
                />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-28 h-9"
              />
            </div>
          </div>

          {/* Time window */}
          <div className="border-t pt-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Timer className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Klant-tijdvenster (optioneel)</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={editWindowStart}
                onChange={(e) => setEditWindowStart(e.target.value)}
                className="w-28 h-8 text-sm"
                placeholder="Van"
              />
              <span className="text-xs text-muted-foreground">tot</span>
              <Input
                type="time"
                value={editWindowEnd}
                onChange={(e) => setEditWindowEnd(e.target.value)}
                className="w-28 h-8 text-sm"
                placeholder="Tot"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Periode waarbinnen de klant aangeeft dat wij mogen {segment === 'leveren' ? 'leveren' : 'ophalen'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{formatDate(effectiveDate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{effectiveTime}</span>
            </div>
            {hasCustom && (
              <span className="text-xs text-muted-foreground">
                (boeking: {formatDate(bookingDate)} {bookingTime})
              </span>
            )}
          </div>
          {hasWindow && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>Klant-venster: <span className="font-medium text-foreground">{windowStart} – {windowEnd}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Logistieke planning
          {hasAnyCustom && (
            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 ml-auto">
              Afwijkend van boeking
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderSegment(
          'leveren',
          <ArrowDown className="h-4 w-4 text-green-600" />,
          'Leveren',
          effectiveDeliveryDate,
          effectiveDeliveryTime,
          hasCustomDelivery,
          hasDeliveryWindow,
          deliveryWindowStart,
          deliveryWindowEnd,
          startDate,
          startTime,
        )}

        {renderSegment(
          'ophalen',
          <ArrowUp className="h-4 w-4 text-red-600" />,
          'Ophalen',
          effectivePickupDate,
          effectivePickupTime,
          hasCustomPickup,
          hasPickupWindow,
          pickupWindowStart,
          pickupWindowEnd,
          endDate,
          endTime,
        )}

        {!hasAnyCustom && !hasDeliveryWindow && !hasPickupWindow && (
          <p className="text-xs text-muted-foreground">
            Lever- en ophaaltijden volgen de boekingsdatums. Wijzig ze om eerder te leveren of later op te halen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
