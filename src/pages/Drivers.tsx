import { useState } from 'react';
import { useTransport } from '@/context/TransportContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, CalendarDays, CalendarOff } from 'lucide-react';
import { DriversList } from '@/components/drivers/DriversList';
import { WeeklyScheduleEditor } from '@/components/drivers/WeeklyScheduleEditor';
import { ScheduleExceptionsManager } from '@/components/drivers/ScheduleExceptionsManager';

export default function Drivers() {
  const { drivers, isLoading, addDriver, updateDriver, deleteDriver } = useTransport();
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Auto-select first driver when drivers load
  const activeDriverId = selectedDriverId || (drivers.length > 0 ? drivers[0].id : '');
  const selectedDriver = drivers.find(d => d.id === activeDriverId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chauffeurs</h1>
        <p className="text-muted-foreground">Beheer chauffeurs, weekroosters en uitzonderingen</p>
      </div>

      <Tabs defaultValue="chauffeurs">
        <TabsList>
          <TabsTrigger value="chauffeurs" className="gap-1.5">
            <User className="h-4 w-4" />
            Chauffeurs
          </TabsTrigger>
          <TabsTrigger value="weekrooster" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Weekrooster
          </TabsTrigger>
          <TabsTrigger value="uitzonderingen" className="gap-1.5">
            <CalendarOff className="h-4 w-4" />
            Uitzonderingen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chauffeurs" className="mt-4">
          <DriversList
            drivers={drivers}
            onAdd={addDriver}
            onUpdate={updateDriver}
            onDelete={deleteDriver}
          />
        </TabsContent>

        <TabsContent value="weekrooster" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Standaard weekrooster</CardTitle>
                <Select value={activeDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Kies chauffeur" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Stel het vaste weekrooster in voor {selectedDriver?.name || 'de chauffeur'}. 
                Dit wordt automatisch gebruikt bij het plannen.
              </p>
            </CardHeader>
            <CardContent>
              {activeDriverId ? (
                <WeeklyScheduleEditor driverId={activeDriverId} />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Voeg eerst een chauffeur toe.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uitzonderingen" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Uitzonderingen</CardTitle>
                <Select value={activeDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Kies chauffeur" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Voeg vrije dagen, vakantie, ziekte of aangepaste werktijden toe voor {selectedDriver?.name || 'de chauffeur'}.
              </p>
            </CardHeader>
            <CardContent>
              {activeDriverId ? (
                <ScheduleExceptionsManager driverId={activeDriverId} />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Voeg eerst een chauffeur toe.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
