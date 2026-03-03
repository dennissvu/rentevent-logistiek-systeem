-- Add reseed_logistics_data RPC
CREATE OR REPLACE FUNCTION public.reseed_logistics_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  full_sql text := $SEED$
-- ============================================================================
-- SEED DATA: Rent Event Logistiek Systeem
-- Testdata met complexe orders die meerdere chauffeurs/transporten vereisen
-- ============================================================================

-- Eerst bestaande testdata opruimen (in juiste volgorde vanwege foreign keys)
DELETE FROM order_load_unload_instructions;
DELETE FROM driver_day_route_stops;
DELETE FROM driver_day_routes;
DELETE FROM order_transport_assignments;
DELETE FROM order_signatures;
DELETE FROM driver_schedule_exceptions;
DELETE FROM driver_weekly_schedules;
DELETE FROM orders;
DELETE FROM transport_combis;
DELETE FROM transport_materials;
DELETE FROM drivers;
DELETE FROM planning_memory;

-- ============================================================================
-- TRANSPORT MATERIALEN
-- ============================================================================

-- Bakwagens
INSERT INTO transport_materials (id, code, name, type, capacity_choppers, capacity_fatbikes, capacity_bikes, capacity_tweepers, capacity_fietsen, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'BW-01', 'Bakwagen 1 (Groot)', 'bakwagen', 8, 12, 20, 6, 24, true),
  ('a1000000-0000-0000-0000-000000000002', 'BW-02', 'Bakwagen 2 (Groot)', 'bakwagen', 8, 12, 20, 6, 24, true),
  ('a1000000-0000-0000-0000-000000000003', 'BW-03', 'Bakwagen 3 (Klein)', 'bakwagen', 4, 6, 10, 3, 12, true),
  ('a1000000-0000-0000-0000-000000000004', 'BW-04', 'Bakwagen 4 (Klein)', 'bakwagen', 4, 6, 10, 3, 12, true);

-- Aanhangers
INSERT INTO transport_materials (id, code, name, type, capacity_choppers, capacity_fatbikes, capacity_bikes, capacity_tweepers, capacity_fietsen, is_active) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'AH-01', 'Aanhanger 1 (Groot)', 'aanhanger', 6, 8, 14, 4, 16, true),
  ('a2000000-0000-0000-0000-000000000002', 'AH-02', 'Aanhanger 2 (Groot)', 'aanhanger', 6, 8, 14, 4, 16, true),
  ('a2000000-0000-0000-0000-000000000003', 'AH-03', 'Aanhanger 3 (Klein)', 'aanhanger', 3, 4, 8, 2, 10, true);

-- ============================================================================
-- TRANSPORT COMBIS
-- ============================================================================

