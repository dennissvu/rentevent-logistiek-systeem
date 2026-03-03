import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Calendar, Umbrella, Heart, Clock, AlertTriangle } from 'lucide-react';
import { ScheduleException, EXCEPTION_LABELS, useDriverSchedules } from '@/hooks/useDriverSchedules';
import { format, parseISO, isAfter, startOfToday } from 'date-fns';
import { nl } from 'date-fns/locale';

interface ScheduleExceptionsManagerProps {
  driverId: string;
}

const EXCEPTION_ICONS: Record<string, React.ReactNode> = {
  vrij: <Calendar className="h-3.5 w-3.5" />,
  vakantie: <Umbrella className="h-3.5 w-3.5" />,
  ziek: <Heart className="h-3.5 w-3.5" />,
  aangepast: <Clock className="h-3.5 w-3.5" />,
};

const EXCEPTION_COLORS: Record<string, string> = {
  vrij: 'bg-muted text-muted-foreground',
  vakantie: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ziek: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  aangepast: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
};

export function ScheduleExceptionsManager({ driverId }: ScheduleExceptionsManagerProps) {
  const { exceptions, isLoading, upsertException, deleteException } = useDriverSchedules(driverId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionEndDate, setExceptionEndDate] = useState('');
  const [exceptionType, setExceptionType] = useState<ScheduleException['exceptionType']>('vrij');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setExceptionDate('');
    setExceptionEndDate('');
    setExceptionType('vrij');
    setStartTime('');
    setEndTime('');
    setNotes('');
  };

  const handleAdd = async () => {
    if (!exceptionDate) return;

    const isAangepast = exceptionType === 'aangepast';
    
    // Support date ranges
    const startDate = exceptionDate;
    const endDate = exceptionEndDate || exceptionDate;
    
    const dates: string[] = [];
    let current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    for (const date of dates) {
      await upsertException({
        driverId,
        exceptionDate: date,
        exceptionType,
        isAvailable: isAangepast,
        startTime: isAangepast ? startTime || null : null,
        endTime: isAangepast ? endTime || null : null,
        notes: notes || null,
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteException(deleteId);
      setDeleteId(null);
    }
  };

  // Split into upcoming and past
  const today = startOfToday();
  const driverExceptions = exceptions.filter(e => e.driverId === driverId);
  const upcomingExceptions = driverExceptions.filter(e => 
    isAfter(parseISO(e.exceptionDate), today) || e.exceptionDate === format(today, 'yyyy-MM-dd')
  );
  const pastExceptions = driverExceptions.filter(e => 
    !isAfter(parseISO(e.exceptionDate), today) && e.exceptionDate !== format(today, 'yyyy-MM-dd')
  );

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setIsDialogOpen(true)} size="sm">
        <Plus className="h-4 w-4 mr-2" />
        Uitzondering toevoegen
      </Button>

      {upcomingExceptions.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Geen uitzonderingen gepland.
        </p>
      )}

      {/* Upcoming exceptions */}
      <div className="space-y-2">
        {upcomingExceptions.map(exc => (
          <Card key={exc.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={`gap-1 ${EXCEPTION_COLORS[exc.exceptionType]}`}>
                  {EXCEPTION_ICONS[exc.exceptionType]}
                  {EXCEPTION_LABELS[exc.exceptionType]}
                </Badge>
                <span className="text-sm font-medium">
                  {format(parseISO(exc.exceptionDate), 'EEEE d MMMM yyyy', { locale: nl })}
                </span>
                {exc.exceptionType === 'aangepast' && exc.startTime && exc.endTime && (
                  <span className="text-sm text-muted-foreground">
                    {exc.startTime.slice(0, 5)} – {exc.endTime.slice(0, 5)}
                  </span>
                )}
                {exc.notes && (
                  <span className="text-xs text-muted-foreground italic">{exc.notes}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDeleteId(exc.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Past exceptions (collapsed) */}
      {pastExceptions.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
            {pastExceptions.length} verlopen uitzondering{pastExceptions.length !== 1 ? 'en' : ''}
          </summary>
          <div className="space-y-1 mt-2">
            {pastExceptions.slice(-5).map(exc => (
              <div key={exc.id} className="flex items-center gap-2 text-muted-foreground py-1">
                <Badge variant="outline" className="text-[10px] gap-1">
                  {EXCEPTION_LABELS[exc.exceptionType]}
                </Badge>
                <span className="text-xs">
                  {format(parseISO(exc.exceptionDate), 'd MMM yyyy', { locale: nl })}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add Exception Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uitzondering toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Startdatum *</Label>
                <Input
                  type="date"
                  value={exceptionDate}
                  onChange={(e) => setExceptionDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Einddatum (optioneel)</Label>
                <Input
                  type="date"
                  value={exceptionEndDate}
                  onChange={(e) => setExceptionEndDate(e.target.value)}
                  min={exceptionDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={exceptionType} onValueChange={(v) => setExceptionType(v as ScheduleException['exceptionType'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vrij">🗓️ Vrij</SelectItem>
                  <SelectItem value="vakantie">☀️ Vakantie</SelectItem>
                  <SelectItem value="ziek">❤️‍🩹 Ziek</SelectItem>
                  <SelectItem value="aangepast">⏰ Aangepaste tijden</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exceptionType === 'aangepast' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Starttijd</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Eindtijd</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notitie (optioneel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bijv. 'Tandarts om 10:00'"
                rows={2}
              />
            </div>

            {exceptionEndDate && exceptionDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <AlertTriangle className="h-3.5 w-3.5" />
                Dit maakt een uitzondering voor elke dag in het bereik.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Annuleren
            </Button>
            <Button onClick={handleAdd} disabled={!exceptionDate}>
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uitzondering verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze uitzondering wilt verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
