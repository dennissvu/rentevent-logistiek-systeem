-- Add delivery/pickup time window fields to orders
-- These represent the customer's flexibility: when we ARE ALLOWED to deliver/pickup
-- The existing delivery_time/pickup_time remain the ACTUAL scheduled time within the window

ALTER TABLE public.orders 
  ADD COLUMN delivery_window_start time without time zone DEFAULT NULL,
  ADD COLUMN delivery_window_end time without time zone DEFAULT NULL,
  ADD COLUMN pickup_window_start time without time zone DEFAULT NULL,
  ADD COLUMN pickup_window_end time without time zone DEFAULT NULL;