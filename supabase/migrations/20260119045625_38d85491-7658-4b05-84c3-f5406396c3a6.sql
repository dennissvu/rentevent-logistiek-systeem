-- Transport materials (bakwagens en aanhangers)
CREATE TABLE public.transport_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bakwagen', 'aanhanger')),
  capacity_choppers INTEGER NOT NULL DEFAULT 0,
  capacity_fatbikes INTEGER NOT NULL DEFAULT 0,
  capacity_bikes INTEGER NOT NULL DEFAULT 0,
  capacity_tweepers INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Combi's (bakwagen + aanhanger combinaties)
CREATE TABLE public.transport_combis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bakwagen_id UUID REFERENCES public.transport_materials(id),
  aanhanger_id UUID REFERENCES public.transport_materials(id),
  capacity_choppers INTEGER NOT NULL DEFAULT 0,
  capacity_fatbikes INTEGER NOT NULL DEFAULT 0,
  capacity_bikes INTEGER NOT NULL DEFAULT 0,
  capacity_tweepers INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chauffeurs
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transport_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_combis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (open voor nu, later beperken met auth)
CREATE POLICY "Transport materials viewable by everyone" ON public.transport_materials FOR SELECT USING (true);
CREATE POLICY "Transport materials can be created" ON public.transport_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Transport materials can be updated" ON public.transport_materials FOR UPDATE USING (true);
CREATE POLICY "Transport materials can be deleted" ON public.transport_materials FOR DELETE USING (true);

CREATE POLICY "Transport combis viewable by everyone" ON public.transport_combis FOR SELECT USING (true);
CREATE POLICY "Transport combis can be created" ON public.transport_combis FOR INSERT WITH CHECK (true);
CREATE POLICY "Transport combis can be updated" ON public.transport_combis FOR UPDATE USING (true);
CREATE POLICY "Transport combis can be deleted" ON public.transport_combis FOR DELETE USING (true);

CREATE POLICY "Drivers viewable by everyone" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Drivers can be created" ON public.drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Drivers can be updated" ON public.drivers FOR UPDATE USING (true);
CREATE POLICY "Drivers can be deleted" ON public.drivers FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_transport_materials_updated_at
BEFORE UPDATE ON public.transport_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transport_combis_updated_at
BEFORE UPDATE ON public.transport_combis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_transport_materials_type ON public.transport_materials(type);
CREATE INDEX idx_transport_materials_active ON public.transport_materials(is_active);
CREATE INDEX idx_drivers_active ON public.drivers(is_active);