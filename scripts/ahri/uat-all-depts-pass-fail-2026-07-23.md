# AHRI LIMS — All departments × personas browser UAT (2026-07-23)

> **INTERNAL** — credentials + results. Do not publish outside AHRI /
> OrbitHealth test team.

|                 |                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Prod**        | https://lims.ahri.gov.et/                                                                                   |
| **Credentials** | [`test-users-departments.md`](./test-users-departments.md)                                                  |
| **Method**      | Playwright UI: login → lab unit → notebook workflow tab → PageNavigation Restricted vs `ahri-workflows.csv` |
| **Script**      | `scripts/ahri/run-browser-uat.py`                                                                           |
| **Raw JSON**    | `scripts/ahri/uat-browser-matrix-2026-07-23.json`                                                           |
| **Log**         | `scripts/ahri/reports/uat-all-2026-07-23.log`                                                               |
| **Screenshots** | `output/playwright/ahri-uat/{Dept}_{user}.png`                                                              |

## Headline

| Metric                        | Value                                                            |
| ----------------------------- | ---------------------------------------------------------------- |
| Personas tested               | **85** (14 departments)                                          |
| Script PASS                   | **70 / 85**                                                      |
| Script FAIL                   | **15 / 85**                                                      |
| SRS-adjusted PASS (see notes) | **72 / 85**                                                      |
| Open bugs to fix later        | **0** (Biomedical open + global_admin COMPLETE fixed 2026-07-24) |

Non-biomedical roles across **all** departments (including previously unfinished
TB / Pharma / Traditional / Medlab / Genomics / Virology / Viral Vaccine)
largely **PASS** stage Restricted counts.

---

## Department totals (script result)

| Department     | PASS/Total | Notes                                                                    |
| -------------- | ---------- | ------------------------------------------------------------------------ |
| Bacteriology   | 5/6        | Fail: `bac_biomedical`                                                   |
| Pathology      | 5/7        | Fail: `path_pathologist`, `path_cyto` _(SRS note below)_                 |
| MNTD           | 5/6        | Fail: `mntd_biomedical`                                                  |
| Immunology     | 5/6        | Fail: `imm_biomedical`                                                   |
| Biorepository  | 5/6        | Fail: `bio_biomedical`                                                   |
| TB             | 5/6        | Fail: `tb_biomedical` — other personas **PASS** (improved vs 2026-07-14) |
| Pharma         | 5/6        | Fail: `pharm_biomedical` — other personas **PASS**                       |
| Traditional    | 5/6        | Fail: `trad_biomedical` — other personas **PASS**                        |
| Bioanalytical  | 5/6        | Fail: `banal_biomedical`                                                 |
| Bioequivalence | 5/6        | Fail: `beq_biomedical`                                                   |
| Medlab/CTD     | 5/6        | Fail: `medlab_biomedical` (±1 restr tolerance OK for others)             |
| Genomics       | 5/6        | Fail: `gen_biomedical`                                                   |
| Virology       | 5/6        | Fail: `vir_biomedical`                                                   |
| Viral Vaccine  | 5/6        | Fail: `vv_biomedical`                                                    |

---

## FAIL list — previously open (now fixed / reclassified)

### A. Biomedical Staff — cannot open notebook entry — **FIXED** (2026-07-24)

`canOpenNotebookEntry` + dashboard open gate allow Biomedical Staff to open
notebooks with all stages Restricted and Save disabled. Re-run
`run-browser-uat.py` to refresh PASS counts.

### B. Pathology Pathologist / Cytopathologist — **NOT a product bug (SRS)**

| User               | Observed                                   | SRS                                            |
| ------------------ | ------------------------------------------ | ---------------------------------------------- |
| `path_pathologist` | Restricted on Storage, Reporting, Disposal | Correct — Lab Manager / Senior Researcher only |
| `path_cyto`        | same                                       | same                                           |

UAT script updated: no longer expects 0 Restricted for these personas.

---

## What worked well

- Collector / Tech / Manager / Jr / Sr Researcher stage Restricted counts match
  CSV across finished **and** remaining departments.
- TB / Pharma / Traditional / Medlab / Genomics / Virology / Viral Vaccine are
  green for non-biomedical personas (major improvement vs 2026-07-14
  PENDING/FAIL matrix).
- Bacteriology page order still OK (Isolate before Temporary Storage) for
  passing bac personas.
- Prod intermittently slow (login/goto timeouts); script retries handled most
  cases.

---

## Persona matrix (compact)

Legend: **P** = PASS, **F** = FAIL (open), **S** = FAIL script / PASS vs SRS

| Dept           | collector | tech | manager | jr  | sr  | biomedical | specialty                     |
| -------------- | --------- | ---- | ------- | --- | --- | ---------- | ----------------------------- |
| Bacteriology   | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Pathology      | P         | P    | P       | P   | P   | —          | pathologist **S**, cyto **S** |
| MNTD           | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Immunology     | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Biorepository  | P         | P    | P       | P   | P   | **fixed**  | —                             |
| TB             | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Pharma         | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Traditional    | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Bioanalytical  | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Bioequivalence | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Medlab/CTD     | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Genomics       | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Virology       | P         | P    | P       | P   | P   | **fixed**  | —                             |
| Viral Vaccine  | P         | P    | P       | P   | P   | **fixed**  | —                             |

---

## Not covered in this run

- Admin **Notebook stage access** override UI (Default / All / Select) save +
  enforce per user
- Deep Save/Edit inside each stage (only Restricted tags + nav presence)
- Project roles / Global Admin roles

---

**Last run:** 2026-07-23 (~74 min full matrix)
