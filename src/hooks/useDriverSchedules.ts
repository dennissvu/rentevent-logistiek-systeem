import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WeeklySchedule {
  id: string;
  driverId: string;
  dayOfWeek: number; // 0=Monday, 6=Sunday
  isWorking: boolean;
  startTime1: string;
  endTime1: string;
  startTime2: string | null;
  endTime2: string | null;
}

export interface ScheduleException {
  id: string;
  driverId: string;
  exceptionDate: string;
  exceptionType: 'vrij' | 'vakantie' | 'ziek' | 'aangepast';
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
}

interface DbWeeklySchedule {
  id: string;
  driver_id: string;
  day_of_week: number;
  is_working: boolean;
  start_time_1: string | null;
  end_time_1: string | null;
  start_time_2: string | null;
  end_time_2: string | null;
}

interface DbScheduleException {
  id: string;
  driver_id: string;
  exception_date: string;
  exception_type: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

const EXCEPTION_LABELS: Record<string, string> = {
  vrij: 'Vrij',
  vakantie: 'Vakantie',
  ziek: 'Ziek',
  aangepast: 'Aangepaste tijden',
};

export { DAY_NAMES, EXCEPTION_LABELS };

const dbToWeekly = (db: DbWeeklySchedule): WeeklySchedule => ({
  id: db.id,
  driverId: db.driver_id,
  dayOfWeek: db.day_of_week,
  isWorking: db.is_working,
  startTime1: db.start_time_1 || '07:00',
  endTime1: db.end_time_1 || '16:00',
  startTime2: db.start_time_2,
  endTime2: db.end_time_2,
});

const dbToException = (db: DbScheduleException): ScheduleException => ({
  id: db.id,
  driverId: db.driver_id,
  exceptionDate: db.exception_date,
  exceptionType: db.exception_type as ScheduleException['exceptionType'],
  isAvailable: db.is_available,
  startTime: db.start_time,
  endTime: db.end_time,
  notes: db.notes,
});

export function useDriverSchedules(driverId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch weekly schedules
  const { data: weeklySchedules = [], isLoading: isLoadingWeekly } = useQuery({
    queryKey: ['driver-weekly-schedules', driverId],
    queryFn: async () => {
      let query = supabase
        .from('driver_weekly_schedules')
        .select('*')
        .order('day_of_week');
      
      if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as DbWeeklySchedule[]).map(dbToWeekly);
    },
  });