INSERT INTO transport_combis (id, code, name, bakwagen_id, aanhanger_id, capacity_choppers, capacity_fatbikes, capacity_bikes, capacity_tweepers, capacity_fietsen, is_active) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'COMBI-01', 'Combi 1 (BW1 + AH1)', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 14, 20, 34, 10, 40, true),
  ('b1000000-0000-0000-0000-000000000002', 'COMBI-02', 'Combi 2 (BW2 + AH2)', 'a1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 14, 20, 34, 10, 40, true),
  ('b1000000-0000-0000-0000-000000000003', 'COMBI-03', 'Combi 3 (BW3 + AH3)', 'a1000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003', 7, 10, 18, 5, 22, true);

-- ============================================================================
-- CHAUFFEURS
-- ============================================================================

INSERT INTO drivers (id, name, phone, can_drive_trailer, is_available, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Jan de Vries',     '06-12345001', true,  true, true),
  ('c1000000-0000-0000-0000-000000000002', 'Pieter Bakker',    '06-12345002', true,  true, true),
  ('c1000000-0000-0000-0000-000000000003', 'Klaas Jansen',     '06-12345003', true,  true, true),
  ('c1000000-0000-0000-0000-000000000004', 'Willem de Boer',   '06-12345004', false, true, true),
  ('c1000000-0000-0000-0000-000000000005', 'Henk Mulder',      '06-12345005', false, true, true),
  ('c1000000-0000-0000-0000-000000000006', 'Dirk van Dijk',    '06-12345006', true,  true, true),
  ('c1000000-0000-0000-0000-000000000007', 'Dennis',           '06-12345007', true,  true, true);

-- ============================================================================
-- CHAUFFEUR WEEKROOSTERS
-- ============================================================================

-- Jan de Vries: ma-vr 07:00-17:00
INSERT INTO driver_weekly_schedules (driver_id, day_of_week, is_working, start_time_1, end_time_1) VALUES
  ('c1000000-0000-0000-0000-000000000001', 0, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000001', 1, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000001', 2, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000001', 3, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000001', 4, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000001', 5, false, NULL, NULL),
  ('c1000000-0000-0000-0000-000000000001', 6, false, NULL, NULL);

-- Pieter Bakker: ma-za 06:30-16:30
INSERT INTO driver_weekly_schedules (driver_id, day_of_week, is_working, start_time_1, end_time_1) VALUES
  ('c1000000-0000-0000-0000-000000000002', 0, true, '06:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000002', 1, true, '06:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000002', 2, true, '06:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000002', 3, true, '06:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000002', 4, true, '06:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000002', 5, true, '07:00', '13:00'),
  ('c1000000-0000-0000-0000-000000000002', 6, false, NULL, NULL);

-- Klaas Jansen: ma-vr 07:00-16:00
INSERT INTO driver_weekly_schedules (driver_id, day_of_week, is_working, start_time_1, end_time_1) VALUES
  ('c1000000-0000-0000-0000-000000000003', 0, true, '07:00', '16:00'),
  ('c1000000-0000-0000-0000-000000000003', 1, true, '07:00', '16:00'),
  ('c1000000-0000-0000-0000-000000000003', 2, true, '07:00', '16:00'),
  ('c1000000-0000-0000-0000-000000000003', 3, true, '07:00', '16:00'),
  ('c1000000-0000-0000-0000-000000000003', 4, true, '07:00', '16:00'),
  ('c1000000-0000-0000-0000-000000000003', 5, false, NULL, NULL),
  ('c1000000-0000-0000-0000-000000000003', 6, false, NULL, NULL);

-- Willem de Boer: ma-do 08:00-17:00 (geen aanhanger)
INSERT INTO driver_weekly_schedules (driver_id, day_of_week, is_working, start_time_1, end_time_1) VALUES
  ('c1000000-0000-0000-0000-000000000004', 0, true, '08:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000004', 1, true, '08:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000004', 2, true, '08:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000004', 3, true, '08:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000004', 4, false, NULL, NULL),
  ('c1000000-0000-0000-0000-000000000004', 5, false, NULL, NULL),
  ('c1000000-0000-0000-0000-000000000004', 6, false, NULL, NULL);

-- Henk Mulder: di-za 07:30-16:30 (geen aanhanger)
INSERT INTO driver_weekly_schedules (driver_id, day_of_week, is_working, start_time_1, end_time_1) VALUES
  ('c1000000-0000-0000-0000-000000000005', 0, false, NULL, NULL),
  ('c1000000-0000-0000-0000-000000000005', 1, true, '07:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000005', 2, true, '07:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000005', 3, true, '07:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000005', 4, true, '07:30', '16:30'),
  ('c1000000-0000-0000-0000-000000000005', 5, true, '08:00', '14:00'),
  ('c1000000-0000-0000-0000-000000000005', 6, false, NULL, NULL);

-- Dirk van Dijk: ma-vr 07:00-17:00 (split shift op woensdag)
INSERT INTO driver_weekly_schedules (driver_id, day_of_week, is_working, start_time_1, end_time_1, start_time_2, end_time_2) VALUES
  ('c1000000-0000-0000-0000-000000000006', 0, true, '07:00', '17:00', NULL, NULL),
  ('c1000000-0000-0000-0000-000000000006', 1, true, '07:00', '17:00', NULL, NULL),
  ('c1000000-0000-0000-0000-000000000006', 2, true, '07:00', '12:00', '14:00', '18:00'),
  ('c1000000-0000-0000-0000-000000000006', 3, true, '07:00', '17:00', NULL, NULL),
  ('c1000000-0000-0000-0000-000000000006', 4, true, '07:00', '17:00', NULL, NULL),
  ('c1000000-0000-0000-0000-000000000006', 5, false, NULL, NULL, NULL, NULL),
  ('c1000000-0000-0000-0000-000000000006', 6, false, NULL, NULL, NULL, NULL);

-- Dennis: ma-vr 07:00-17:00
INSERT INTO driver_weekly_schedules (driver_id, day_of_week, is_working, start_time_1, end_time_1) VALUES
  ('c1000000-0000-0000-0000-000000000007', 0, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000007', 1, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000007', 2, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000007', 3, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000007', 4, true, '07:00', '17:00'),
  ('c1000000-0000-0000-0000-000000000007', 5, false, NULL, NULL),
  ('c1000000-0000-0000-0000-000000000007', 6, false, NULL, NULL);

-- ============================================================================
-- ORDER 1: Groot Bedrijfsevenement - 80 choppers + 40 fatbikes
-- Vereist: minimaal 3 transporten voor levering (totale capaciteit nodig)
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop, combined_unloading_leveren, combined_unloading_ophalen)
VALUES (
  'd1000000-0000-0000-0000-000000000001',
  'ORD-2026-0001',
  'Sophie', 'van den Berg',
  'sophie@eventcorp.nl', '06-98765001',
  'EventCorp Nederland B.V.',
  120,
  '2026-03-14', '2026-03-14',
  '10:00', '17:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'RAI Amsterdam, Europaplein 24, Amsterdam',
  'Groot bedrijfsevenement. Fietsen moeten om 09:00 klaarstaan. Ingang via leveranciersdock Zuid. Contactpersoon ter plekke: Mark Hendriks (06-11223344).',
  '[{"type": "choppers", "count": 80}, {"type": "fatbikes", "count": 40}]'::jsonb,
  'bevestigd',
  '2026-03-14', '07:00', '06:30', '08:00',
  '2026-03-14', '17:30', '17:00', '18:30',
  true, true, false
);

-- Toewijzingen voor Order 1 - LEVEREN (3 transporten nodig)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'leveren', 'COMBI-01', 'c1000000-0000-0000-0000-000000000001', 1, 'gepland'),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'leveren', 'COMBI-02', 'c1000000-0000-0000-0000-000000000002', 2, 'gepland'),
  ('e1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'leveren', 'BW-03',    'c1000000-0000-0000-0000-000000000004', 3, 'gepland');

-- Toewijzingen voor Order 1 - OPHALEN (3 transporten nodig)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'ophalen', 'COMBI-01', 'c1000000-0000-0000-0000-000000000001', 1, 'gepland'),
  ('e1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'ophalen', 'COMBI-02', 'c1000000-0000-0000-0000-000000000003', 2, 'gepland'),
  ('e1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000001', 'ophalen', 'BW-03',    'c1000000-0000-0000-0000-000000000005', 3, 'gepland');

-- Laad/los instructies Order 1 - LEVEREN
INSERT INTO order_load_unload_instructions (order_id, assignment_id, action, vehicle_type, vehicle_count, location, sequence_number, helper_count, helper_driver_ids) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'laden',  'choppers',  28, 'winkel', 1, 1, '["c1000000-0000-0000-0000-000000000004"]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'laden',  'fatbikes',  14, 'winkel', 2, 0, '[]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'lossen', 'choppers',  28, 'klant',  3, 1, '["c1000000-0000-0000-0000-000000000004"]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'lossen', 'fatbikes',  14, 'klant',  4, 0, '[]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'laden',  'choppers',  28, 'winkel', 1, 1, '["c1000000-0000-0000-0000-000000000005"]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'laden',  'fatbikes',  14, 'winkel', 2, 0, '[]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'lossen', 'choppers',  28, 'klant',  3, 1, '["c1000000-0000-0000-0000-000000000005"]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'lossen', 'fatbikes',  14, 'klant',  4, 0, '[]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 'laden',  'choppers',  24, 'winkel', 1, 0, '[]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 'laden',  'fatbikes',  12, 'winkel', 2, 0, '[]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 'lossen', 'choppers',  24, 'klant',  3, 0, '[]'::jsonb),
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 'lossen', 'fatbikes',  12, 'klant',  4, 0, '[]'::jsonb);


