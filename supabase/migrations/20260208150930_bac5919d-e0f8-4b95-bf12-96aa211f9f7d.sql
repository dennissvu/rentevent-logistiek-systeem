
-- Add logistic planning fields to orders
-- These override the booking dates/times for actual delivery and pickup scheduling
-- When NULL, the system falls back to start_date/start_time and end_date/end_time

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_time time without time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pickup_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pickup_time time without time zone DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.orders.delivery_date IS 'Logistic delivery date. Falls back to start_date when NULL.';
COMMENT ON COLUMN public.orders.delivery_time IS 'Logistic delivery time. Falls back to start_time when NULL.';
COMMENT ON COLUMN public.orders.pickup_date IS 'Logistic pickup date. Falls back to end_date when NULL.';
COMMENT ON COLUMN public.orders.pickup_time IS 'Logistic pickup time. Falls back to end_time when NULL.';
