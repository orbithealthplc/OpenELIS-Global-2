# Finished dept browser UAT — 2026-07-15

Prod: https://lims.ahri.gov.et/

Credentials: `scripts/ahri/test-users-departments.md`

## Department totals

- **Bacteriology**: PASS (6/6 personas)
- **Pathology**: PASS (7/7 personas)
- **MNTD**: PASS (6/6 personas)
- **Immunology**: PASS (6/6 personas)
- **Biorepository**: PASS (6/6 personas)
- **Bioanalytical**: PASS (6/6 personas)
- **Bioequivalence**: PASS (6/6 personas)

**Overall:** 43/43 personas PASS

## Persona matrix

| Department     | User                  | Persona               | Browser  | Notes                    |
| -------------- | --------------------- | --------------------- | -------- | ------------------------ |
| Bacteriology   | `bac_collector`       | Sample Collector      | **PASS** | restr 7/7; order_ok=True |
| Bacteriology   | `bac_tech`            | Laboratory Technician | **PASS** | restr 2/2; order_ok=True |
| Bacteriology   | `bac_manager`         | Lab Manager           | **PASS** | restr 0/0; order_ok=True |
| Bacteriology   | `bac_jr_researcher`   | Junior Researcher     | **PASS** | restr 7/7; order_ok=True |
| Bacteriology   | `bac_sr_researcher`   | Senior Researcher     | **PASS** | restr 6/6; order_ok=True |
| Bacteriology   | `bac_biomedical`      | Biomedical Staff      | **PASS** | restr 9/9; order_ok=True |
| Pathology      | `path_collector`      | Sample Collector      | **PASS** | restr 8/8                |
| Pathology      | `path_tech`           | Laboratory Technician | **PASS** | restr 3/3                |
| Pathology      | `path_manager`        | Lab Manager           | **PASS** | restr 0/0                |
| Pathology      | `path_pathologist`    | Pathologist           | **PASS** | restr 0/0                |
| Pathology      | `path_cyto`           | Cytopathologist       | **PASS** | restr 0/0                |
| Pathology      | `path_jr_researcher`  | Junior Researcher     | **PASS** | restr 6/6                |
| Pathology      | `path_sr_researcher`  | Senior Researcher     | **PASS** | restr 4/4                |
| MNTD           | `mntd_collector`      | Sample Collector      | **PASS** | restr 9/9                |
| MNTD           | `mntd_technician`     | Laboratory Technician | **PASS** | restr 3/3                |
| MNTD           | `mntd_manager`        | Lab Manager           | **PASS** | restr 0/0                |
| MNTD           | `mntd_researcher`     | Junior Researcher     | **PASS** | restr 7/7                |
| MNTD           | `mntd_senior`         | Senior Researcher     | **PASS** | restr 5/5                |
| MNTD           | `mntd_biomedical`     | Biomedical Staff      | **PASS** | restr 11/11              |
| Immunology     | `imm_collector`       | Sample Collector      | **PASS** | restr 9/9                |
| Immunology     | `imm_tech`            | Laboratory Technician | **PASS** | restr 2/2                |
| Immunology     | `imm_manager`         | Lab Manager           | **PASS** | restr 0/0                |
| Immunology     | `imm_jr_researcher`   | Junior Researcher     | **PASS** | restr 5/5                |
| Immunology     | `imm_sr_researcher`   | Senior Researcher     | **PASS** | restr 4/4                |
| Immunology     | `imm_biomedical`      | Biomedical Staff      | **PASS** | restr 10/10              |
| Biorepository  | `bio_collector`       | Sample Collector      | **PASS** | restr 6/6                |
| Biorepository  | `bio_tech`            | Laboratory Technician | **PASS** | restr 2/2                |
| Biorepository  | `bio_manager`         | Lab Manager           | **PASS** | restr 0/0                |
| Biorepository  | `bio_jr_researcher`   | Junior Researcher     | **PASS** | restr 7/7                |
| Biorepository  | `bio_sr_researcher`   | Senior Researcher     | **PASS** | restr 6/6                |
| Biorepository  | `bio_biomedical`      | Biomedical Staff      | **PASS** | restr 7/7                |
| Bioanalytical  | `banal_collector`     | Sample Collector      | **PASS** | restr 4/4                |
| Bioanalytical  | `banal_tech`          | Laboratory Technician | **PASS** | restr 1/1                |
| Bioanalytical  | `banal_manager`       | Lab Manager           | **PASS** | restr 0/0                |
| Bioanalytical  | `banal_jr_researcher` | Junior Researcher     | **PASS** | restr 3/3                |
| Bioanalytical  | `banal_sr_researcher` | Senior Researcher     | **PASS** | restr 2/2                |
| Bioanalytical  | `banal_biomedical`    | Biomedical Staff      | **PASS** | restr 5/5                |
| Bioequivalence | `beq_collector`       | Sample Collector      | **PASS** | restr 4/4                |
| Bioequivalence | `beq_tech`            | Laboratory Technician | **PASS** | restr 1/1                |
| Bioequivalence | `beq_manager`         | Lab Manager           | **PASS** | restr 0/0                |
| Bioequivalence | `beq_jr_researcher`   | Junior Researcher     | **PASS** | restr 3/3                |
| Bioequivalence | `beq_sr_researcher`   | Senior Researcher     | **PASS** | restr 2/2                |
| Bioequivalence | `beq_biomedical`      | Biomedical Staff      | **PASS** | restr 5/5                |