-- ============================================================================
-- ORDER 2: Festival Meerdaags - 50 fatbikes + 30 tweepers + 20 fietsen
-- Vereist: 2 combi-transporten, levering dag 1, ophalen dag 3
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop, combined_unloading_leveren, combined_unloading_ophalen)
VALUES (
  'd1000000-0000-0000-0000-000000000002',
  'ORD-2026-0002',
  'Thomas', 'Groen',
  'thomas@festivalgroep.nl', '06-98765002',
  'Festival Groep B.V.',
  100,
  '2026-03-20', '2026-03-22',
  '12:00', '23:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Westerpark, Haarlemmerweg 8-10, Amsterdam',
  'Festival over 3 dagen. Fietsen moeten vr ochtend staan, ophalen zo avond. Terrein alleen toegankelijk via noordingang. Ondergrond is gras - voorzichtig met zwaar materieel.',
  '[{"type": "fatbikes", "count": 50}, {"type": "tweepers", "count": 30}, {"type": "fietsen", "count": 20}]'::jsonb,
  'bevestigd',
  '2026-03-20', '08:00', '07:30', '09:00',
  '2026-03-22', '23:30', '23:00', '00:30',
  false, false, true
);

-- Toewijzingen voor Order 2 - LEVEREN (2 combi-transporten)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'leveren', 'COMBI-01', 'c1000000-0000-0000-0000-000000000001', 1, 'gepland'),
  ('e2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'leveren', 'COMBI-02', 'c1000000-0000-0000-0000-000000000006', 2, 'gepland');

-- Toewijzingen voor Order 2 - OPHALEN (2 combi-transporten, andere dag)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'ophalen', 'COMBI-01', 'c1000000-0000-0000-0000-000000000002', 1, 'gepland'),
  ('e2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'ophalen', 'COMBI-03', 'c1000000-0000-0000-0000-000000000003', 2, 'gepland');

-- Laad/los instructies Order 2 - LEVEREN
INSERT INTO order_load_unload_instructions (order_id, assignment_id, action, vehicle_type, vehicle_count, location, sequence_number, helper_count) VALUES
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'laden',  'fatbikes', 25, 'winkel', 1, 1),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'laden',  'tweepers', 15, 'winkel', 2, 0),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'lossen', 'fatbikes', 25, 'klant',  3, 1),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'lossen', 'tweepers', 15, 'klant',  4, 0),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'laden',  'fatbikes', 25, 'winkel', 1, 1),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'laden',  'tweepers', 15, 'winkel', 2, 0),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'laden',  'fietsen',  20, 'winkel', 3, 0),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'lossen', 'fatbikes', 25, 'klant',  4, 1),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'lossen', 'tweepers', 15, 'klant',  5, 0),
  ('d1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'lossen', 'fietsen',  20, 'klant',  6, 0);


-- ============================================================================
-- ORDER 3: Bruiloft met meerdere locaties - 25 choppers + 15 fatbikes
-- Vereist: 2 transporten, split delivery (kerk + feestlocatie)
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop, combined_unloading_leveren, combined_unloading_ophalen)
VALUES (
  'd1000000-0000-0000-0000-000000000003',
  'ORD-2026-0003',
  'Lisa', 'de Wit',
  'lisa.dewit@gmail.com', '06-98765003',
  NULL,
  40,
  '2026-03-14', '2026-03-15',
  '14:00', '02:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Kasteel de Haar, Kasteellaan 1, Utrecht',
  'Bruiloft Lisa & Marco. 10 choppers bij de kerk (Domkerk Utrecht), rest naar kasteel. Kerk: levering voor 13:00. Kasteel: levering voor 15:00. Ophalen alles vanuit kasteel op zondag.',
  '[{"type": "choppers", "count": 25}, {"type": "fatbikes", "count": 15}]'::jsonb,
  'bevestigd',
  '2026-03-14', '11:00', '10:30', '12:00',
  '2026-03-15', '11:00', '10:00', '12:00',
  true, false, true
);