  // Fetch exceptions
  const { data: exceptions = [], isLoading: isLoadingExceptions } = useQuery({
    queryKey: ['driver-schedule-exceptions', driverId],
    queryFn: async () => {
      let query = supabase
        .from('driver_schedule_exceptions')
        .select('*')
        .order('exception_date');

      if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as DbScheduleException[]).map(dbToException);
    },
  });

  // Upsert weekly schedule for a day
  const upsertWeeklyMutation = useMutation({
    mutationFn: async (schedule: Omit<WeeklySchedule, 'id'> & { id?: string }) => {
      const { error } = await supabase
        .from('driver_weekly_schedules')
        .upsert({
          id: schedule.id || undefined,
          driver_id: schedule.driverId,
          day_of_week: schedule.dayOfWeek,
          is_working: schedule.isWorking,
          start_time_1: schedule.startTime1,
          end_time_1: schedule.endTime1,
          start_time_2: schedule.startTime2,
          end_time_2: schedule.endTime2,
        }, { onConflict: 'driver_id,day_of_week' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-weekly-schedules'] });
    },
    onError: (error) => {
      console.error('Error saving weekly schedule:', error);
      toast({ title: 'Fout bij opslaan rooster', variant: 'destructive' });
    },
  });

  // Save full week at once
  const saveFullWeekMutation = useMutation({
    mutationFn: async (schedules: (Omit<WeeklySchedule, 'id'> & { id?: string })[]) => {
      const rows = schedules.map(s => ({
        id: s.id || undefined,
        driver_id: s.driverId,
        day_of_week: s.dayOfWeek,
        is_working: s.isWorking,
        start_time_1: s.startTime1,
        end_time_1: s.endTime1,
        start_time_2: s.startTime2,
        end_time_2: s.endTime2,
      }));

      const { error } = await supabase
        .from('driver_weekly_schedules')
        .upsert(rows, { onConflict: 'driver_id,day_of_week' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-weekly-schedules'] });
      toast({ title: 'Weekrooster opgeslagen' });
    },
    onError: (error) => {
      console.error('Error saving full week:', error);
      toast({ title: 'Fout bij opslaan weekrooster', variant: 'destructive' });
    },
  });

  // Add/update exception
  const upsertExceptionMutation = useMutation({
    mutationFn: async (exception: Omit<ScheduleException, 'id'> & { id?: string }) => {
      const { error } = await supabase
        .from('driver_schedule_exceptions')
        .upsert({
          id: exception.id || undefined,
          driver_id: exception.driverId,
          exception_date: exception.exceptionDate,
          exception_type: exception.exceptionType,
          is_available: exception.isAvailable,
          start_time: exception.startTime,
          end_time: exception.endTime,
          notes: exception.notes,
        }, { onConflict: 'driver_id,exception_date' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-schedule-exceptions'] });
      toast({ title: 'Uitzondering opgeslagen' });
    },
    onError: (error) => {
      console.error('Error saving exception:', error);
      toast({ title: 'Fout bij opslaan uitzondering', variant: 'destructive' });
    },
  });

  // Delete exception
  const deleteExceptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('driver_schedule_exceptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-schedule-exceptions'] });
      toast({ title: 'Uitzondering verwijderd' });
    },
    onError: (error) => {
      console.error('Error deleting exception:', error);
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' });
    },
  });

  // Helper: get availability for a specific date and driver
  const getAvailabilityForDate = (checkDriverId: string, date: string): {
    isAvailable: boolean;
    startTime: string | null;
    endTime: string | null;
    reason?: string;
  } => {
    // Check exceptions first (they override weekly schedule)
    const exception = exceptions.find(
      e => e.driverId === checkDriverId && e.exceptionDate === date
    );
    if (exception) {
      return {
        isAvailable: exception.isAvailable,
        startTime: exception.isAvailable ? exception.startTime : null,
        endTime: exception.isAvailable ? exception.endTime : null,
        reason: EXCEPTION_LABELS[exception.exceptionType],
      };
    }

    // Fall back to weekly schedule
    const dayOfWeek = getDayOfWeek(date);
    const schedule = weeklySchedules.find(
      s => s.driverId === checkDriverId && s.dayOfWeek === dayOfWeek
    );

    if (!schedule) {
      // No schedule defined = use default (available)
      return { isAvailable: true, startTime: '07:00', endTime: '16:00' };
    }

    return {
      isAvailable: schedule.isWorking,
      startTime: schedule.isWorking ? schedule.startTime1 : null,
      endTime: schedule.isWorking ? schedule.endTime1 : null,
    };
  };

  return {
    weeklySchedules,
    exceptions,
    isLoading: isLoadingWeekly || isLoadingExceptions,
    upsertWeekly: (schedule: Omit<WeeklySchedule, 'id'> & { id?: string }) =>
      upsertWeeklyMutation.mutateAsync(schedule),
    saveFullWeek: (schedules: (Omit<WeeklySchedule, 'id'> & { id?: string })[]) =>
      saveFullWeekMutation.mutateAsync(schedules),
    isSavingWeek: saveFullWeekMutation.isPending,
    upsertException: (exception: Omit<ScheduleException, 'id'> & { id?: string }) =>
      upsertExceptionMutation.mutateAsync(exception),
    deleteException: (id: string) => deleteExceptionMutation.mutateAsync(id),
    getAvailabilityForDate,
  };
}

// Helper: convert date string to day of week (0=Monday, 6=Sunday)
function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const jsDay = date.getDay(); // 0=Sunday, 6=Saturday
  return jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Monday
}

export { getDayOfWeek };
