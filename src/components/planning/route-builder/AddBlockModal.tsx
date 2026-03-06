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

/** Normaliseer tijd naar HH:mm voor type="time" (bijv. "09:30:00" → "09:30") */
function toTimeValue(s: string | null | undefined): string {
  if (!s || !s.trim()) return '';
  const trimmed = s.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

/** Vergelijk twee tijden in HH:mm; retourneert true als a < b */
function isTimeBefore(a: string, b: string): boolean {
  if (!a || !b) return false;
  const [ah, am] = a.slice(0, 5).split(':').map(Number);
  const [bh, bm] = b.slice(0, 5).split(':').map(Number);
  return ah < bh || (ah === bh && am < bm);
}

interface AddBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (params: {
    locationAddress: string;
    estimatedArrival: string;
    estimatedDeparture: string;
    notes?: string | null;
  }) => Promise<void>;
  /** Mogelijke starttijd (vertrek vorige stop) – wordt automatisch ingevuld */
  defaultArrival?: string | null;
  /** Mogelijke eindtijd (aankomst volgende stop) – wordt automatisch ingevuld */
  defaultDeparture?: string | null;
}

export function AddBlockModal({
  open,
  onOpenChange,
  onSave,
  defaultArrival,
  defaultDeparture,
}: AddBlockModalProps) {
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  const [saving, setSaving] = useState(false);
  const [timeError, setTimeError] = useState('');
  const [addressError, setAddressError] = useState('');

  // Vul tijden in bij openen; zorg dat eindtijd niet vóór starttijd ligt
  useEffect(() => {
    if (!open) return;
    const arr = toTimeValue(defaultArrival);
    const dep = toTimeValue(defaultDeparture);
    if (arr || dep) {
      setVan(arr);
      if (dep) {
        setTot(isTimeBefore(dep, arr) ? arr : dep);
      } else {
        setTot(arr);
      }
    } else {
      setVan('');
      setTot('');
    }
    setAddress('');
    setNotes('');
    setTimeError('');
    setAddressError('');
  }, [open, defaultArrival, defaultDeparture]);

  const handleVanChange = (value: string) => {
    setVan(value);
    setTimeError('');
    if (value && tot && isTimeBefore(tot, value)) setTot(value);
  };

  const handleTotChange = (value: string) => {
    setTot(value);
    setTimeError('');
    if (value && van && isTimeBefore(value, van)) setVan(value);
  };

  const handleSave = async () => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setAddressError('Adres is verplicht.');
      return;
    }
    if (!van || !tot) return;
    if (isTimeBefore(tot, van)) {
      setTimeError('Eindtijd mag niet vóór de starttijd liggen.');
      return;
    }
    setSaving(true);
    setTimeError('');
    setAddressError('');
    try {
      await onSave({
        locationAddress: trimmedAddress,
        estimatedArrival: van,
        estimatedDeparture: tot,
        notes: notes.trim() || null,
      });
      setAddress('');
      setNotes('');
      setVan('');
      setTot('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Blok toevoegen</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Adres *</Label>
            <Input
              value={address}
              onChange={e => {
                setAddress(e.target.value);
                setAddressError('');
              }}
              placeholder="Straat, plaats"
              className={addressError ? 'border-destructive' : ''}
            />
            {addressError && (
              <p className="text-sm text-destructive">{addressError}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Opmerking / comment</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optioneel"
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-2">
            <Label className="col-span-2">Van</Label>
            <Input
              type="time"
              className="col-span-2"
              value={van}
              onChange={e => handleVanChange(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-2">
            <Label className="col-span-2">Tot</Label>
            <Input
              type="time"
              className="col-span-2"
              value={tot}
              onChange={e => handleTotChange(e.target.value)}
            />
          </div>
          {timeError && (
            <p className="text-sm text-destructive">{timeError}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !address.trim() ||
              !van ||
              !tot ||
              (!!van && !!tot && isTimeBefore(tot, van))
            }
          >
            {saving ? 'Toevoegen…' : 'Toevoegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