-- Toewijzingen Order 3 - LEVEREN (2 transporten: 1 naar kerk, 1 naar kasteel)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003', 'leveren', 'BW-03',    'c1000000-0000-0000-0000-000000000004', 1, 'gepland'),
  ('e3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003', 'leveren', 'COMBI-03', 'c1000000-0000-0000-0000-000000000003', 2, 'gepland');

-- Toewijzingen Order 3 - OPHALEN (1 combi-transport vanuit kasteel)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', 'ophalen', 'COMBI-01', 'c1000000-0000-0000-0000-000000000006', 1, 'gepland');

-- Laad/los instructies Order 3 - LEVEREN
INSERT INTO order_load_unload_instructions (order_id, assignment_id, action, vehicle_type, vehicle_count, location, sequence_number, helper_count, notes) VALUES
  ('d1000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000001', 'laden',  'choppers',  10, 'winkel', 1, 0, 'Choppers voor de kerk'),
  ('d1000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000001', 'lossen', 'choppers',  10, 'klant',  2, 0, 'Afleveren bij Domkerk Utrecht, Domplein'),
  ('d1000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000002', 'laden',  'choppers',  15, 'winkel', 1, 0, 'Choppers + fatbikes voor kasteel'),
  ('d1000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000002', 'laden',  'fatbikes',  15, 'winkel', 2, 0, NULL),
  ('d1000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000002', 'lossen', 'choppers',  15, 'klant',  3, 1, 'Kasteel de Haar - oprijlaan gebruiken'),
  ('d1000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000002', 'lossen', 'fatbikes',  15, 'klant',  4, 1, NULL);


-- ============================================================================
-- ORDER 4: Corporate Teambuilding - 60 fietsen + 20 tweepers
-- Vereist: 2 transporten, dezelfde dag leveren en ophalen
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop, combined_unloading_leveren, combined_unloading_ophalen)
VALUES (
  'd1000000-0000-0000-0000-000000000004',
  'ORD-2026-0004',
  'Robert', 'Vermeer',
  'r.vermeer@techbedrijf.nl', '06-98765004',
  'TechBedrijf Solutions',
  80,
  '2026-03-18', '2026-03-18',
  '09:00', '16:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Vondelpark Pavilion, Vondelpark 3, Amsterdam',
  'Teambuilding dag. Fietsen moeten om 08:30 klaarstaan bij paviljoen. Ophalen direct na afloop 16:00. Nummerbordjes per fiets gewenst (1 t/m 80).',
  '[{"type": "fietsen", "count": 60}, {"type": "tweepers", "count": 20}]'::jsonb,
  'bevestigd',
  '2026-03-18', '07:30', '07:00', '08:15',
  '2026-03-18', '16:15', '16:00', '17:00',
  true, true, true
);

-- Toewijzingen Order 4 - LEVEREN (2 bakwagens)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004', 'leveren', 'BW-01', 'c1000000-0000-0000-0000-000000000001', 1, 'gepland'),
  ('e4000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004', 'leveren', 'BW-02', 'c1000000-0000-0000-0000-000000000002', 2, 'gepland');

