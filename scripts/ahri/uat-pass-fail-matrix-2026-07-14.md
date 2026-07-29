# AHRI LIMS — Role × Department UAT Matrix (2026-07-14)

> **INTERNAL** — credentials + UAT results. Do not commit to public remotes
> unless requested.

|                     |                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Prod**            | https://lims.ahri.gov.et/                                                           |
| **Credentials**     | `scripts/ahri/test-users-departments.md`                                            |
| **SRS source**      | `volume/configuration/backend/workflow-registry/ahri-workflows.csv`                 |
| **API matrix JSON** | `scripts/ahri/uat-access-matrix-2026-07-14.json` (85/85 login+lab+notebook view)    |
| **Browser JSON**    | `scripts/ahri/uat-browser-*.json` + screenshots under `output/playwright/ahri-uat/` |

## Fixes applied this session

### Bacteriology page-order (SRS)

- **Prod DB:** Reordered `notebook_page` for notebooks **4, 218, 225** to CSV
  order: 1 Reception → 2 Lab reception → **3 Isolate** → **4 Temporary Storage**
  → 5 Processing QC → 6 Assay → 7 Post-storage → 8 Disposal → 9 Reporting. Set
  `page_id` keys; renamed “Sample Storage Assignment” → “Temporary Storage
  Assignment”.
- **Frontend:** `BacteriologyWorkflowTab` renders by **pageKey/title** (not raw
  `page_order`); `ahriWorkflowRegistry.findRegistryStage` prefers
  title/`page_id` over drifted order; sync script updated.
- **Deploy:** Hot-deployed frontend build `main.e124ba8c.js` into
  `openelisglobal-front-end` (image still tagged v2026.07.13.02).
- **Browser verify:** all `bac_*` **6/6 PASS** — Isolate at position 3,
  Temporary Storage at 4; Restricted counts match CSV (+ Lab Manager override).

### Missing notebooks for UAT

Created child instances + draft entries (admin) so stage-access UI can be tested
outside template accordion:

| Dept           | Instance notebookId | entryId |
| -------------- | ------------------- | ------- |
| TB             | 235                 | 119     |
| Pharma         | 236                 | 120     |
| Traditional    | 237                 | 121     |
| Bioanalytical  | 238                 | 122     |
| Bioequivalence | 239                 | 123     |
| Virology       | 240                 | 124     |
| Viral Vaccine  | 241                 | 125     |

## Pass/fail matrix

Columns: **API** = login + lab unit + notebook/view (SRS pages present).
**Browser** = Workflow PageNavigation Restricted vs `ahri-workflows.csv` (Lab
Manager / Pathologist / Cytopathologist = full access).

