# AHRI Clean Release — AI Handoff Prompt

Use this when deploying biorepository fixes to **AHRI production** (`192.168.25.25`) via **orbithealthplc/OpenELIS-Global-2** only (not DIGI-UW).

## Context

| Item | Value |
|------|--------|
| Production fork | `https://github.com/orbithealthplc/OpenELIS-Global-2` |
| Deploy branch line | `demo/ethiopia` |
| **Stable production tag** | `v2026.06.18.03` (`be06e50c4`) |
| GHCR images | `ghcr.io/orbithealthplc/openelis-global-2*` |
| Do **not** PR to | `orbithealthplc/develop` (Vite migration, no biorepository UI) |

## Problem to avoid

Do **not** release from `demo/ethiopia` HEAD when it includes untested “middle” commits between stable prod and your fix. Those intermediate tags caused bad Excel imports and column shifts:

- `v2026.06.18.04` — manifest import (buggy multi-sheet / column drift)
- `v2026.06.18.05` — storage visibility
- `v2026.06.19.01` — pathology workflow type (not on prod)

Production stayed on **`v2026.06.18.03`**.

## Clean release procedure

### 1. Build release branch from stable tag + fix only

```bash
git fetch orbithealth demo/ethiopia
git worktree add -B release/v2026.06.23.01 /tmp/oe-release v2026.06.18.03

cd /tmp/oe-release
# Apply ONLY the tested excel-import files (10 files), e.g. from fix commit:
git checkout <excel-fix-commit> -- \
  frontend/src/components/notebook/pages/biorepository/manifestImportHelpers.js \
  frontend/src/components/notebook/pages/biorepository/manifestImportHelpers.test.js \
  frontend/src/components/notebook/pages/biorepository/ManifestUploadModal.js \
  frontend/src/components/notebook/pages/biorepository/BiorepositoryIntakePage.js \
  frontend/src/components/notebook/pages/biorepository/BiorepositoryStorageAssignmentPage.js \
  frontend/src/components/notebook/pages/biorepository/biorepositoryExcelColumns.js \
  frontend/src/components/notebook/pages/biorepository/biorepositoryExcelColumns.test.js \
  frontend/src/components/notebook/pages/biorepository/BioSampleDetailModal.js \
  frontend/src/components/notebook/workflow/SampleGrid.js \
  frontend/src/languages/en.json

cd frontend && npm test -- --watchAll=false \
  --testPathPattern="biorepositoryExcelColumns|manifestImportHelpers"
# Expect 22 tests passing

git commit -m "fix(biorepository): AHRI Excel import on v2026.06.18.03 base (clean release)"
git push -u orbithealth release/v2026.06.23.01
```

### 2. Remove bad intermediate releases (optional but recommended)

```bash
for tag in v2026.06.18.04 v2026.06.18.05 v2026.06.19.01; do
  gh release delete "$tag" --repo orbithealthplc/OpenELIS-Global-2 --yes --cleanup-tag || true
done
```

### 3. Publish new release (triggers GHCR)

```bash
gh release create v2026.06.23.01 \
  --repo orbithealthplc/OpenELIS-Global-2 \
  --target release/v2026.06.23.01 \
  --title "v2026.06.23.01 — Biorepository Excel import (clean, from v2026.06.18.03)" \
  --notes "Frontend-only AHRI Excel manifest fix on production base v2026.06.18.03. Skips v2026.06.18.04–v2026.06.19.01."
```

Wait for **Publish PROD images to GHCR** workflow on Actions to finish.

### 4. User deploys (AnyDesk + SSH on AHRI network)

```bash
./scripts/deploy-release.sh v2026.06.23.01 192.168.25.25
```

Hard-refresh browser after deploy (`frontend/build` is baked into image).

### 5. Smoke test

- Import official `Bac_Sample submission...` template (~3598 rows; `Sample_ID` H-*, `Lab ID` E1JR*)
- Import variant with `Coordinate` column (~1499 rows)
- Received Samples sorted by Sr. no.; View details shows 23 fields

### Rollback

```bash
./scripts/deploy-release.sh v2026.06.18.03 192.168.25.25
```

## Scope rules

- **Include:** 10 frontend files above only (unless backend `manifest_sno` already in prod DB from Liquibase on that tag).
- **Exclude:** Full stash, pathology, RBAC, inventory, MNTD, `BioSampleDAOImpl` replacements from WIP branches.
- **Remote:** `git push orbithealth` only; `origin` (DIGI-UW) will 403.

## Excel fix behavior

- First sheet only for full AHRI templates (no multi-sheet concat).
- `LEGACY_MANIFEST_FIELDS` aligned with `sno` column (no column shift).
- `Coordinate` accepted as storage location alias.
- Trust column titles: `Sample_ID` → barcode, `Lab ID` → externalId (no auto-swap).