-- Toewijzingen Order 4 - OPHALEN (2 bakwagens)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e4000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000004', 'ophalen', 'BW-01', 'c1000000-0000-0000-0000-000000000005', 1, 'gepland'),
  ('e4000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004', 'ophalen', 'BW-02', 'c1000000-0000-0000-0000-000000000006', 2, 'gepland');

-- Laad/los instructies Order 4 - LEVEREN
INSERT INTO order_load_unload_instructions (order_id, assignment_id, action, vehicle_type, vehicle_count, location, sequence_number, helper_count) VALUES
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000001', 'laden',  'fietsen',  24, 'winkel', 1, 0),
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000001', 'laden',  'tweepers', 6,  'winkel', 2, 0),
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000001', 'lossen', 'fietsen',  24, 'klant',  3, 1),
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000001', 'lossen', 'tweepers', 6,  'klant',  4, 0),
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000002', 'laden',  'fietsen',  36, 'winkel', 1, 1),
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000002', 'laden',  'tweepers', 14, 'winkel', 2, 0),
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000002', 'lossen', 'fietsen',  36, 'klant',  3, 1),
  ('d1000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000002', 'lossen', 'tweepers', 14, 'klant',  4, 0);


-- ============================================================================
-- ORDER 5: Strandfeest - 35 fatbikes + 25 choppers + 10 fietsen
-- Vereist: 2 combi-transporten, moeilijk bereikbare locatie
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop, combined_unloading_leveren, combined_unloading_ophalen)
VALUES (
  'd1000000-0000-0000-0000-000000000005',
  'ORD-2026-0005',
  'Emma', 'Koster',
  'emma@beachevents.nl', '06-98765005',
  'Beach Events',
  70,
  '2026-03-21', '2026-03-21',
  '11:00', '20:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Bloemendaal aan Zee, Zeeweg 70, Bloemendaal',
  'Strandfeest. LET OP: laatste 200m onverhard pad - alleen bakwagens, GEEN aanhangers. Fietsen moeten op verharde parkeerplaats worden overgeladen. Extra laadtijd nodig. 2 helpers ter plekke van klant.',
  '[{"type": "fatbikes", "count": 35}, {"type": "choppers", "count": 25}, {"type": "fietsen", "count": 10}]'::jsonb,
  'bevestigd',
  '2026-03-21', '08:00', '07:30', '09:00',
  '2026-03-21', '20:30', '20:00', '21:30',
  true, false, false
);

-- Toewijzingen Order 5 - LEVEREN (3 transporten: 2 bakwagens + 1 combi die op parkeerplaats moet splitsen)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000005', 'leveren', 'BW-01',    'c1000000-0000-0000-0000-000000000001', 1, 'gepland'),
  ('e5000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000005', 'leveren', 'BW-02',    'c1000000-0000-0000-0000-000000000002', 2, 'gepland'),
  ('e5000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000005', 'leveren', 'BW-03',    'c1000000-0000-0000-0000-000000000005', 3, 'gepland');

-- Toewijzingen Order 5 - OPHALEN (3 bakwagens terug)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e5000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000005', 'ophalen', 'BW-01',    'c1000000-0000-0000-0000-000000000003', 1, 'gepland'),
  ('e5000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000005', 'ophalen', 'BW-02',    'c1000000-0000-0000-0000-000000000006', 2, 'gepland'),
  ('e5000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000005', 'ophalen', 'BW-04',    'c1000000-0000-0000-0000-000000000004', 3, 'gepland');

-- Laad/los instructies Order 5 - LEVEREN
INSERT INTO order_load_unload_instructions (order_id, assignment_id, action, vehicle_type, vehicle_count, location, sequence_number, helper_count, notes, custom_duration_minutes) VALUES
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000001', 'laden',  'fatbikes', 12, 'winkel', 1, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000001', 'laden',  'choppers', 8,  'winkel', 2, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000001', 'lossen', 'fatbikes', 12, 'klant',  3, 0, 'Onverhard pad - extra voorzichtig', 45),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000001', 'lossen', 'choppers', 8,  'klant',  4, 0, NULL, 30),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000002', 'laden',  'fatbikes', 12, 'winkel', 1, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000002', 'laden',  'choppers', 9,  'winkel', 2, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000002', 'lossen', 'fatbikes', 12, 'klant',  3, 0, 'Onverhard pad', 45),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000002', 'lossen', 'choppers', 9,  'klant',  4, 0, NULL, 30),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000003', 'laden',  'fatbikes', 11, 'winkel', 1, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000003', 'laden',  'choppers', 8,  'winkel', 2, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000003', 'laden',  'fietsen',  10, 'winkel', 3, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000003', 'lossen', 'fatbikes', 11, 'klant',  4, 0, 'Parkeerplaats - overladen', 30),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000003', 'lossen', 'choppers', 8,  'klant',  5, 0, NULL, 30),
  ('d1000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000003', 'lossen', 'fietsen',  10, 'klant',  6, 0, NULL, 20);