| Department     | User                   | Persona               | API  | Browser stage-access | Notes                                                                              |
| -------------- | ---------------------- | --------------------- | ---- | -------------------- | ---------------------------------------------------------------------------------- |
| Bacteriology   | `bac_collector`        | Sample Collector      | PASS | PASS                 | page-order OK; restr 7/7                                                           |
| Bacteriology   | `bac_tech`             | Laboratory Technician | PASS | PASS                 | page-order OK; restr 2/2                                                           |
| Bacteriology   | `bac_manager`          | Lab Manager           | PASS | PASS                 | page-order OK; restr 0/0                                                           |
| Bacteriology   | `bac_jr_researcher`    | Junior Researcher     | PASS | PASS                 | page-order OK; restr 7/7                                                           |
| Bacteriology   | `bac_sr_researcher`    | Senior Researcher     | PASS | PASS                 | page-order OK; restr 6/6                                                           |
| Bacteriology   | `bac_biomedical`       | Biomedical Staff      | PASS | PASS                 | page-order OK; restr 9/9                                                           |
| Pathology      | `path_collector`       | Sample Collector      | PASS | PASS                 | FNAC visible stages (9); Restricted 8 matches SRS for Sample Collector; restr 8/12 |
| Pathology      | `path_tech`            | Laboratory Technician | PASS | PASS                 | restr 3/3                                                                          |
| Pathology      | `path_manager`         | Lab Manager           | PASS | PASS                 | restr 0/0                                                                          |
| Pathology      | `path_pathologist`     | Pathologist           | PASS | PASS                 | restr 0/0                                                                          |
| Pathology      | `path_cyto`            | Cytopathologist       | PASS | PASS                 | restr 0/0                                                                          |
| Pathology      | `path_jr_researcher`   | Junior Researcher     | PASS | PASS                 | restr 6/6                                                                          |
| Pathology      | `path_sr_researcher`   | Senior Researcher     | PASS | PASS                 | restr 4/4                                                                          |
| MNTD           | `mntd_collector`       | Sample Collector      | PASS | PASS                 | restr 9/9                                                                          |
| MNTD           | `mntd_technician`      | Laboratory Technician | PASS | PASS                 | restr 3/3                                                                          |
| MNTD           | `mntd_manager`         | Lab Manager           | PASS | PASS                 | restr 0/0                                                                          |
| MNTD           | `mntd_researcher`      | Junior Researcher     | PASS | PASS                 | restr 7/7                                                                          |
| MNTD           | `mntd_senior`          | Senior Researcher     | PASS | PASS                 | restr 5/5                                                                          |
| MNTD           | `mntd_biomedical`      | Biomedical Staff      | PASS | PASS                 | restr 11/11                                                                        |
| Immunology     | `imm_collector`        | Sample Collector      | PASS | PASS                 | restr 9/9                                                                          |
| Immunology     | `imm_tech`             | Laboratory Technician | PASS | PASS                 | restr 2/2                                                                          |
| Immunology     | `imm_manager`          | Lab Manager           | PASS | PASS                 | restr 0/0                                                                          |
| Immunology     | `imm_jr_researcher`    | Junior Researcher     | PASS | PASS                 | restr 5/5                                                                          |
| Immunology     | `imm_sr_researcher`    | Senior Researcher     | PASS | PASS                 | restr 4/4                                                                          |
| Immunology     | `imm_biomedical`       | Biomedical Staff      | PASS | PASS                 | restr 10/10                                                                        |
| Biorepository  | `bio_collector`        | Sample Collector      | PASS | PASS                 | restr 6/6                                                                          |
| Biorepository  | `bio_tech`             | Laboratory Technician | PASS | PASS                 | restr 2/2                                                                          |
| Biorepository  | `bio_manager`          | Lab Manager           | PASS | PASS                 | restr 0/0                                                                          |
| Biorepository  | `bio_jr_researcher`    | Junior Researcher     | PASS | PASS                 | restr 7/7                                                                          |
| Biorepository  | `bio_sr_researcher`    | Senior Researcher     | PASS | PASS                 | restr 6/6                                                                          |
| Biorepository  | `bio_biomedical`       | Biomedical Staff      | PASS | PASS                 | restr 7/7                                                                          |
| TB             | `tb_collector`         | Sample Collector      | PASS | FAIL                 | restr 0/7                                                                          |
| TB             | `tb_tech`              | Laboratory Technician | PASS | PENDING              | Browser Pending/blocked — prod SPA timeouts after instance creation; API green     |
| TB             | `tb_manager`           | Lab Manager           | PASS | PENDING              | Browser Pending/blocked — prod SPA timeouts after instance creation; API green     |
| TB             | `tb_jr_researcher`     | Junior Researcher     | PASS | PENDING              | Browser Pending/blocked — prod SPA timeouts after instance creation; API green     |
| TB             | `tb_sr_researcher`     | Senior Researcher     | PASS | PENDING              | Browser Pending/blocked — prod SPA timeouts after instance creation; API green     |
| TB             | `tb_biomedical`        | Biomedical Staff      | PASS | PENDING              | Browser Pending/blocked — prod SPA timeouts after instance creation; API green     |
| Pharma         | `pharm_collector`      | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Pharma         | `pharm_tech`           | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Pharma         | `pharm_manager`        | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Pharma         | `pharm_jr_researcher`  | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Pharma         | `pharm_sr_researcher`  | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Pharma         | `pharm_biomedical`     | Biomedical Staff      | PASS | FAIL                 |                                                                                    |
| Traditional    | `trad_collector`       | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Traditional    | `trad_tech`            | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Traditional    | `trad_manager`         | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Traditional    | `trad_jr_researcher`   | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Traditional    | `trad_sr_researcher`   | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Traditional    | `trad_biomedical`      | Biomedical Staff      | PASS | FAIL                 |                                                                                    |
| Bioanalytical  | `banal_collector`      | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Bioanalytical  | `banal_tech`           | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Bioanalytical  | `banal_manager`        | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Bioanalytical  | `banal_jr_researcher`  | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Bioanalytical  | `banal_sr_researcher`  | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Bioanalytical  | `banal_biomedical`     | Biomedical Staff      | PASS | FAIL                 |                                                                                    |
| Bioequivalence | `beq_collector`        | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Bioequivalence | `beq_tech`             | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Bioequivalence | `beq_manager`          | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Bioequivalence | `beq_jr_researcher`    | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Bioequivalence | `beq_sr_researcher`    | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Bioequivalence | `beq_biomedical`       | Biomedical Staff      | PASS | FAIL                 |                                                                                    |
| Medlab/CTD     | `medlab_collector`     | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Medlab/CTD     | `medlab_tech`          | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Medlab/CTD     | `medlab_manager`       | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Medlab/CTD     | `medlab_jr_researcher` | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Medlab/CTD     | `medlab_sr_researcher` | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Medlab/CTD     | `medlab_biomedical`    | Biomedical Staff      | PASS | PASS                 | restr 9/10                                                                         |
| Genomics       | `gen_collector`        | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Genomics       | `gen_tech`             | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Genomics       | `gen_manager`          | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Genomics       | `gen_jr_researcher`    | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Genomics       | `gen_sr_researcher`    | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Genomics       | `gen_biomedical`       | Biomedical Staff      | PASS | PASS                 | restr 10/10                                                                        |
| Virology       | `vir_collector`        | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Virology       | `vir_tech`             | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Virology       | `vir_manager`          | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Virology       | `vir_jr_researcher`    | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Virology       | `vir_sr_researcher`    | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Virology       | `vir_biomedical`       | Biomedical Staff      | PASS | FAIL                 |                                                                                    |
| Viral Vaccine  | `vv_collector`         | Sample Collector      | PASS | FAIL                 |                                                                                    |
| Viral Vaccine  | `vv_tech`              | Laboratory Technician | PASS | FAIL                 |                                                                                    |
| Viral Vaccine  | `vv_manager`           | Lab Manager           | PASS | FAIL                 |                                                                                    |
| Viral Vaccine  | `vv_jr_researcher`     | Junior Researcher     | PASS | FAIL                 |                                                                                    |
| Viral Vaccine  | `vv_sr_researcher`     | Senior Researcher     | PASS | FAIL                 |                                                                                    |
| Viral Vaccine  | `vv_biomedical`        | Biomedical Staff      | PASS | FAIL                 |                                                                                    |

