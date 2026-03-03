
-- Add helper_driver_ids column to store which specific drivers/employees help with loading/unloading
-- This replaces the generic helper_count with specific driver references
ALTER TABLE public.order_load_unload_instructions
ADD COLUMN helper_driver_ids jsonb DEFAULT '[]'::jsonb;

-- Add a comment for clarity
COMMENT ON COLUMN public.order_load_unload_instructions.helper_driver_ids IS 'Array of driver UUIDs who help with this specific load/unload step';