-- ============================================================================
-- ORDER 6: Kleine privé-bestelling (simpel, 1 transport) - ter vergelijking
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop)
VALUES (
  'd1000000-0000-0000-0000-000000000006',
  'ORD-2026-0006',
  'Anna', 'Pietersen',
  'anna.p@hotmail.com', '06-98765006',
  NULL,
  4,
  '2026-03-15', '2026-03-15',
  '10:00', '17:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Beatrixpark 5, Amsterdam',
  'Verjaardagsfeestje. Graag rode choppers als mogelijk.',
  '[{"type": "choppers", "count": 4}]'::jsonb,
  'bevestigd',
  '2026-03-15', '09:00', '08:30', '09:30',
  '2026-03-15', '17:30', '17:00', '18:00',
  true
);

-- Toewijzingen Order 6 - LEVEREN (1 klein transport)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e6000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000006', 'leveren', 'BW-04', 'c1000000-0000-0000-0000-000000000004', 1, 'gepland');

-- Toewijzingen Order 6 - OPHALEN (1 klein transport)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e6000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000006', 'ophalen', 'BW-04', 'c1000000-0000-0000-0000-000000000004', 1, 'gepland');


-- ============================================================================
-- ORDER 7: Offerte - Groot sportevenement (nog niet bevestigd)
-- 100 fietsen + 50 fatbikes + 20 choppers - zou 4 transporten nodig hebben
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, pickup_date, pickup_time,
  driver_returns_to_shop)
VALUES (
  'd1000000-0000-0000-0000-000000000007',
  'ORD-2026-0007',
  'Bas', 'Hendriks',
  'bas@sportevents.nl', '06-98765007',
  'Sport Events Nederland',
  170,
  '2026-04-05', '2026-04-06',
  '08:00', '18:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Olympisch Stadion, Olympisch Stadion 2, Amsterdam',
  'Marathon evenement. Zeer grote order. Fietsen worden gebruikt als begeleidingsvoertuigen langs het parcours. Ophalen pas op dag 2.',
  '[{"type": "fietsen", "count": 100}, {"type": "fatbikes", "count": 50}, {"type": "choppers", "count": 20}]'::jsonb,
  'offerte',
  '2026-04-05', '06:00',
  '2026-04-06', '19:00',
  false
);


-- ============================================================================
-- ORDER 8: Optie - Dubbele locatie bedrijfsdag
-- 30 choppers + 30 fatbikes, gesplitst over 2 locaties
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop)
VALUES (
  'd1000000-0000-0000-0000-000000000008',
  'ORD-2026-0008',
  'Marieke', 'Bos',
  'marieke.bos@consultancy.nl', '06-98765008',
  'Bos & Partners Consultancy',
  60,
  '2026-03-25', '2026-03-25',
  '09:30', '16:30',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Artis Zoo, Plantage Kerklaan 38-40, Amsterdam',
  'Bedrijfsuitje. 15 choppers + 15 fatbikes naar Artis, 15 choppers + 15 fatbikes naar NEMO. Aparte leveringen! Ophalen alles vanuit Artis (ze fietsen van NEMO naar Artis).',
  '[{"type": "choppers", "count": 30}, {"type": "fatbikes", "count": 30}]'::jsonb,
  'optie',
  '2026-03-25', '08:00', '07:30', '08:30',
  '2026-03-25', '17:00', '16:30', '17:30',
  true
);

-- Toewijzingen Order 8 - LEVEREN (2 transporten naar verschillende locaties)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e8000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000008', 'leveren', 'BW-01', 'c1000000-0000-0000-0000-000000000001', 1, 'gepland'),
  ('e8000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000008', 'leveren', 'BW-02', 'c1000000-0000-0000-0000-000000000003', 2, 'gepland');

-- Toewijzingen Order 8 - OPHALEN (2 transporten vanuit Artis)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e8000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000008', 'ophalen', 'BW-01', 'c1000000-0000-0000-0000-000000000002', 1, 'gepland'),
  ('e8000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000008', 'ophalen', 'BW-02', 'c1000000-0000-0000-0000-000000000006', 2, 'gepland');

-- Laad/los instructies Order 8 - LEVEREN
INSERT INTO order_load_unload_instructions (order_id, assignment_id, action, vehicle_type, vehicle_count, location, sequence_number, helper_count, notes) VALUES
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000001', 'laden',  'choppers', 15, 'winkel', 1, 0, 'Naar Artis'),
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000001', 'laden',  'fatbikes', 15, 'winkel', 2, 0, NULL),
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000001', 'lossen', 'choppers', 15, 'klant',  3, 0, 'Artis - ingang Plantage Kerklaan'),
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000001', 'lossen', 'fatbikes', 15, 'klant',  4, 0, NULL),
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000002', 'laden',  'choppers', 15, 'winkel', 1, 0, 'Naar NEMO'),
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000002', 'laden',  'fatbikes', 15, 'winkel', 2, 0, NULL),
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000002', 'lossen', 'choppers', 15, 'klant',  3, 0, 'NEMO Science Museum - achterzijde'),
  ('d1000000-0000-0000-0000-000000000008', 'e8000000-0000-0000-0000-000000000002', 'lossen', 'fatbikes', 15, 'klant',  4, 0, NULL);


