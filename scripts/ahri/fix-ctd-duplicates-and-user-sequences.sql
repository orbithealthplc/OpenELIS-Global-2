-- AHRI production: keep one CTD lab unit (id 184) and repair user-create sequences.
-- Safe to re-run: deactivates only duplicate CTD test_section rows; sequences set to MAX(id).

BEGIN;

-- Preview (informational)
SELECT id, name, description, is_active
FROM clinlims.test_section
WHERE name = 'CTD'
ORDER BY id;

-- Deactivate duplicate CTD lab units; canonical CTD is id 184 (ctd super-user + CTD staff).
UPDATE clinlims.test_section
SET is_active = 'N',
    lastupdated = NOW()
WHERE id IN (181, 243, 263, 283)
  AND name = 'CTD';

-- Ensure canonical CTD stays active
UPDATE clinlims.test_section
SET is_active = 'Y',
    name = 'CTD',
    description = 'CTD Department',
    lastupdated = NOW()
WHERE id = 184;

-- Remove orphan lab_unit_role_map for duplicate 181 (no users assigned)
DELETE FROM clinlims.lab_roles
WHERE lab_unit_role_map_id IN (
    SELECT lab_unit_role_map_id FROM clinlims.lab_unit_role_map WHERE lab_unit = '181'
);
DELETE FROM clinlims.lab_unit_role_map
WHERE lab_unit = '181';

-- Repair sequences used by UI user create (next id = MAX + 1)
SELECT setval('clinlims.login_user_seq', (SELECT COALESCE(MAX(id), 0) FROM clinlims.login_user)::bigint, true);
SELECT setval('clinlims.system_user_seq', (SELECT COALESCE(MAX(id), 0) FROM clinlims.system_user)::bigint, true);

COMMIT;

-- Post-check
SELECT id, name, is_active FROM clinlims.test_section WHERE name = 'CTD' ORDER BY id;
SELECT 'login_user_seq' AS seq, last_value, is_called FROM clinlims.login_user_seq;
SELECT 'login_user max' AS seq, MAX(id) FROM clinlims.login_user;
SELECT 'system_user_seq' AS seq, last_value, is_called FROM clinlims.system_user_seq;
SELECT 'system_user max' AS seq, MAX(id) FROM clinlims.system_user;
