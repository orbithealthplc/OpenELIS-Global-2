# AHRI LIMS — Department test users

> **INTERNAL / CREDENTIALS — test accounts only**  
> Do not commit to public READMEs or share outside the AHRI / OrbitHealth test
> team.  
> These accounts are for UAT and smoke testing, not production clinical use.

|                   |                                                    |
| ----------------- | -------------------------------------------------- |
| **Login URL**     | https://lims.ahri.gov.et/ (also `/login`)          |
| **Environment**   | AHRI production LIMS (and local/dev when seeded)   |
| **Last verified** | 2026-07-15 (browser workflow UAT — finished depts) |

**Also see (legacy name):**
[`test-users-pathology-mntd.md`](./test-users-pathology-mntd.md) — points here.

---

## Finished departments — credentials (copy/paste)

Prod: **https://lims.ahri.gov.et/**

| Department         | Lab unit id | Password         | Users                                                                                                                      |
| ------------------ | ----------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Bacteriology**   | `168`       | `BacTest!2026`   | `bac_collector`, `bac_tech`, `bac_manager`, `bac_jr_researcher`, `bac_sr_researcher`, `bac_biomedical`                     |
| **Pathology**      | `176`       | `PathTest!2026`  | `path_collector`, `path_tech`, `path_manager`, `path_pathologist`, `path_cyto`, `path_jr_researcher`, `path_sr_researcher` |
| **MNTD**           | `177`       | `adminADMIN!`    | `mntd_collector`, `mntd_technician`, `mntd_manager`, `mntd_researcher`, `mntd_senior`, `mntd_biomedical`                   |
| **Immunology**     | `59`        | `ImmTest!2026`   | `imm_collector`, `imm_tech`, `imm_manager`, `imm_jr_researcher`, `imm_sr_researcher`, `imm_biomedical`                     |
| **Biorepository**  | `182`       | `BioTest!2026`   | `bio_collector`, `bio_tech`, `bio_manager`, `bio_jr_researcher`, `bio_sr_researcher`, `bio_biomedical`                     |
| **Bioanalytical**  | `174`       | `BanalTest!2026` | `banal_collector`, `banal_tech`, `banal_manager`, `banal_jr_researcher`, `banal_sr_researcher`, `banal_biomedical`         |
| **Bioequivalence** | `175`       | `BeqTest!2026`   | `beq_collector`, `beq_tech`, `beq_manager`, `beq_jr_researcher`, `beq_sr_researcher`, `beq_biomedical`                     |

**MNTD legacy (optional):** `MNTDsample` / `MNTDsample!`

### Workflow notebooks for UAT (instance / entry)

| Dept             | Notebook URL path                                                  |
| ---------------- | ------------------------------------------------------------------ |
| Bacteriology     | `/NoteBookInstanceEditForm/225?mode=edit&tab=workflow&entryId=100` |
| Pathology (FNAC) | `/NoteBookInstanceEditForm/220?mode=edit&tab=workflow&entryId=96`  |
| MNTD             | `/NoteBookInstanceEditForm/228?mode=edit&tab=workflow&entryId=103` |
| Immunology       | `/NoteBookInstanceEditForm/233?mode=edit&tab=workflow&entryId=108` |
| Biorepository    | `/NoteBookInstanceEditForm/232?mode=edit&tab=workflow&entryId=107` |
| Bioanalytical    | `/NoteBookInstanceEditForm/238?mode=edit&tab=workflow&entryId=122` |
| Bioequivalence   | `/NoteBookInstanceEditForm/239?mode=edit&tab=workflow&entryId=123` |

**Login steps:** open `/login` → username + password → select matching lab unit
→ open notebook workflow URL above → confirm **Workflow Pages** + **Restricted**
tags load for the persona.

---

## Pathology Laboratory

| Field                          | Value                |
| ------------------------------ | -------------------- |
| **Lab unit (select at login)** | Pathology Laboratory |
| **Test section id**            | `176`                |
| **Shared password**            | `PathTest!2026`      |

