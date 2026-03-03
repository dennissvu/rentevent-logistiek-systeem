-- 401 was caused by: permission denied for table orders (PostgreSQL 42501).
-- PostgREST uses roles anon and authenticated; they need explicit GRANTs on tables.

-- Bestaande tabellen in public: lees/schrijf voor anon en authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_materials TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_combis TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_transport_assignments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_load_unload_instructions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_day_routes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_day_route_stops TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_weekly_schedules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_schedule_exceptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_signatures TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_memory TO anon, authenticated;

-- Tabel transport_current_load indien aanwezig (migratie 20260303130000)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transport_current_load') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_current_load TO anon, authenticated';
  END IF;
END $$;

-- Sequences (voor DEFAULT gen_random_uuid() of serial) – vaak niet nodig voor uuid, maar veilig
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Toekomstige tabellen: standaard rechten voor anon/authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
