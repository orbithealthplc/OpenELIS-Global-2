-- AHRI Biorepository storage seed (rooms/zones + devices)
-- INTERNAL: review before running on production.
--
-- What it seeds (Biorepository only):
-- - Physical room 1 (Minus 20 Freezer Room): zone BIO-M20 "Main Storage"
-- - Physical room 2 (Ultra Low Freezer Room): Reception + Zone 1..6
-- - Devices:
--    -40 × -20°C freezers (under BIO-M20)
--    -37 × -80°C freezers (across Zone 1..6)
--     -5 × -150°C freezers (Zone 6)
--     -5 × LN2 tanks (Zone 6)
--
-- Notes:
-- - DB top level is still `storage_room` (UI label = Zone).
-- - Physical Room is selected in UI, then Zone is filtered.
-- - Shelves/racks/boxes are configured later per freezer.
--
-- Safe to re-run: guarded by room `code` pre-checks.

BEGIN;

-- 1) Resolve Biorepository department + abort if already seeded
DO $$
DECLARE
  v_dept_id INTEGER;
BEGIN
  SELECT id INTO v_dept_id
  FROM clinlims.test_section
  WHERE lower(trim(name)) = 'biorepository laboratory'
  LIMIT 1;

  IF v_dept_id IS NULL THEN
    RAISE EXCEPTION 'Biorepository Laboratory test_section not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM clinlims.storage_room
    WHERE code IN ('BIO-M20', 'BIO-REC', 'BIO-ZN1', 'BIO-ZN2', 'BIO-ZN3', 'BIO-ZN4', 'BIO-ZN5', 'BIO-ZN6')
  ) THEN
    RAISE EXCEPTION 'Biorepository rooms already seeded (BIO-*)';
  END IF;
END $$;

-- 3) Insert rooms (treated as zones in UI)
WITH biorep AS (
  SELECT id AS dept_id
  FROM clinlims.test_section
  WHERE lower(trim(name)) = 'biorepository laboratory'
  LIMIT 1
)
INSERT INTO clinlims.storage_room (id, fhir_uuid, name, code, description, active, department_test_section_id, sys_user_id, last_updated)
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Main Storage', 'BIO-M20',
       'Single storage area inside Minus 20 Freezer Room (physical room 1).', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP
FROM biorep;

WITH biorep AS (
  SELECT id AS dept_id
  FROM clinlims.test_section
  WHERE lower(trim(name)) = 'biorepository laboratory'
  LIMIT 1
)
INSERT INTO clinlims.storage_room (id, fhir_uuid, name, code, description, active, department_test_section_id, sys_user_id, last_updated)
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Reception', 'BIO-REC',
       'Reception area inside Ultra Low Freezer Room (physical room 2).', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP
FROM biorep;

WITH biorep AS (
  SELECT id AS dept_id
  FROM clinlims.test_section
  WHERE lower(trim(name)) = 'biorepository laboratory'
  LIMIT 1
)
INSERT INTO clinlims.storage_room (id, fhir_uuid, name, code, description, active, department_test_section_id, sys_user_id, last_updated)
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Zone 1', 'BIO-ZN1', 'Ultra-low storage Zone 1', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP FROM biorep
UNION ALL
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Zone 2', 'BIO-ZN2', 'Ultra-low storage Zone 2', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP FROM biorep
UNION ALL
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Zone 3', 'BIO-ZN3', 'Ultra-low storage Zone 3', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP FROM biorep
UNION ALL
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Zone 4', 'BIO-ZN4', 'Ultra-low storage Zone 4', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP FROM biorep
UNION ALL
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Zone 5', 'BIO-ZN5', 'Ultra-low storage Zone 5', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP FROM biorep
UNION ALL
SELECT nextval('clinlims.storage_room_seq'), gen_random_uuid(), 'Zone 6', 'BIO-ZN6', 'Ultra-low storage Zone 6', TRUE, biorep.dept_id, 1, CURRENT_TIMESTAMP FROM biorep;

