import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, Truck, Users, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { useTransport } from '@/context/TransportContext';
import { WeekCalendarView } from './WeekCalendarView';
import { useOrders } from '@/context/OrdersContext';

export function PlanningDashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showOptie, setShowOptie] = useState(true);
  const [showBevestigd, setShowBevestigd] = useState(true);
  const { getPlanningOrders } = useOrders();
  const { drivers } = useTransport();
  
  // Get orders from context (optie + bevestigd)
  const allOrders = getPlanningOrders();
  
  // Filter orders based on toggles
  const orders = allOrders.filter(order => {
    const statusMatch = (order.status === 'optie' && showOptie) || 
                        (order.status === 'bevestigd' && showBevestigd);
    return statusMatch;
  });
  
  // Count segments missing transport or driver (for the stat card)
  const allSegments = allOrders.flatMap(o => o.segments);
  const pendingCount = allSegments.filter(s => !s.assignedTransport || !s.assignedDriver).length;

  // Note: date filtering is now handled within WeekCalendarView based on view mode

  
  
  // Count assigned segments (those with both transport AND driver)
  const assignedCount = allSegments.filter(s => s.assignedTransport && s.assignedDriver).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{orders.length}</p>
              <p className="text-sm text-muted-foreground">Geplande orders</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer transition-all hover:shadow-md hover:bg-yellow-50"
          onClick={() => navigate('/orders?filter=unassigned')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Niet toegewezen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{assignedCount}</p>
              <p className="text-sm text-muted-foreground">Toegewezen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{drivers.length}</p>
              <p className="text-sm text-muted-foreground">Chauffeurs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="show-optie" 
            checked={showOptie} 
            onCheckedChange={(checked) => setShowOptie(checked === true)}
          />
          <Label htmlFor="show-optie" className="text-sm font-medium cursor-pointer flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>
            Optie
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox 
            id="show-bevestigd" 
            checked={showBevestigd} 
            onCheckedChange={(checked) => setShowBevestigd(checked === true)}
          />
          <Label htmlFor="show-bevestigd" className="text-sm font-medium cursor-pointer flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></span>
            Bevestigd
          </Label>
        </div>
      </div>

      {/* Week Calendar View */}
      <WeekCalendarView 
        orders={orders}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
    </div>
  );
}