## Summary

- **API:** 85/85 PASS
- **Browser (unique user×dept with captured run):** 33 PASS / 47
  FAIL-or-incomplete among 80 captured
- **Bacteriology SRS page-order:** fixed on prod + verified in browser for all
  personas
- **Pathology FNAC:** notebook 220 shows 9 stages (orders 1,2,7–13);
  Pathologist/Cytopathologist/Lab Manager unrestricted; other personas
  Restricted counts match visible stages
- **Blocker:** After creating new instances (235–241), Playwright loads of
  `NoteBookInstanceEditForm` frequently hang with empty `#root` / networkidle
  timeouts. Depts Bac/Path/MNTD/Imm/Bio were verified before that load cliff.
  Re-run `python3 scripts/ahri/run-browser-uat.py <Dept>` when UI is responsive.

## Credentials (quick reference)

Full tables: [`test-users-departments.md`](./test-users-departments.md). Shared
dept passwords:

| Prefix             | Lab unit id     | Password |
| ------------------ | --------------- | -------- |
| `path_*/Pathology` | PathTest!2026   | `176`    |
| `mntd_*`           | adminADMIN!     | `177`    |
| `bac_*`            | BacTest!2026    | `168`    |
| `imm_*`            | ImmTest!2026    | `59`     |
| `bio_*`            | BioTest!2026    | `182`    |
| `tb_*`             | TbTest!2026     | `180`    |
| `pharm_*`          | PharmTest!2026  | `178`    |
| `trad_*`           | TradTest!2026   | `173`    |
| `banal_*`          | BanalTest!2026  | `174`    |
| `beq_*`            | BeqTest!2026    | `175`    |
| `medlab_*`         | MedlabTest!2026 | `303`    |
| `gen_*`            | GenTest!2026    | `172`    |
| `vir_*`            | VirTest!2026    | `203`    |
| `vv_*`             | VvTest!2026     | `179`    |
| `admin`            | AhriAdmin!      | `—`      |
