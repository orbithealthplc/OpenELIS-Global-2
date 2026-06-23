# AHRI biorepository Excel import — clean release runbook

Use this when deploying biorepo Excel fixes to **orbithealthplc** production (`192.168.25.25`).

## Repos (do not confuse)

| Repo | Use for AHRI? |
|------|----------------|
| `orbithealthplc/OpenELIS-Global-2` | **YES** — PRs, releases, GHCR images |
| `DIGI-UW/OpenELIS-Global-2` | **NO** — upstream only |

## Clean release line (required)

Production stable baseline: **`v2026.06.18.03`** (`be06e50c4`).

**Do NOT deploy** these intermediate tags (skipped on purpose):

- `v2026.06.18.05` — storage visibility (not in clean line)
- `v2026.06.19.01` — pathology workflow save (not in clean line)
- PR #70 merge on `demo/ethiopia` (includes all middle commits)

**Clean branch:** `fix/biorepo-excel-clean`

Linear history from `v2026.06.18.03`:

1. `ca3f80a08` — manifest import + `manifest_sno` (Liquibase 078)
2. `6317f26b8` — AHRI Excel column alignment (first sheet, Coordinate, 23-field UI)

## Create / verify release

```bash
git fetch orbithealth
git checkout fix/biorepo-excel-clean
git log --oneline v2026.06.18.03..HEAD   # must show exactly 2 commits

cd frontend && npm test -- --watchAll=false --testPathPattern="biorepositoryExcelColumns|manifestImportHelpers"
cd .. && mvn compile -DskipTests -Dmaven.test.skip=true

git push -u orbithealth fix/biorepo-excel-clean

gh release create v2026.06.23.01 \
  --repo orbithealthplc/OpenELIS-Global-2 \
  --target fix/biorepo-excel-clean \
  --title "v2026.06.23.01 — Biorepository AHRI Excel import (clean from v2026.06.18.03)" \
  --notes "Clean release: v2026.06.18.03 + manifest_sno + Excel import fixes only. Do not use v2026.06.19.01."
```

Wait for **Publish PROD images to GHCR** workflow to finish on the release.

Optional — deprecate bad release:

```bash
gh release delete v2026.06.19.01 --repo orbithealthplc/OpenELIS-Global-2 --yes
```

## Deploy (on AHRI server via AnyDesk + SSH)

```bash
cd /opt/OpenELIS-Docker   # or your compose directory
./scripts/deploy-release.sh v2026.06.23.01 192.168.25.25
# or: docker compose pull && docker compose up -d
```

Hard-refresh browser after deploy (Docker serves `frontend/build/`).

## Smoke test

1. Import official `Bac_Sample submission...xlsx` (~3598 rows; Sample_ID `H-*`, Lab ID `E1JR*`)
2. Import variant `Untitled spreadsheet (2).xlsx` (~1499 rows; `Coordinate` column)
3. Received Samples: sort by Sr. no; View details shows 23 fields

## Rollback

```bash
./scripts/deploy-release.sh v2026.06.18.03 192.168.25.25
```
