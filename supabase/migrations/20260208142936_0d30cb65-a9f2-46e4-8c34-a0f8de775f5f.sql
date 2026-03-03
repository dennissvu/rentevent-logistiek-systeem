
-- Tabel voor chauffeur dagroutes (één route per chauffeur per dag)
CREATE TABLE public.driver_day_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  route_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'concept', -- concept, bevestigd, onderweg, afgerond
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id, route_date)
);

-- Enable RLS
ALTER TABLE public.driver_day_routes ENABLE ROW LEVEL SECURITY;

-- RLS policies (geen auth in dit project)
CREATE POLICY "Driver day routes viewable by everyone" ON public.driver_day_routes FOR SELECT USING (true);
CREATE POLICY "Driver day routes can be created" ON public.driver_day_routes FOR INSERT WITH CHECK (true);
CREATE POLICY "Driver day routes can be updated" ON public.driver_day_routes FOR UPDATE USING (true);
CREATE POLICY "Driver day routes can be deleted" ON public.driver_day_routes FOR DELETE USING (true);

-- Tabel voor geordende stops in een dagroute
CREATE TABLE public.driver_day_route_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.driver_day_routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  assignment_id UUID REFERENCES public.order_transport_assignments(id) ON DELETE SET NULL,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  stop_type TEXT NOT NULL, -- 'laden_winkel', 'aankoppelen_loods', 'leveren', 'ophalen', 'lossen_winkel', 'afkoppelen_loods'
  location_address TEXT,
  estimated_arrival TEXT, -- HH:MM
  estimated_departure TEXT, -- HH:MM
  drive_time_from_previous INTEGER, -- minuten vanaf vorige stop
  load_unload_minutes INTEGER, -- geschatte laad/lostijd bij deze stop
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_day_route_stops ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Route stops viewable by everyone" ON public.driver_day_route_stops FOR SELECT USING (true);
CREATE POLICY "Route stops can be created" ON public.driver_day_route_stops FOR INSERT WITH CHECK (true);
CREATE POLICY "Route stops can be updated" ON public.driver_day_route_stops FOR UPDATE USING (true);
CREATE POLICY "Route stops can be deleted" ON public.driver_day_route_stops FOR DELETE USING (true);

-- Triggers voor automatische updated_at
CREATE TRIGGER update_driver_day_routes_updated_at
  BEFORE UPDATE ON public.driver_day_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_day_route_stops_updated_at
  BEFORE UPDATE ON public.driver_day_route_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime voor live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_day_routes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_day_route_stops;
