
-- Table for load/unload instructions per transport assignment
CREATE TABLE public.order_load_unload_instructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.order_transport_assignments(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'laden',
  vehicle_type TEXT NOT NULL,
  vehicle_count INTEGER NOT NULL DEFAULT 1,
  location TEXT NOT NULL DEFAULT 'winkel',
  sequence_number INTEGER NOT NULL DEFAULT 1,
  helper_count INTEGER NOT NULL DEFAULT 0,
  custom_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_load_unload_instructions ENABLE ROW LEVEL SECURITY;

-- RLS policies (matching existing open pattern)
CREATE POLICY "Load unload instructions viewable by everyone"
ON public.order_load_unload_instructions FOR SELECT USING (true);

CREATE POLICY "Load unload instructions can be created"
ON public.order_load_unload_instructions FOR INSERT WITH CHECK (true);

CREATE POLICY "Load unload instructions can be updated"
ON public.order_load_unload_instructions FOR UPDATE USING (true);

CREATE POLICY "Load unload instructions can be deleted"
ON public.order_load_unload_instructions FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_load_unload_instructions_updated_at
BEFORE UPDATE ON public.order_load_unload_instructions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_load_unload_order_id ON public.order_load_unload_instructions(order_id);
CREATE INDEX idx_load_unload_assignment_id ON public.order_load_unload_instructions(assignment_id);
