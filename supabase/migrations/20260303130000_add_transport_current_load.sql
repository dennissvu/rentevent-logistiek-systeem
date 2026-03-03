-- Tabel voor huidige lading op transport (welk materiaal is waar geladen)
-- Stond in types maar ontbrak in migraties
CREATE TABLE IF NOT EXISTS public.transport_current_load (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transport_material_id UUID NOT NULL REFERENCES public.transport_materials(id) ON DELETE CASCADE,
  source_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  source_assignment_id UUID REFERENCES public.order_transport_assignments(id) ON DELETE SET NULL,
  vehicle_type TEXT NOT NULL,
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  loaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transport_current_load ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transport current load viewable by everyone"
  ON public.transport_current_load FOR SELECT USING (true);
CREATE POLICY "Transport current load can be created"
  ON public.transport_current_load FOR INSERT WITH CHECK (true);
CREATE POLICY "Transport current load can be updated"
  ON public.transport_current_load FOR UPDATE USING (true);
CREATE POLICY "Transport current load can be deleted"
  ON public.transport_current_load FOR DELETE USING (true);

CREATE TRIGGER update_transport_current_load_updated_at
  BEFORE UPDATE ON public.transport_current_load
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_transport_current_load_material
  ON public.transport_current_load(transport_material_id);
CREATE INDEX IF NOT EXISTS idx_transport_current_load_order
  ON public.transport_current_load(source_order_id);