-- ============================================================================
-- ORDER 9: Meerdaags congres - 45 choppers + 20 fatbikes + 35 fietsen
-- Vereist: 3 transporten, levering avond ervoor, ophalen 3 dagen later
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop, combined_unloading_leveren, combined_unloading_ophalen)
VALUES (
  'd1000000-0000-0000-0000-000000000009',
  'ORD-2026-0009',
  'Jeroen', 'van Leeuwen',
  'j.vanleeuwen@congress.nl', '06-98765009',
  'Congress Centre Management',
  100,
  '2026-03-16', '2026-03-18',
  '08:00', '18:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'Beurs van Berlage, Damrak 243, Amsterdam',
  'Internationaal tech-congres. Levering zondag 15 maart avond (dag voor start). Fietsen staan 3 dagen. Ophalen woensdag 18 maart na afloop. Laadruimte via Beursplein, max 30 min parkeren.',
  '[{"type": "choppers", "count": 45}, {"type": "fatbikes", "count": 20}, {"type": "fietsen", "count": 35}]'::jsonb,
  'bevestigd',
  '2026-03-15', '18:00', '17:30', '19:00',
  '2026-03-18', '18:30', '18:00', '19:30',
  true, true, false
);

-- Toewijzingen Order 9 - LEVEREN (3 transporten, avond ervoor)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e9000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000009', 'leveren', 'COMBI-01', 'c1000000-0000-0000-0000-000000000001', 1, 'gepland'),
  ('e9000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000009', 'leveren', 'BW-02',    'c1000000-0000-0000-0000-000000000002', 2, 'gepland'),
  ('e9000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000009', 'leveren', 'BW-03',    'c1000000-0000-0000-0000-000000000005', 3, 'gepland');

-- Toewijzingen Order 9 - OPHALEN (3 transporten)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('e9000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000009', 'ophalen', 'COMBI-02', 'c1000000-0000-0000-0000-000000000003', 1, 'gepland'),
  ('e9000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000009', 'ophalen', 'BW-01',    'c1000000-0000-0000-0000-000000000006', 2, 'gepland'),
  ('e9000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000009', 'ophalen', 'BW-04',    'c1000000-0000-0000-0000-000000000004', 3, 'gepland');


-- ============================================================================
-- ORDER 10: Zelfde dag als Order 1 (14 maart) - Concurrerende planning
-- 20 fatbikes + 10 tweepers
-- Vereist: 2 transporten op een drukke dag
-- ============================================================================

INSERT INTO orders (id, order_number, first_name, last_name, email, phone, company_name,
  number_of_persons, start_date, end_date, start_time, end_time,
  start_location, end_location, notes, vehicle_types, status,
  delivery_date, delivery_time, delivery_window_start, delivery_window_end,
  pickup_date, pickup_time, pickup_window_start, pickup_window_end,
  driver_returns_to_shop, combined_unloading_leveren, combined_unloading_ophalen)
VALUES (
  'd1000000-0000-0000-0000-000000000010',
  'ORD-2026-0010',
  'Fatima', 'El Amrani',
  'fatima@socialclub.nl', '06-98765010',
  'Social Club Amsterdam',
  30,
  '2026-03-14', '2026-03-14',
  '13:00', '19:00',
  'Winkel Hoofdstraat 12, Amsterdam',
  'NDSM-werf, Tt. Neveritaweg 15, Amsterdam-Noord',
  'Buurtfeest NDSM. Zelfde dag als RAI-order! Chauffeurs moeten goed gepland worden. Pont naar Noord kost extra tijd (15 min). Alleen bakwagens (geen aanhanger op pont).',
  '[{"type": "fatbikes", "count": 20}, {"type": "tweepers", "count": 10}]'::jsonb,
  'bevestigd',
  '2026-03-14', '11:00', '10:30', '11:30',
  '2026-03-14', '19:30', '19:00', '20:00',
  true, true, true
);

-- Toewijzingen Order 10 - LEVEREN (2 bakwagens, geen aanhangers vanwege pont)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('ea000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000010', 'leveren', 'BW-04', 'c1000000-0000-0000-0000-000000000005', 1, 'gepland'),
  ('ea000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000010', 'leveren', 'BW-03', 'c1000000-0000-0000-0000-000000000006', 2, 'gepland');

