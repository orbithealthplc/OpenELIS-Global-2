# AHRI remaining UAT — 2026-07-23 (full gap coverage)

> **INTERNAL** — credentials + results. See also
> [`uat-all-depts-pass-fail-2026-07-23.md`](./uat-all-depts-pass-fail-2026-07-23.md)
> for department × persona Restricted matrix.

|            |                                                     |
| ---------- | --------------------------------------------------- |
| **Prod**   | https://lims.ahri.gov.et/                           |
| **Script** | `scripts/ahri/run-remaining-uat.py`                 |
| **JSON**   | `scripts/ahri/uat-remaining-2026-07-23.json`        |
| **Log**    | `scripts/ahri/reports/uat-remaining-2026-07-23.log` |

## What this run covered (previously skipped)

| Area                                               | Method                                      | Result summary                                              |
| -------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| Stage override **API** (DEFAULT / ALL / ALLOWLIST) | SQL seed + `/rest/notebook/my-stage-access` | **PASS** (3/3 modes)                                        |
| Stage override **UI Restricted** after override    | Playwright notebook                         | **FAIL** this run (SPA session/cookie — see note)           |
| Admin **Notebook stage access** editor             | Browser UI + API                            | **FIXED** — Save works (see below)                          |
| Stage **COMPLETE** allow/deny                      | REST bulk complete                          | **8/9 PASS**                                                |
| Biomedical inventory/storage APIs                  | REST                                        | **PASS**                                                    |
| Biomedical UI menus / view-mode                    | Playwright                                  | **FAIL** (session) — APIs OK                                |
| Global roles login + pages                         | Playwright + REST                           | **Mostly PASS**; **global_admin COMPLETE=200** is a gap     |
| Manager/collector workflow edit smoke              | Playwright                                  | Session flake this run; COMPLETE API already proves backend |

**First-pass score:** 17/32 PASS (many FAILs are Playwright session, not
product).

---

## PASS (confident — product working)

### Stage override enforcement (API)

After fixing DB column `lastupdated` → `last_updated` on
`notebook_user_stage_override`:

| Mode                    | `/rest/notebook/my-stage-access`                |
| ----------------------- | ----------------------------------------------- |
| DEFAULT                 | `{"mode":"DEFAULT","pageKeys":[]}`              |
| ALL                     | `{"mode":"ALL",...}`                            |
| ALLOWLIST (`reception`) | `{"mode":"ALLOWLIST","pageKeys":["reception"]}` |

Seeded via SQL for `bac_collector` / lab `168` (admin POST still broken —
below).

### Stage COMPLETE RBAC (Bacteriology notebook pages)

| User                | Action                    | HTTP    | Verdict |
| ------------------- | ------------------------- | ------- | ------- |
| `bac_collector`     | COMPLETE reception (3615) | 200     | PASS    |
| `bac_collector`     | COMPLETE reporting (3623) | **403** | PASS    |
| `bac_manager`       | COMPLETE reporting        | 200     | PASS    |
| `bac_jr_researcher` | COMPLETE reception        | **403** | PASS    |
| `system_admin`      | COMPLETE reception        | **403** | PASS    |
| `admin_staff`       | COMPLETE reception        | **403** | PASS    |
| `eqa_user`          | COMPLETE reception        | **403** | PASS    |
| `bac_biomedical`    | COMPLETE reception        | **403** | PASS    |

### Biomedical data APIs

- `GET /rest/inventory/items` → **200**
- `GET /rest/storage/rooms` → **200**

### Global roles login

- `global_admin`, `system_admin`, `admin_staff`, `eqa_user` ValidateLogin
  **success**
- `global_admin` can open `/admin`
- `eqa_user` can open `/landing`

---

## FAIL / fix later (real product gaps)

### 1. Admin user Save — **FIXED** (2026-07-23)

- **Cause:** `NotebookUserStageOverrideDAOImpl.deleteBySystemUserId` used bulk
  DELETE HQL; this Hibernate rejects it
  (`query must begin with SELECT or FROM`).
- **Fix:** load overrides + `delete()` each entity (small DAO change).
- **Verified:** API POST → 200; browser UI Save of **All stages** on
  `bac_collector` → `mode=ALL` persisted and radio stayed selected after reload.

### 2. `global_admin` notebook COMPLETE — **FIXED** (2026-07-24)

- Unrestricted accounts (Global Administrator / AllLabUnits) are hard-denied on
  COMPLETE.
- Prod smoke: `global_admin` / `system_admin` → **403**; `bac_collector` →
  **200**; `bac_biomedical` → **403**.

### 3. Biomedical cannot open notebook — **FIXED** (2026-07-24)

- `canOpenNotebookEntry` allows Biomedical Staff to open (Restricted stages,
  Save disabled).
- Dashboard Edit uses open gate (not save gate).
- Prod smoke: biomedical loads `/rest/notebook/view/225` + entry; edit URL stays
  on form.

### 4. Liquibase column naming — **FIXED** (repo + prod)

- Prod: renamed `notebook_user_stage_override.lastupdated` → `last_updated`
- Repo: `080` create uses `last_updated`; `081-fix-nuso-lastupdated-column.xml`
  for already-deployed DBs

---

## Inconclusive this run (test harness / prod flakiness)

Playwright cookie-only login often landed on `/login` for SPA routes
(`/admin/userEdit`, `/inventory`, notebook). Earlier department matrix UAT used
the same cookie helper successfully; remaining-suite UI cases need browser form
login retries when prod is slow.

**Do not treat these as product FAILs without a UI-login retest:**

- Override UI Restricted counts (DEFAULT/ALL/ALLOWLIST)
- Admin editor “Notebook stage access” visibility / Save
- Biomedical `/inventory` + `/equipment-usage` page render
- Manager/collector workflow nav screenshots

API evidence already covers override modes + COMPLETE RBAC.

---

## Project roles

No dedicated Project Investigator / Coordinator / Data Manager smoke users were
in the seeded credential doc for this pass. **Not tested.** Seed accounts if
needed, then re-run.

---

## Recommended fix order

1. ~~Fix `POST /rest/UnifiedSystemUser` 500 when saving
   `selectedLabUnitStageAccess`~~ **DONE**
2. ~~Decide + fix `global_admin` notebook COMPLETE (deny vs allow)~~ **DONE**
   (deny unrestricted)
3. ~~Biomedical notebook view-only / Restricted open~~ **DONE**
4. Re-run Playwright UI matrix (`run-browser-uat.py`) to confirm biomedical +
   pathology SRS expectations

---

**Artifacts:** `output/playwright/ahri-uat-remaining/`  
**Related:** department matrix `uat-all-depts-pass-fail-2026-07-23.md` (70/85;
Biomedical open gap)
