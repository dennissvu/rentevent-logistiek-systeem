
-- Add column to specify which sub-transport within a combi (bakwagen or aanhanger ID)
ALTER TABLE public.order_load_unload_instructions
ADD COLUMN target_transport_id TEXT;

-- Comment for clarity
COMMENT ON COLUMN public.order_load_unload_instructions.target_transport_id IS 'For combi assignments: specifies whether this instruction targets the bakwagen or aanhanger part. Stores the specific transport material ID.';