-- Toewijzingen Order 10 - OPHALEN (2 bakwagens)
INSERT INTO order_transport_assignments (id, order_id, segment, transport_id, driver_id, sequence_number, trip_status) VALUES
  ('ea000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000010', 'ophalen', 'BW-04', 'c1000000-0000-0000-0000-000000000005', 1, 'gepland'),
  ('ea000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000010', 'ophalen', 'BW-03', 'c1000000-0000-0000-0000-000000000006', 2, 'gepland');

-- Laad/los instructies Order 10 - LEVEREN
INSERT INTO order_load_unload_instructions (order_id, assignment_id, action, vehicle_type, vehicle_count, location, sequence_number, helper_count, notes, custom_duration_minutes) VALUES
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000001', 'laden',  'fatbikes', 10, 'winkel', 1, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000001', 'laden',  'tweepers', 5,  'winkel', 2, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000001', 'lossen', 'fatbikes', 10, 'klant',  3, 0, 'Pont + 15 min extra', 40),
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000001', 'lossen', 'tweepers', 5,  'klant',  4, 0, NULL, 20),
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000002', 'laden',  'fatbikes', 10, 'winkel', 1, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000002', 'laden',  'tweepers', 5,  'winkel', 2, 0, NULL, NULL),
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000002', 'lossen', 'fatbikes', 10, 'klant',  3, 0, 'Pont + 15 min extra', 40),
  ('d1000000-0000-0000-0000-000000000010', 'ea000000-0000-0000-0000-000000000002', 'lossen', 'tweepers', 5,  'klant',  4, 0, NULL, 20);


-- ============================================================================
-- CHAUFFEUR UITZONDERINGEN
-- ============================================================================

-- Klaas Jansen is ziek op 18 maart (dag van Order 4)
INSERT INTO driver_schedule_exceptions (driver_id, exception_date, exception_type, is_available, notes) VALUES
  ('c1000000-0000-0000-0000-000000000003', '2026-03-18', 'ziek', false, 'Griep'),
  -- Dirk van Dijk heeft vakantie 16-17 maart
  ('c1000000-0000-0000-0000-000000000006', '2026-03-16', 'vakantie', false, 'Lang weekend weg'),
  ('c1000000-0000-0000-0000-000000000006', '2026-03-17', 'vakantie', false, 'Lang weekend weg'),
  -- Henk Mulder werkt aangepast op 21 maart (strandfeest-dag)
  ('c1000000-0000-0000-0000-000000000005', '2026-03-21', 'aangepast', true, 'Halve dag, 06:00-12:00');

UPDATE driver_schedule_exceptions
SET start_time = '06:00', end_time = '12:00'
WHERE driver_id = 'c1000000-0000-0000-0000-000000000005' AND exception_date = '2026-03-21';


-- ============================================================================
-- PLANNING MEMORY
-- ============================================================================

INSERT INTO planning_memory (content, category, is_active) VALUES
  ('Pont naar Amsterdam-Noord kost 15 minuten extra per oversteek. Geen aanhangers toegestaan op de pont.', 'transport', true),
  ('RAI Amsterdam: leveranciersingang is via dock Zuid, Europaplein kant. Melden bij beveiligingspost.', 'locaties', true),
  ('Bloemendaal aan Zee: laatste 200m is onverhard. Alleen bakwagens kunnen hier komen, geen aanhangers.', 'locaties', true),
  ('Jan de Vries en Pieter Bakker zijn het meest ervaren met grote evenementen en combi-transporten.', 'chauffeurs', true),
  ('Bij meer dan 40 fietsen altijd minimaal 1 helper inplannen voor laden/lossen.', 'algemeen', true),
  ('Choppers wegen meer dan gewone fietsen: max 8 choppers per laadbeurt per persoon.', 'transport', true),
  ('Beurs van Berlage: max 30 minuten parkeren bij Beursplein. Snel laden/lossen noodzakelijk.', 'locaties', true);

$SEED$;
  arr text[];
  i int;
  stmt text;
BEGIN
  full_sql := regexp_replace(full_sql, chr(13) || chr(10), chr(10), 'g');
  arr := regexp_split_to_array(full_sql, E';\s*' || chr(10));
  FOR i IN 1..coalesce(array_length(arr, 1), 0) LOOP
    stmt := trim(arr[i]);
    IF length(stmt) > 0 AND left(stmt, 2) <> '--' AND (stmt NOT LIKE '--%') THEN
      BEGIN
        EXECUTE stmt || ';';
      EXCEPTION WHEN undefined_table OR undefined_object THEN
        NULL; /* tabel/object bestaat niet (bv. migratie nog niet gedraaid), overslaan */
      END;
    END IF;
  END LOOP;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.reseed_logistics_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reseed_logistics_data() TO anon;
GRANT EXECUTE ON FUNCTION public.reseed_logistics_data() TO service_role;

-- Zorg dat PostgREST de nieuwe functie ziet (schema cache herladen)
NOTIFY pgrst, 'reload schema';