| Login                | Role                  | Password        | Login test |
| -------------------- | --------------------- | --------------- | ---------- |
| `path_collector`     | Sample Collector      | `PathTest!2026` | PASS       |
| `path_tech`          | Laboratory Technician | `PathTest!2026` | PASS       |
| `path_manager`       | Lab Manager           | `PathTest!2026` | PASS       |
| `path_pathologist`   | Pathologist           | `PathTest!2026` | PASS       |
| `path_cyto`          | Cytopathologist       | `PathTest!2026` | PASS       |
| `path_jr_researcher` | Junior Researcher     | `PathTest!2026` | PASS       |
| `path_sr_researcher` | Senior Researcher     | `PathTest!2026` | PASS       |

---

## Malaria and Neglected Tropical Disease (MNTD) Laboratory

| Field                          | Value                                                    |
| ------------------------------ | -------------------------------------------------------- |
| **Lab unit (select at login)** | Malaria and Neglected Tropical Disease (MNTD) Laboratory |
| **Test section id**            | `177`                                                    |

### Production-era account

| Login        | Role             | Password      | Login test |
| ------------ | ---------------- | ------------- | ---------- |
| `MNTDsample` | Sample Collector | `MNTDsample!` | PASS       |

### Seeded SRS persona smoke users

| Field               | Value         |
| ------------------- | ------------- |
| **Shared password** | `adminADMIN!` |

| Login             | Role                  | Password      | Login test |
| ----------------- | --------------------- | ------------- | ---------- |
| `mntd_collector`  | Sample Collector      | `adminADMIN!` | PASS       |
| `mntd_technician` | Laboratory Technician | `adminADMIN!` | PASS       |
| `mntd_researcher` | Junior Researcher     | `adminADMIN!` | PASS       |
| `mntd_senior`     | Senior Researcher     | `adminADMIN!` | PASS       |
| `mntd_manager`    | Lab Manager           | `adminADMIN!` | PASS       |
| `mntd_biomedical` | Biomedical Staff      | `adminADMIN!` | PASS       |

**Notes (2026-07-13):**

- `MNTDsample` worked as documented without reset.
- Seeded `mntd_*` accounts existed but passwords were wrong for `adminADMIN!`;
  passwords were reset to the known bcrypt hash for `adminADMIN!` (same as
  `scripts/populate-notebook-users.sh`). Accounts were not recreated.
- All seven MNTD logins verified: ValidateLogin 200 + lab unit 177 + session.

---

## Bacteriology

| Field                          | Value          |
| ------------------------------ | -------------- |
| **Lab unit (select at login)** | Bacteriology   |
| **Test section id**            | `168`          |
| **Shared password**            | `BacTest!2026` |

| Login               | Role                  | Password       | Login test |
| ------------------- | --------------------- | -------------- | ---------- |
| `bac_collector`     | Sample Collector      | `BacTest!2026` | PASS       |
| `bac_tech`          | Laboratory Technician | `BacTest!2026` | PASS       |
| `bac_manager`       | Lab Manager           | `BacTest!2026` | PASS       |
| `bac_jr_researcher` | Junior Researcher     | `BacTest!2026` | PASS       |
| `bac_sr_researcher` | Senior Researcher     | `BacTest!2026` | PASS       |
| `bac_biomedical`    | Biomedical Staff      | `BacTest!2026` | PASS       |

**Notes:** Created 2026-07-13 for role-type UAT. Left existing `bacteriology`
dept account untouched.

---

## Immunology

| Field                          | Value          |
| ------------------------------ | -------------- |
| **Lab unit (select at login)** | Immunology     |
| **Test section id**            | `59`           |
| **Shared password**            | `ImmTest!2026` |

