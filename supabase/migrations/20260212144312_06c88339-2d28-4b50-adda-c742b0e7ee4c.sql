
CREATE TABLE public.planning_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'algemeen',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planning_memory ENABLE ROW LEVEL SECURITY;

-- Public read/write since no auth in this app
CREATE POLICY "Anyone can read planning memory"
  ON public.planning_memory FOR SELECT USING (true);

CREATE POLICY "Anyone can insert planning memory"
  ON public.planning_memory FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update planning memory"
  ON public.planning_memory FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete planning memory"
  ON public.planning_memory FOR DELETE USING (true);

CREATE TRIGGER update_planning_memory_updated_at
  BEFORE UPDATE ON public.planning_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
