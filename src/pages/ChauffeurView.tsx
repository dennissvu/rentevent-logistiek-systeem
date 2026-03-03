import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Truck,
  MapPin,
  Clock,
  Navigation,
  ArrowDown,
  ArrowUp,
  Users,
  Package,
  CheckCircle2,
  Loader2,
  Calendar,
  FileSignature,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDriversDb } from '@/hooks/useDriversDb';
import { useChauffeurToday, ChauffeurTrip } from '@/hooks/useChauffeurToday';
import { useTripStatus, TRIP_STATUS_FLOW, TripStatus } from '@/hooks/useTripStatus';

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  gepland: { label: 'Gepland', icon: <Clock className="h-4 w-4" />, color: 'bg-muted text-muted-foreground' },
  onderweg: { label: 'Onderweg', icon: <Navigation className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700' },
  geladen: { label: 'Geladen', icon: <Package className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700' },
  geleverd: { label: 'Geleverd', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-100 text-green-700' },
  opgehaald: { label: 'Opgehaald', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-100 text-green-700' },
  retour: { label: 'Retour', icon: <Navigation className="h-4 w-4" />, color: 'bg-purple-100 text-purple-700' },
  afgerond: { label: 'Afgerond', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-200 text-green-800' },
};

function openGoogleMaps(address: string) {
  const encoded = encodeURIComponent(address);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`, '_blank');
}

function TripCard({ trip, driverId }: { trip: ChauffeurTrip; driverId: string | null }) {
  const navigate = useNavigate();
  const { updateTripStatus, isUpdating } = useTripStatus();
  const isLeveren = trip.segment === 'leveren';
  const status = STATUS_LABELS[trip.tripStatus] || STATUS_LABELS.gepland;
  const nextActions = TRIP_STATUS_FLOW[trip.tripStatus] || [];
  const isDone = trip.tripStatus === 'afgerond';
  const showSignButton = trip.tripStatus === 'geleverd' && isLeveren;

  return (
    <Card className={`${isDone ? 'opacity-60' : ''} transition-all`}>
      <CardContent className="p-4 space-y-4">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <Badge className={`${status.color} gap-1 text-sm py-1 px-2.5`}>
            {status.icon}
            {status.label}
          </Badge>
          <Badge variant={isLeveren ? 'default' : 'secondary'} className="gap-1">
            {isLeveren ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            {isLeveren ? 'Leveren' : 'Ophalen'}
          </Badge>
        </div>

        {/* Times - big and clear */}
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 rounded-xl px-4 py-2 text-center flex-1">
            <p className="text-2xl font-bold text-primary">{trip.workStart}</p>
            <p className="text-xs text-muted-foreground">Jouw start</p>
          </div>
          <span className="text-muted-foreground text-lg">→</span>
          <div className="bg-muted/50 rounded-xl px-4 py-2 text-center flex-1">
            <p className="text-2xl font-bold">{trip.customerTime}</p>
            <p className="text-xs text-muted-foreground">Bij klant</p>
          </div>
        </div>

        {/* Customer + location */}
        <div>
          <p className="font-semibold text-lg">{trip.customerName}</p>
          <p className="text-sm text-muted-foreground">{trip.orderNumber}</p>
        </div>

        {/* Navigate button */}
        <Button
          variant="outline"
          className="w-full gap-2 h-12 text-base"
          onClick={() => openGoogleMaps(trip.location)}
        >
          <Navigation className="h-5 w-5 text-blue-600" />
          Navigeer naar locatie
        </Button>
        <p className="text-sm text-muted-foreground flex items-start gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
          {trip.location}
        </p>

        {/* Vehicle + transport info */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{trip.vehicleSummary}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Truck className="h-4 w-4" />
            <span>{trip.transportName}</span>
          </div>
        </div>

        {/* Co-drivers */}
        {trip.coDrivers.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>Samen met: <strong>{trip.coDrivers.join(', ')}</strong></span>
          </div>
        )}

        {/* Load/unload steps */}
        {trip.loadSteps.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Laad- & Losplan
            </p>
            {trip.loadSteps.map((step, i) => {
              const locLabel = step.location === 'winkel' ? '🏪 Winkel'
                : step.location === 'loods' ? '🏭 Loods'
                : step.location === 'blijft_staan' ? '🅿️ Blijft staan'
                : step.location;
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>
                    {step.action === 'laden' ? '📦' : '📤'}{' '}
                    <span className="font-medium">{step.vehicleCount}x</span>{' '}
                    {step.vehicleType}
                  </span>
                  <span className="text-muted-foreground">{locLabel}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Sign rental agreement button */}
        {showSignButton && (
          <Button
            variant="outline"
            className="w-full h-12 text-base gap-2 border-primary text-primary"
            onClick={() => navigate(`/verhuurovereenkomst/${trip.orderId}?segment=${trip.segment}&driver=${driverId || ''}`)}
          >
            <FileSignature className="h-5 w-5" />
            Laat klant tekenen
          </Button>
        )}

        {/* Status update actions */}
        {nextActions.length > 0 && (
          <div className="flex gap-2 pt-2">
            {nextActions.map(action => (
              <Button
                key={action.next}
                className={`flex-1 h-12 text-base text-white ${action.color}`}
                onClick={() => updateTripStatus(trip.assignmentId, action.next)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChauffeurView() {
  const { drivers, isLoading: driversLoading } = useDriversDb();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: trips = [], isLoading: tripsLoading } = useChauffeurToday(selectedDriverId, selectedDate);

  const activeDrivers = drivers.filter(d => d.available !== false);
  const selectedDriver = activeDrivers.find(d => d.id === selectedDriverId);
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  // Persist driver selection
  useEffect(() => {
    const saved = localStorage.getItem('chauffeur-driver-id');
    if (saved && activeDrivers.find(d => d.id === saved)) {
      setSelectedDriverId(saved);
    }
  }, [activeDrivers]);

  const handleSelectDriver = (id: string) => {
    setSelectedDriverId(id);
    localStorage.setItem('chauffeur-driver-id', id);
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const activeTrips = trips.filter(t => t.tripStatus !== 'afgerond');
  const completedTrips = trips.filter(t => t.tripStatus === 'afgerond');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-primary text-primary-foreground px-4 py-3 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            <span className="font-bold">Mijn Ritten</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8 p-0"
              onClick={() => shiftDate(-1)}
            >
              ‹
            </Button>
            <button
              className="text-sm font-medium px-2 py-1 rounded hover:bg-primary-foreground/20 transition-colors"
              onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
              title="Ga naar vandaag"
            >
              {isToday
                ? format(new Date(selectedDate + 'T12:00:00'), 'EEEE d MMM', { locale: nl })
                : format(new Date(selectedDate + 'T12:00:00'), 'EEE d MMM', { locale: nl })}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8 p-0"
              onClick={() => shiftDate(1)}
            >
              ›
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Driver selector */}
        <Select
          value={selectedDriverId || ''}
          onValueChange={handleSelectDriver}
        >
          <SelectTrigger className="w-full h-14 text-base">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <SelectValue placeholder="Kies je naam..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            {driversLoading ? (
              <div className="p-2"><Skeleton className="h-8 w-full" /></div>
            ) : (
              activeDrivers.map(driver => (
                <SelectItem key={driver.id} value={driver.id} className="text-base py-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {driver.name}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Content */}
        {selectedDriverId && (
          <>
            {tripsLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
              </div>
            ) : trips.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  Geen ritten {isToday ? 'vandaag' : `op ${format(new Date(selectedDate + 'T12:00:00'), 'd MMMM', { locale: nl })}`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isToday ? 'Je hebt vandaag geen ritten ingepland.' : 'Er zijn geen ritten ingepland op deze dag.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-primary/5 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{isToday ? 'Vandaag' : format(new Date(selectedDate + 'T12:00:00'), 'd MMM', { locale: nl })}</p>
                    <p className="text-2xl font-bold">{trips.length} {trips.length === 1 ? 'rit' : 'ritten'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Werktijd</p>
                    <p className="text-lg font-semibold">
                      {trips[0]?.workStart} – {trips[trips.length - 1]?.workEnd}
                    </p>
                  </div>
                </div>

                {/* All trips in order */}
                <div className="space-y-3">
                  {trips.map(trip => (
                    <TripCard key={trip.assignmentId} trip={trip} driverId={selectedDriverId} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
