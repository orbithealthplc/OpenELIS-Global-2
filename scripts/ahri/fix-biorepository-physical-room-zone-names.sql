-- AHRI Biorepository: clarify 2 physical rooms vs zones (names only)
-- Physical rooms are UI grouping; zones remain storage_room rows.

BEGIN;

UPDATE clinlims.storage_room
SET name = 'Main Storage',
    description = 'Single storage area inside Minus 20 Freezer Room (physical room 1). Code BIO-M20.',
    last_updated = CURRENT_TIMESTAMP
WHERE code = 'BIO-M20';

UPDATE clinlims.storage_room
SET name = 'Reception',
    description = 'Reception area inside Ultra Low Freezer Room (physical room 2). Code BIO-REC.',
    last_updated = CURRENT_TIMESTAMP
WHERE code = 'BIO-REC';

UPDATE clinlims.storage_room
SET description = 'Ultra Low Freezer Room (physical room 2) — Zone ' || REPLACE(code, 'BIO-ZN', '') || '.',
    last_updated = CURRENT_TIMESTAMP
WHERE code IN ('BIO-ZN1','BIO-ZN2','BIO-ZN3','BIO-ZN4','BIO-ZN5','BIO-ZN6');

COMMIT;

-- Verify
SELECT code, name, left(description, 80) AS description
FROM clinlims.storage_room
WHERE code LIKE 'BIO-%'
ORDER BY code;
