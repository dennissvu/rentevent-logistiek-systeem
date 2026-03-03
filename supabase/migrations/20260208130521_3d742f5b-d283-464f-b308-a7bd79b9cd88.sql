-- Add column to track vehicles that stay loaded on transport for next trip
ALTER TABLE public.order_load_unload_instructions
ADD COLUMN stay_loaded_count integer NOT NULL DEFAULT 0;