-- 4) Insert devices
-- Helper: get a room id by code
-- -20°C freezers: 40 (place in BIO-M20)
INSERT INTO clinlims.storage_device (
  id, fhir_uuid, name, code, type, temperature_setting, capacity_limit, active, biorepository_storage,
  parent_room_id, sys_user_id, last_updated
)
SELECT
  nextval('clinlims.storage_device_seq'),
  gen_random_uuid(),
  format('FRZ %s', gs.i),
  'M20-FRZ' || lpad(gs.i::text, 2, '0'),
  'freezer',
  -20.0,
  NULL,
  TRUE,
  TRUE,
  (SELECT id FROM clinlims.storage_room WHERE code='BIO-M20'),
  1,
  CURRENT_TIMESTAMP
FROM generate_series(1, 40) AS gs(i);

-- Ultra-low freezers (-80°C): 37, distribute across zones 1..6 (6,6,6,6,6,7)
WITH zone_counts AS (
  SELECT * FROM (VALUES
    ('BIO-ZN1', 6),
    ('BIO-ZN2', 6),
    ('BIO-ZN3', 6),
    ('BIO-ZN4', 6),
    ('BIO-ZN5', 6),
    ('BIO-ZN6', 7)
  ) AS t(zone_code, cnt)
),
expanded AS (
  SELECT zone_code, generate_series(1, cnt) AS idx
  FROM zone_counts
),
numbered AS (
  SELECT zone_code, idx,
         row_number() OVER (ORDER BY zone_code, idx) AS n
  FROM expanded
)
INSERT INTO clinlims.storage_device (
  id, fhir_uuid, name, code, type, temperature_setting, capacity_limit, active, biorepository_storage,
  parent_room_id, sys_user_id, last_updated
)
SELECT
  nextval('clinlims.storage_device_seq'),
  gen_random_uuid(),
  format('FRZ %s', n),
  'UL80-FRZ' || lpad(n::text, 2, '0'),
  'freezer',
  -80.0,
  NULL,
  TRUE,
  TRUE,
  (SELECT id FROM clinlims.storage_room WHERE code = zone_code),
  1,
  CURRENT_TIMESTAMP
FROM numbered;

-- Ultra-low (-150°C) freezers: 5 (place in Zone 6 by default)
INSERT INTO clinlims.storage_device (
  id, fhir_uuid, name, code, type, temperature_setting, capacity_limit, active, biorepository_storage,
  parent_room_id, sys_user_id, last_updated
)
SELECT
  nextval('clinlims.storage_device_seq'),
  gen_random_uuid(),
  format('FRZ -150 %s', gs.i),
  'UL150-FRZ' || lpad(gs.i::text, 2, '0'),
  'freezer',
  -150.0,
  NULL,
  TRUE,
  TRUE,
  (SELECT id FROM clinlims.storage_room WHERE code='BIO-ZN6'),
  1,
  CURRENT_TIMESTAMP
FROM generate_series(1, 5) AS gs(i);

-- Liquid Nitrogen tanks (2000L): 5 (place in Zone 6 by default)
INSERT INTO clinlims.storage_device (
  id, fhir_uuid, name, code, type, temperature_setting, capacity_limit, active, biorepository_storage,
  parent_room_id, sys_user_id, last_updated
)
SELECT
  nextval('clinlims.storage_device_seq'),
  gen_random_uuid(),
  format('LN2 Tank %s', gs.i),
  'LN2-' || lpad(gs.i::text, 2, '0'),
  'other',
  NULL,
  NULL,
  TRUE,
  TRUE,
  (SELECT id FROM clinlims.storage_room WHERE code='BIO-ZN6'),
  1,
  CURRENT_TIMESTAMP
FROM generate_series(1, 5) AS gs(i);

COMMIT;