| Login               | Role                  | Password       | Login test |
| ------------------- | --------------------- | -------------- | ---------- |
| `imm_collector`     | Sample Collector      | `ImmTest!2026` | PASS       |
| `imm_tech`          | Laboratory Technician | `ImmTest!2026` | PASS       |
| `imm_manager`       | Lab Manager           | `ImmTest!2026` | PASS       |
| `imm_jr_researcher` | Junior Researcher     | `ImmTest!2026` | PASS       |
| `imm_sr_researcher` | Senior Researcher     | `ImmTest!2026` | PASS       |
| `imm_biomedical`    | Biomedical Staff      | `ImmTest!2026` | PASS       |

**Notes:** Created 2026-07-13 for role-type UAT. Left existing `immunology` /
named staff accounts (Meaza, Azeb, etc.) untouched.

---

## Biorepository Laboratory

| Field                          | Value                    |
| ------------------------------ | ------------------------ |
| **Lab unit (select at login)** | Biorepository Laboratory |
| **Test section id**            | `182`                    |
| **Shared password**            | `BioTest!2026`           |

| Login               | Role                  | Password       | Login test |
| ------------------- | --------------------- | -------------- | ---------- |
| `bio_collector`     | Sample Collector      | `BioTest!2026` | PASS       |
| `bio_tech`          | Laboratory Technician | `BioTest!2026` | PASS       |
| `bio_manager`       | Lab Manager           | `BioTest!2026` | PASS       |
| `bio_jr_researcher` | Junior Researcher     | `BioTest!2026` | PASS       |
| `bio_sr_researcher` | Senior Researcher     | `BioTest!2026` | PASS       |
| `bio_biomedical`    | Biomedical Staff      | `BioTest!2026` | PASS       |

---

## Tuberculosis Laboratory

| Field                          | Value                   |
| ------------------------------ | ----------------------- |
| **Lab unit (select at login)** | Tuberculosis Laboratory |
| **Test section id**            | `180`                   |
| **Shared password**            | `TbTest!2026`           |

| Login              | Role                  | Password      | Login test |
| ------------------ | --------------------- | ------------- | ---------- |
| `tb_collector`     | Sample Collector      | `TbTest!2026` | PASS       |
| `tb_tech`          | Laboratory Technician | `TbTest!2026` | PASS       |
| `tb_manager`       | Lab Manager           | `TbTest!2026` | PASS       |
| `tb_jr_researcher` | Junior Researcher     | `TbTest!2026` | PASS       |
| `tb_sr_researcher` | Senior Researcher     | `TbTest!2026` | PASS       |
| `tb_biomedical`    | Biomedical Staff      | `TbTest!2026` | PASS       |

---

## Pharmaceuticals Laboratory

| Field                          | Value                      |
| ------------------------------ | -------------------------- |
| **Lab unit (select at login)** | Pharmaceuticals Laboratory |
| **Test section id**            | `178`                      |
| **Shared password**            | `PharmTest!2026`           |

| Login                 | Role                  | Password         | Login test |
| --------------------- | --------------------- | ---------------- | ---------- |
| `pharm_collector`     | Sample Collector      | `PharmTest!2026` | PASS       |
| `pharm_tech`          | Laboratory Technician | `PharmTest!2026` | PASS       |
| `pharm_manager`       | Lab Manager           | `PharmTest!2026` | PASS       |
| `pharm_jr_researcher` | Junior Researcher     | `PharmTest!2026` | PASS       |
| `pharm_sr_researcher` | Senior Researcher     | `PharmTest!2026` | PASS       |
| `pharm_biomedical`    | Biomedical Staff      | `PharmTest!2026` | PASS       |

---

## Traditional & Modern Medicine Research Lab

| Field                          | Value                                      |
| ------------------------------ | ------------------------------------------ |
| **Lab unit (select at login)** | Traditional & Modern Medicine Research Lab |
| **Test section id**            | `173`                                      |
| **Shared password**            | `TradTest!2026`                            |

