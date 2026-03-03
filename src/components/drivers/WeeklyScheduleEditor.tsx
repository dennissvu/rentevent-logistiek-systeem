import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Plus, X, Clock } from 'lucide-react';
import { WeeklySchedule, DAY_NAMES, useDriverSchedules } from '@/hooks/useDriverSchedules';

interface WeeklyScheduleEditorProps {
  driverId: string;
}

interface DayFormData {
  dayOfWeek: number;
  isWorking: boolean;
  startTime1: string;
  endTime1: string;
  startTime2: string | null;
  endTime2: string | null;
  existingId?: string;
  hasSplitShift: boolean;
}

const DEFAULT_DAY = (day: number): DayFormData => ({
  dayOfWeek: day,
  isWorking: day < 5, // Mon-Fri default to working
  startTime1: '07:00',
  endTime1: '16:00',
  startTime2: null,
  endTime2: null,
  hasSplitShift: false,
});

export function WeeklyScheduleEditor({ driverId }: WeeklyScheduleEditorProps) {
  const { weeklySchedules, isLoading, saveFullWeek, isSavingWeek } = useDriverSchedules(driverId);
  const [days, setDays] = useState<DayFormData[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form from DB data
  useEffect(() => {
    const formDays: DayFormData[] = Array.from({ length: 7 }, (_, i) => {
      const existing = weeklySchedules.find(s => s.dayOfWeek === i);
      if (existing) {
        return {
          dayOfWeek: i,
          isWorking: existing.isWorking,
          startTime1: existing.startTime1,
          endTime1: existing.endTime1,
          startTime2: existing.startTime2,
          endTime2: existing.endTime2,
          existingId: existing.id,
          hasSplitShift: !!existing.startTime2 && !!existing.endTime2,
        };
      }
      return DEFAULT_DAY(i);
    });
    setDays(formDays);
    setHasChanges(false);
  }, [weeklySchedules]);

  const updateDay = (dayIndex: number, updates: Partial<DayFormData>) => {
    setDays(prev => prev.map((d, i) => i === dayIndex ? { ...d, ...updates } : d));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const schedules = days.map(d => ({
      id: d.existingId,
      driverId,
      dayOfWeek: d.dayOfWeek,
      isWorking: d.isWorking,
      startTime1: d.startTime1,
      endTime1: d.endTime1,
      startTime2: d.hasSplitShift ? d.startTime2 : null,
      endTime2: d.hasSplitShift ? d.endTime2 : null,
    }));
    await saveFullWeek(schedules);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.map((day, i) => (
        <Card key={day.dayOfWeek} className={!day.isWorking ? 'opacity-60' : ''}>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              {/* Day name + toggle */}
              <div className="flex items-center gap-2 w-28 shrink-0">
                <Switch
                  checked={day.isWorking}
                  onCheckedChange={(checked) => updateDay(i, { isWorking: checked })}
                />
                <span className="text-sm font-medium">{DAY_NAMES[day.dayOfWeek]}</span>
              </div>

              {day.isWorking ? (
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Primary shift */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="time"
                      value={day.startTime1}
                      onChange={(e) => updateDay(i, { startTime1: e.target.value })}
                      className="w-[110px] h-8 text-sm"
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input
                      type="time"
                      value={day.endTime1}
                      onChange={(e) => updateDay(i, { endTime1: e.target.value })}
                      className="w-[110px] h-8 text-sm"
                    />
                  </div>

                  {/* Split shift */}
                  {day.hasSplitShift ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5">2e dienst</Badge>
                      <Input
                        type="time"
                        value={day.startTime2 || ''}
                        onChange={(e) => updateDay(i, { startTime2: e.target.value })}
                        className="w-[110px] h-8 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="time"
                        value={day.endTime2 || ''}
                        onChange={(e) => updateDay(i, { endTime2: e.target.value })}
                        className="w-[110px] h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateDay(i, { hasSplitShift: false, startTime2: null, endTime2: null })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => updateDay(i, { hasSplitShift: true, startTime2: '17:00', endTime2: '21:00' })}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      2e dienst
                    </Button>
                  )}
                </div>
              ) : (
                <Badge variant="secondary" className="text-xs">Vrij</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        onClick={handleSave}
        disabled={!hasChanges || isSavingWeek}
        className="w-full"
      >
        <Save className="h-4 w-4 mr-2" />
        {isSavingWeek ? 'Opslaan...' : 'Weekrooster opslaan'}
      </Button>
    </div>
  );
}
