-- Allow utility stops (winkel/loods/wachttijd) without an order reference
ALTER TABLE public.driver_day_route_stops
  ALTER COLUMN order_id DROP NOT NULL;
