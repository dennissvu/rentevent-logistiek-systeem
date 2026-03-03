
-- Weekly schedule: per driver, per day of week, with support for split shifts
CREATE TABLE public.driver_weekly_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Monday, 6=Sunday
  is_working BOOLEAN NOT NULL DEFAULT true,
  start_time_1 TIME WITHOUT TIME ZONE DEFAULT '07:00',
  end_time_1 TIME WITHOUT TIME ZONE DEFAULT '16:00',
  start_time_2 TIME WITHOUT TIME ZONE, -- for split shifts
  end_time_2 TIME WITHOUT TIME ZONE,   -- for split shifts
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id, day_of_week)
);

-- Schedule exceptions: specific date overrides (vacation, sick, adjusted hours)
CREATE TABLE public.driver_schedule_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type TEXT NOT NULL DEFAULT 'vrij', -- vrij, vakantie, ziek, aangepast
  is_available BOOLEAN NOT NULL DEFAULT false,
  start_time TIME WITHOUT TIME ZONE, -- only used when exception_type = 'aangepast'
  end_time TIME WITHOUT TIME ZONE,   -- only used when exception_type = 'aangepast'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id, exception_date)
);

-- Enable RLS
ALTER TABLE public.driver_weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_schedule_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly schedules
CREATE POLICY "Weekly schedules viewable by everyone"
  ON public.driver_weekly_schedules FOR SELECT USING (true);
CREATE POLICY "Weekly schedules can be created"
  ON public.driver_weekly_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Weekly schedules can be updated"
  ON public.driver_weekly_schedules FOR UPDATE USING (true);
CREATE POLICY "Weekly schedules can be deleted"
  ON public.driver_weekly_schedules FOR DELETE USING (true);

-- RLS policies for exceptions
CREATE POLICY "Schedule exceptions viewable by everyone"
  ON public.driver_schedule_exceptions FOR SELECT USING (true);
CREATE POLICY "Schedule exceptions can be created"
  ON public.driver_schedule_exceptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Schedule exceptions can be updated"
  ON public.driver_schedule_exceptions FOR UPDATE USING (true);
CREATE POLICY "Schedule exceptions can be deleted"
  ON public.driver_schedule_exceptions FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_driver_weekly_schedules_updated_at
  BEFORE UPDATE ON public.driver_weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_schedule_exceptions_updated_at
  BEFORE UPDATE ON public.driver_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
