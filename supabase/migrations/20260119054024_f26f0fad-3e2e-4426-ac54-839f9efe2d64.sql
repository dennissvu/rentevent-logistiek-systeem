-- Create a table for transport assignments (multiple per order segment)
CREATE TABLE public.order_transport_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK (segment IN ('leveren', 'ophalen')),
  transport_id TEXT NOT NULL,
  driver_id TEXT,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, segment, sequence_number)
);

-- Enable Row Level Security
ALTER TABLE public.order_transport_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Assignments viewable by everyone"
ON public.order_transport_assignments FOR SELECT
USING (true);

CREATE POLICY "Assignments can be created by everyone"
ON public.order_transport_assignments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Assignments can be updated by everyone"
ON public.order_transport_assignments FOR UPDATE
USING (true);

CREATE POLICY "Assignments can be deleted by everyone"
ON public.order_transport_assignments FOR DELETE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_order_transport_assignments_updated_at
BEFORE UPDATE ON public.order_transport_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();