| Login                | Role                  | Password        | Login test |
| -------------------- | --------------------- | --------------- | ---------- |
| `trad_collector`     | Sample Collector      | `TradTest!2026` | PASS       |
| `trad_tech`          | Laboratory Technician | `TradTest!2026` | PASS       |
| `trad_manager`       | Lab Manager           | `TradTest!2026` | PASS       |
| `trad_jr_researcher` | Junior Researcher     | `TradTest!2026` | PASS       |
| `trad_sr_researcher` | Senior Researcher     | `TradTest!2026` | PASS       |
| `trad_biomedical`    | Biomedical Staff      | `TradTest!2026` | PASS       |

---

## Bioanalytical Laboratory

| Field                          | Value                    |
| ------------------------------ | ------------------------ |
| **Lab unit (select at login)** | Bioanalytical Laboratory |
| **Test section id**            | `174`                    |
| **Shared password**            | `BanalTest!2026`         |

| Login                 | Role                  | Password         | Login test |
| --------------------- | --------------------- | ---------------- | ---------- |
| `banal_collector`     | Sample Collector      | `BanalTest!2026` | PASS       |
| `banal_tech`          | Laboratory Technician | `BanalTest!2026` | PASS       |
| `banal_manager`       | Lab Manager           | `BanalTest!2026` | PASS       |
| `banal_jr_researcher` | Junior Researcher     | `BanalTest!2026` | PASS       |
| `banal_sr_researcher` | Senior Researcher     | `BanalTest!2026` | PASS       |
| `banal_biomedical`    | Biomedical Staff      | `BanalTest!2026` | PASS       |

---

## Bioequivalence Laboratory

| Field                          | Value                     |
| ------------------------------ | ------------------------- |
| **Lab unit (select at login)** | Bioequivalence Laboratory |
| **Test section id**            | `175`                     |
| **Shared password**            | `BeqTest!2026`            |

| Login               | Role                  | Password       | Login test |
| ------------------- | --------------------- | -------------- | ---------- |
| `beq_collector`     | Sample Collector      | `BeqTest!2026` | PASS       |
| `beq_tech`          | Laboratory Technician | `BeqTest!2026` | PASS       |
| `beq_manager`       | Lab Manager           | `BeqTest!2026` | PASS       |
| `beq_jr_researcher` | Junior Researcher     | `BeqTest!2026` | PASS       |
| `beq_sr_researcher` | Senior Researcher     | `BeqTest!2026` | PASS       |
| `beq_biomedical`    | Biomedical Staff      | `BeqTest!2026` | PASS       |

---

## Medical Laboratory

| Field                          | Value              |
| ------------------------------ | ------------------ |
| **Lab unit (select at login)** | Medical Laboratory |
| **Test section id**            | `303`              |
| **Shared password**            | `MedlabTest!2026`  |

| Login                  | Role                  | Password          | Login test |
| ---------------------- | --------------------- | ----------------- | ---------- |
| `medlab_collector`     | Sample Collector      | `MedlabTest!2026` | PASS       |
| `medlab_tech`          | Laboratory Technician | `MedlabTest!2026` | PASS       |
| `medlab_manager`       | Lab Manager           | `MedlabTest!2026` | PASS       |
| `medlab_jr_researcher` | Junior Researcher     | `MedlabTest!2026` | PASS       |
| `medlab_sr_researcher` | Senior Researcher     | `MedlabTest!2026` | PASS       |
| `medlab_biomedical`    | Biomedical Staff      | `MedlabTest!2026` | PASS       |

---

## Genomics & Bioinformatics Laboratory

| Field                          | Value                                |
| ------------------------------ | ------------------------------------ |
| **Lab unit (select at login)** | Genomics & Bioinformatics Laboratory |
| **Test section id**            | `172`                                |
| **Shared password**            | `GenTest!2026`                       |

