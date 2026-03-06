import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RouteBuilderStop } from '@/hooks/useDayRouteBuilder';

interface EditStopTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: RouteBuilderStop | null;
  onSave: (params: {
    stopId: string;
    estimatedArrival?: string;
    estimatedDeparture?: string;
    driveTimeFromPrevious?: number;
    notes?: string | null;
    locationAddress?: string | null;
  }) => Promise<void>;
}

export function EditStopTimeModal({
  open,
  onOpenChange,
  stop,
  onSave,
}: EditStopTimeModalProps) {
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [driveMin, setDriveMin] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [saving, setSaving] = useState(false);

  const isTussenstop = stop?.stopType === 'tussenstop';

  useEffect(() => {
    if (stop) {
      setArrival(stop.estimatedArrival || '');
      setDeparture(stop.estimatedDeparture || '');
      setDriveMin(stop.driveTimeFromPrevious != null ? String(stop.driveTimeFromPrevious) : '');
      setNotes(stop.notes || '');
      setLocationAddress(stop.locationAddress || '');
      setAddressError('');
    }
  }, [stop]);

  const handleSave = async () => {
    if (!stop) return;
    if (isTussenstop && !locationAddress.trim()) {
      setAddressError('Adres is verplicht.');
      return;
    }
    setSaving(true);
    setAddressError('');
    try {
      await onSave({
        stopId: stop.id,
        estimatedArrival: arrival || undefined,
        estimatedDeparture: departure || undefined,
        driveTimeFromPrevious: driveMin !== '' ? parseInt(driveMin, 10) : undefined,
        notes: notes || null,
        ...(isTussenstop && { locationAddress: locationAddress.trim() || null }),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!stop) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tijd aanpassen</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {isTussenstop && (
            <div className="grid gap-2">
              <Label>Adres *</Label>
              <Input
                value={locationAddress}
                onChange={e => {
                  setLocationAddress(e.target.value);
                  setAddressError('');
                }}
                placeholder="Straat, plaats"
                className={addressError ? 'border-destructive' : ''}
              />
              {addressError && (
                <p className="text-sm text-destructive">{addressError}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-2">
            <Label className="col-span-2">Aankomst</Label>
            <Input
              type="time"
              className="col-span-2"
              value={arrival}
              onChange={e => setArrival(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-2">
            <Label className="col-span-2">Vertrek</Label>
            <Input
              type="time"
              className="col-span-2"
              value={departure}
              onChange={e => setDeparture(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-2">
            <Label className="col-span-2">Rijtijd vanaf vorige (min)</Label>
            <Input
              type="number"
              min={0}
              className="col-span-2"
              value={driveMin}
              onChange={e => setDriveMin(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="grid gap-2">
            <Label>Opmerking</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Vrij in te vullen"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (isTussenstop && !locationAddress.trim())}
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
