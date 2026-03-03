import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransport } from "@/context/TransportContext";
import { format, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Demo bookings data - would come from real data
const demoBookings = [
  { transportId: 'bakwagen-man', startTime: '07:30', endTime: '08:30' },
  { transportId: 'aanhanger-5', startTime: '07:30', endTime: '08:30' },
];

// Generate time slots from 06:00 to 20:00 with 30 min intervals
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 6; hour <= 20; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 20) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots();

interface TransportAvailabilityProps {
  selectedDate?: Date;
}

export const TransportAvailability = ({ selectedDate = new Date() }: TransportAvailabilityProps) => {
  const { bakwagens, aanhangers } = useTransport();
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isSlotBooked = (transportId: string, timeSlot: string) => {
    const booking = demoBookings.find(b => b.transportId === transportId);
    if (!booking) return false;

    const slotMinutes = parseInt(timeSlot.split(':')[0]) * 60 + parseInt(timeSlot.split(':')[1]);
    const startMinutes = parseInt(booking.startTime.split(':')[0]) * 60 + parseInt(booking.startTime.split(':')[1]);
    const endMinutes = parseInt(booking.endTime.split(':')[0]) * 60 + parseInt(booking.endTime.split(':')[1]);

    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => addDays(prev, direction === 'next' ? 1 : -1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      setCalendarOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[180px] justify-start text-left font-medium">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(currentDate, 'EEEE d MMMM', { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={handleDateSelect}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="text-lg">Beschikbaarheid Transport</CardTitle>
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded" />
            <span className="text-muted-foreground">Beschikbaar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
            <span className="text-muted-foreground">In gebruik</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Time header */}
          <div className="flex border-b">
            <div className="w-28 shrink-0 p-2 font-medium text-sm bg-muted/30" />
            {timeSlots.map((slot, index) => (
              <div
                key={slot}
                className={cn(
                  "flex-1 min-w-[40px] p-1 text-center text-xs text-muted-foreground",
                  index % 2 === 0 && "font-medium"
                )}
              >
                {index % 2 === 0 ? slot : ''}
              </div>
            ))}
          </div>

          {/* Bakwagens section */}
          <div className="border-b border-muted">
            <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 bg-muted/20 uppercase tracking-wide">
              Bakwagens
            </div>
            {bakwagens.map((transport) => (
              <div key={transport.id} className="flex border-b border-muted/50 last:border-b-0">
                <div className="w-28 shrink-0 p-2 text-sm font-medium bg-muted/10 flex items-center">
                  {transport.name}
                </div>
                <div className="flex flex-1">
                  {timeSlots.map((slot, index) => {
                    const booked = isSlotBooked(transport.id, slot);
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "flex-1 min-w-[40px] h-10 transition-colors",
                          index > 0 && "border-l border-muted/30",
                          booked 
                            ? 'bg-red-100 hover:bg-red-200' 
                            : 'bg-emerald-50 hover:bg-emerald-100'
                        )}
                        title={`${transport.name} - ${slot}: ${booked ? 'In gebruik' : 'Beschikbaar'}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Aanhangers section */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 bg-muted/20 uppercase tracking-wide">
              Aanhangers
            </div>
            {aanhangers.map((transport) => (
              <div key={transport.id} className="flex border-b border-muted/50 last:border-b-0">
                <div className="w-28 shrink-0 p-2 text-sm font-medium bg-muted/10 flex items-center">
                  {transport.name}
                </div>
                <div className="flex flex-1">
                  {timeSlots.map((slot, index) => {
                    const booked = isSlotBooked(transport.id, slot);
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "flex-1 min-w-[40px] h-10 transition-colors",
                          index > 0 && "border-l border-muted/30",
                          booked 
                            ? 'bg-red-100 hover:bg-red-200' 
                            : 'bg-emerald-50 hover:bg-emerald-100'
                        )}
                        title={`${transport.name} - ${slot}: ${booked ? 'In gebruik' : 'Beschikbaar'}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