| Login               | Role                  | Password       | Login test |
| ------------------- | --------------------- | -------------- | ---------- |
| `gen_collector`     | Sample Collector      | `GenTest!2026` | PASS       |
| `gen_tech`          | Laboratory Technician | `GenTest!2026` | PASS       |
| `gen_manager`       | Lab Manager           | `GenTest!2026` | PASS       |
| `gen_jr_researcher` | Junior Researcher     | `GenTest!2026` | PASS       |
| `gen_sr_researcher` | Senior Researcher     | `GenTest!2026` | PASS       |
| `gen_biomedical`    | Biomedical Staff      | `GenTest!2026` | PASS       |

---

## Virology Laboratory

| Field                          | Value               |
| ------------------------------ | ------------------- |
| **Lab unit (select at login)** | Virology Laboratory |
| **Test section id**            | `203`               |
| **Shared password**            | `VirTest!2026`      |

| Login               | Role                  | Password       | Login test |
| ------------------- | --------------------- | -------------- | ---------- |
| `vir_collector`     | Sample Collector      | `VirTest!2026` | PASS       |
| `vir_tech`          | Laboratory Technician | `VirTest!2026` | PASS       |
| `vir_manager`       | Lab Manager           | `VirTest!2026` | PASS       |
| `vir_jr_researcher` | Junior Researcher     | `VirTest!2026` | PASS       |
| `vir_sr_researcher` | Senior Researcher     | `VirTest!2026` | PASS       |
| `vir_biomedical`    | Biomedical Staff      | `VirTest!2026` | PASS       |

---

## Viral Vaccine

| Field                          | Value         |
| ------------------------------ | ------------- |
| **Lab unit (select at login)** | Viral Vaccine |
| **Test section id**            | `179`         |
| **Shared password**            | `VvTest!2026` |

| Login              | Role                  | Password      | Login test |
| ------------------ | --------------------- | ------------- | ---------- |
| `vv_collector`     | Sample Collector      | `VvTest!2026` | PASS       |
| `vv_tech`          | Laboratory Technician | `VvTest!2026` | PASS       |
| `vv_manager`       | Lab Manager           | `VvTest!2026` | PASS       |
| `vv_jr_researcher` | Junior Researcher     | `VvTest!2026` | PASS       |
| `vv_sr_researcher` | Senior Researcher     | `VvTest!2026` | PASS       |
| `vv_biomedical`    | Biomedical Staff      | `VvTest!2026` | PASS       |

---

## Quick login checklist

1. Open https://lims.ahri.gov.et/login
2. Enter username + password from the tables above
3. If prompted for lab unit, select the matching lab for that department (ids
   above)
4. Hard-refresh (Ctrl+Shift+R) after deploys if UI looks stale

**Roles per department (new accounts):** Sample Collector, Laboratory
Technician, Lab Manager, Junior Researcher, Senior Researcher, Biomedical Staff.

**Verified 2026-07-23 (remaining gaps):** COMPLETE RBAC + stage-override API
modes PASS; admin user Save POST **500** on prod; `global_admin` can COMPLETE
notebook pages (unexpected 200). See
`scripts/ahri/uat-remaining-pass-fail-2026-07-23.md`.

**Verified 2026-07-23:** Full browser UAT on prod — **14 departments / 85
personas** → **70/85 script PASS** (72/85 SRS-adjusted). Open gap: **all
`*_biomedical`** redirected from notebook edit (not in CSV stage personas /
entry-edit gate). Pathologist/Cyto Restricted on Storage/Reporting/Disposal
matches SRS. See `scripts/ahri/uat-all-depts-pass-fail-2026-07-23.md`.

**Verified 2026-07-15:** Browser UAT on prod for all 7 finished departments —
**43/43 personas PASS** (workflow PageNavigation + Restricted tags). See
`scripts/ahri/uat-finished-pass-fail-2026-07-15.md`.

**Verified 2026-07-13:** All new accounts → ValidateLogin 200 +
setUserLoginLabUnit + session PASS (60/60).

---

## Related scripts / docs

- Seed users: `scripts/populate-notebook-users.sh`
- MNTD UAT report: `docs/ahri-mntd-live-uat-report-2026-06-02.md`
- Pathology template roles: `scripts/ahri/README-pathology-template-roles.md`
