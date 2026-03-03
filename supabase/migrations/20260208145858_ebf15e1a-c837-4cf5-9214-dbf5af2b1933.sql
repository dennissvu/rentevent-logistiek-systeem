
-- Add status tracking to order_transport_assignments for driver status updates
ALTER TABLE public.order_transport_assignments 
ADD COLUMN IF NOT EXISTS trip_status text NOT NULL DEFAULT 'gepland';

-- Add comment for clarity
COMMENT ON COLUMN public.order_transport_assignments.trip_status IS 'Trip status: gepland, onderweg, geladen, geleverd, opgehaald, retour, afgerond';

-- Enable realtime for assignments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_transport_assignments;
