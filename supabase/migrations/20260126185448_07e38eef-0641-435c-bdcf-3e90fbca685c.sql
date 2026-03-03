-- Voeg capacity_fietsen kolom toe aan transport_materials
ALTER TABLE public.transport_materials 
ADD COLUMN capacity_fietsen integer NOT NULL DEFAULT 0;

-- Voeg capacity_fietsen kolom toe aan transport_combis
ALTER TABLE public.transport_combis 
ADD COLUMN capacity_fietsen integer NOT NULL DEFAULT 0;