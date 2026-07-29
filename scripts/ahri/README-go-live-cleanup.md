# AHRI Go-Live Runbook

| Environment    | Host              | App dir                |
| -------------- | ----------------- | ---------------------- |
| **Test**       | `192.168.176.127` | `/opt/OpenELIS-Docker` |
| **Production** | `192.168.25.25`   | `/opt/OpenELIS-Docker` |

Deploy to **test first**, smoke-test, then production (`clinlims` database,
`openelisglobal-database` container).

Reference data: `AHRI-20260525T055818Z-3-001.zip` (especially
`AHRI/Biorepository/sampledata.xlsx`).

## Execution order

1. **M1** — Deploy storage visibility fix (`v2026.06.18.05` or later)
2. **M2** — Backfill `bio_sample.manifest_sno` (no deletes)
3. **M3** — Backup → inventory → dry-run → sign-off → execute cleanup

---

## M1 — Storage visibility deploy

**From dev machine** (SSH key + GHCR PAT with `read:packages`):

```bash
export GHCR_READ_USER=your_github_username
export GHCR_READ_TOKEN=ghp_...   # classic PAT, read:packages

# Test server first
./scripts/deploy-release.sh v2026.06.18.05 192.168.176.127

# After smoke test, production
./scripts/deploy-release.sh v2026.06.18.05 192.168.25.25
```

**On the server directly** (when SSH from dev machine is unavailable):

```bash
cd /opt/OpenELIS-Docker
export GHCR_READ_USER=your_github_username
export GHCR_READ_TOKEN=ghp_...
sudo -E bash deploy-release-on-server.sh v2026.06.18.05
```

Copy `scripts/deploy-release-on-server.sh` to the host first if it is not
already there.

If Liquibase lock sticks after restart:

```sql
UPDATE clinlims.databasechangeloglock
SET locked = false, lockgranted = NULL, lockedby = NULL
WHERE id = 1;
```

Smoke test: Biorepository → Storage Assignment → assign 3 samples → verify
list + grid + re-open box.

---

## M2 — manifest_sno backfill

```bash
# On dev machine (generates CSV)
python3 scripts/ahri/backfill-biosample-manifest-sno.py \
  /path/to/AHRI/Biorepository/sampledata.xlsx

# Copy CSV to server, then on production host:
docker exec -i openelisglobal-database psql -U clinlims -d clinlims \
  < scripts/ahri/backfill-biosample-manifest-sno.sql
```

Verification:

```sql
SELECT COUNT(*) FILTER (WHERE manifest_sno IS NULL) AS missing_sno, COUNT(*) AS total
FROM clinlims.bio_sample;
```

---

## M3 — Go-live cleanup

### Preconditions

1. Full backup:

```bash
docker exec openelisglobal-database pg_dump -U clinlims -Fc clinlims \
  > /opt/backups/clinlims-pre-golive-$(date +%Y%m%d).dump
```

2. Maintenance window — stop UAT imports during cleanup.
3. `SELECT * FROM clinlims.databasechangeloglock;` — `locked` must be `false`.

### Build keep-lists

```bash
python3 scripts/ahri/build-keep-lists.py /path/to/AHRI-20260525T055818Z-3-001.zip
```

### Identify bacteriology entry to keep

```sql
SELECT ne.id, ne.entry_number, n.name, ne.lastupdated, COUNT(nes.sample_item_id)
FROM clinlims.notebook_entry ne
JOIN clinlims.notebook n ON n.id = ne.notebook_id
LEFT JOIN clinlims.notebook_entry_sample nes ON nes.notebook_entry_id = ne.id
WHERE LOWER(n.name) LIKE '%bacteriology%'
GROUP BY ne.id, n.name
ORDER BY ne.lastupdated DESC NULLS LAST, ne.id DESC
LIMIT 5;
```

Export id as `KEEP_BACT_ENTRY_ID`.

### Dry-run

```bash
chmod +x scripts/ahri/go-live-cleanup-dry-run.sh scripts/ahri/go-live-cleanup-execute.sh
./scripts/ahri/go-live-cleanup-dry-run.sh
```

### Execute (after sign-off)

```bash
KEEP_BACT_ENTRY_ID=12345 ./scripts/ahri/go-live-cleanup-execute.sh
```

### Post-cleanup checklist

| Check                   | Expected                            |
| ----------------------- | ----------------------------------- |
| Login + version         | Release tag visible                 |
| Received Samples        | ~7K rows, sorted by S.No            |
| Storage Assignment      | List + grid in sync                 |
| Box wells               | Barcode text, not blue dot          |
| Bacteriology entry      | Newest entry intact                 |
| Other notebook entries  | Templates + 1 bacteriology instance |
| `databasechangeloglock` | `locked = false`                    |

### Rollback

```bash
pg_restore -U clinlims -d clinlims --clean /opt/backups/clinlims-pre-golive-YYYYMMDD.dump
docker restart openelisglobal-webapp
```
