# AHRI Department Super-User Credentials

One super-user per research lab with **all six SRS lab-unit roles** (Sample
Collector, Laboratory Technician, Junior Researcher, Senior Researcher, Lab
Manager, Biomedical Staff) on that department.

Seeded by
[`scripts/populate-department-super-users.sh`](../scripts/populate-department-super-users.sh)
(user IDs **1120–1133**).

**After seeding:** restart `openelisglobal-webapp` and each user must **log out
and log back in**.

| Lab                  | Username         | Password                      | Department (test_section)                                |
| -------------------- | ---------------- | ----------------------------- | -------------------------------------------------------- |
| MNTD                 | `newmntd`        | `newmntdMNTD!`                | Malaria and Neglected Tropical Disease (MNTD) Laboratory |
| Biorepository        | `biorepository`  | `biorepositoryBIO!`           | Biorepository Laboratory                                 |
| TB                   | `tblab`          | `tblabTB!`                    | Tuberculosis Laboratory                                  |
| Bacteriology         | `bacteriology`   | `bacteriologyBACTERIOLOGY!`   | Bacteriology                                             |
| Bioanalytical        | `bioanalytical`  | `bioanalyticalBIOANALYTICAL!` | Bioanalytical Laboratory                                 |
| Immunology           | `immunology`     | `immunologyIMMUNOLOGY!`       | Immunology                                               |
| Pathology            | `pathology`      | `pathologyPATHOLOGY!`         | Pathology Laboratory                                     |
| Pharmaceutical       | `pharma`         | `pharmaPHARMA!`               | Pharmaceuticals Laboratory                               |
| Traditional Medicine | `tmmd`           | `tmmdTMMD!`                   | Traditional & Modern Medicine Research Lab               |
| Viral Vaccine        | `viralvaccine`   | `viralvaccineVIRAL!`          | Viral Vaccine                                            |
| CTD                  | `ctd`            | `ctdCTD!`                     | CTD                                                      |
| Bioequivalence       | `bioequivalence` | `bioequivalenceBIOEQ!`        | Bioequivalence Laboratory                                |
| Genomics             | `genomics`       | `genomicsGENOMICS!`           | Genomics & Bioinformatics Laboratory                     |
| Virology             | `virology`       | `virologyVIROLOGY!`           | Virology Laboratory                                      |

## Local setup

```bash
cd OpenELIS-Global-2
docker exec -i openelisglobal-database psql -U clinlims -d clinlims -f - \
  < scripts/verify-department-notebook-linkage.sql
./scripts/populate-department-super-users.sh
docker restart openelisglobal-webapp
UAT_BASE_URL=https://localhost python3 scripts/verify-department-super-users.py --all
```

## Production setup

If Liquibase is stuck, clear the lock first:

```bash
sudo docker exec openelisglobal-database psql -U clinlims -d clinlims -c \
  "UPDATE clinlims.databasechangeloglock SET locked=false, lockgranted=NULL, lockedby=NULL WHERE id=1;"
```

Then seed and verify:

```bash
cd /opt/OpenELIS-Docker
sudo docker exec -i openelisglobal-database psql -U clinlims -d clinlims -f - \
  < scripts/verify-department-notebook-linkage.sql
sudo bash scripts/populate-department-super-users.sh
sudo docker restart openelisglobal-webapp
# wait 3–5 minutes for startup
UAT_BASE_URL=https://192.168.25.25 python3 scripts/verify-department-super-users.py --all
```

## Automated verification

[`scripts/verify-department-super-users.py`](../scripts/verify-department-super-users.py)
checks login, lab unit selection, notebook hierarchy visibility, and CTD/MNTD
API spot-checks. Results:
[`department-super-user-uat-results.json`](department-super-user-uat-results.json).
