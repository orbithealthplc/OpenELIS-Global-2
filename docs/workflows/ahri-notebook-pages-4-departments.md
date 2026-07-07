# AHRI Notebook Pages (4 departments)

This document is a **page-first** decomposition for designing permissions
cleanly.

It is intentionally structured so each page can be assigned permissions
**independently now**, then **combined later** into roles (personas) without
rework.

## How this was derived (repeatable method)

- **Source of truth for pages**: frontend workflow tabs
  (`frontend/src/components/notebook/workflow/*WorkflowTab.js`) which define
  each department’s default page titles.
- **Source of truth for “what is done”**: SRS PDF section text for each
  department (MNTD, Bacteriology, Biorepository, Pathology).
- **Normalization**: when SRS describes multiple activities that the UI splits
  across pages, the activities are distributed to the closest matching page
  title. When the UI merges activities, the page lists multiple “what is done”
  items.
- **Combine later**: each page is tagged with suggested capability labels to
  make later role grouping easy.

### Legend (tags)

- **[INTAKE]** registration/intake/metadata capture
- **[QC]** accept/reject, pass/fail, remarks, corrective actions
- **[STORAGE]** location assignment, monitoring, custody/transfer
- **[PROCESS]** preparation, aliquoting/derivations, lab processing steps
- **[EXECUTE]** test execution, machine interaction, raw outputs
- **[ANALYSIS]** analysis, interpretation, downstream software
- **[REPORT]** reporting, export, REDCap integration, dashboards
- **[DISPOSAL]** retention, disposal, archiving
- **[ADMIN]** SOP/reference content or admin-only controls (if present)

---

## 1) MNTD (Malaria and Neglected Tropical Disease)

**Page titles from**:
`frontend/src/components/notebook/workflow/MNTDWorkflowTab.js`  
**Stages registry**: `frontend/src/constants/ahriWorkflowRegistry.js`
(workflowType `mntd`)

### Page 1 — Sample Intake / Sample Creation **[INTAKE]**

- **What is done**
  - Capture sample/project metadata at arrival and create/identify parent
    sample(s).
  - Support sample identifiers/labels (barcode/name) after registration.
- **Key outputs**
  - Parent sample records, accession/IDs, initial metadata completeness.
- **Dependencies**
  - None (first stage).
- **Combine later**
  - Often combined with Page 2 for a single “Reception” role, but keep separate
    for tighter RBAC.

### Page 2 — Laboratory Reception & Verification **[QC]**

- **What is done**
  - Verify registration details, perform quality assessment (pass/fail / proceed
    with remarks).
  - Notify researcher/bringing person when QC fails (SRS).
- **Key outputs**
  - QC status + remarks + rejection reasons (where applicable).
- **Dependencies**
  - Requires Page 1 sample intake to exist.

### Page 3 — Temporary Storage Assignment **[STORAGE]**

- **What is done**
  - Place samples into temporary storage locations (Room → Freezer → Raw → Rack
    → Box → Well).
  - Record storage placement; temperature monitoring twice daily (SRS).
- **Key outputs**
  - Traceable temporary storage coordinates.

### Page 4 — Sample Processing Preparation **[PROCESS]**

- **What is done**
  - Preparation activities before processing (including sorting/registering
    missed samples).
  - Select reagents/instruments at start of the process (SRS).
- **Key outputs**
  - Preparation records, reagent/instrument selection metadata.

### Page 5 — Aliquoting / Bulk Sample Import **[PROCESS]**

- **What is done**
  - Aliquoting / DBS punching into plates/tubes; controls and multi-project
    plates.
  - Bulk import of samples in plate or cryobox format while maintaining
    parent–child lineage (SRS).
- **Key outputs**
  - Child samples/aliquots linked to parent; plate/box maps; lineage integrity.

### Page 6 — Processing & Quality Control **[PROCESS] [QC]**

- **What is done**
  - Run processing steps and record QC outcomes for integrity/reliability.
  - If QC fails: re-extraction or re-run option (SRS).
  - Record remaining volume / DBS spots left (SRS).
- **Key outputs**
  - Processing logs + QC pass/fail + volume tracking.

### Page 7 — Test Assignment & Machine Scheduling **[EXECUTE]**

- **What is done**
  - Assign tests based on study objective.
  - Schedule machine usage (calendar/time slots) (SRS).
- **Key outputs**
  - Work allocation + machine schedule + planned runs.

### Page 8 — Test Execution & Raw Data Capture **[EXECUTE] [QC]**

- **What is done**
  - Execute tests, capture raw outputs (manual or automated).
  - Post-test QC on results; rerun option on failure (SRS).
  - Log who operated machine and when (SRS).
- **Key outputs**
  - Raw data capture + QC status + auditability.

### Page 9 — Sample Archiving **[DISPOSAL]**

- **What is done**
  - End-of-lifecycle archiving actions (retention or disposal) for MNTD samples
    (SRS mentions archiving/transfer).
- **Key outputs**
  - Archival/disposal decisions and records.

### Page 10 — Data Analysis & Export **[ANALYSIS] [REPORT]**

- **What is done**
  - Data manager analyzes exported data using specialized tools (SRS).
  - Export raw data to LMS where supported (SRS).
- **Key outputs**
  - Analysis outputs ready for integration/reporting.

### Page 11 — Reporting & REDCap Integration **[REPORT]**

- **What is done**
  - Integrate validated final outputs into REDCap for storage and further use
    (SRS).
  - Generate final reporting artifacts.
- **Key outputs**
  - REDCap integration status + final report readiness.

---

## 2) Bacteriology

**Page titles from**:
`frontend/src/components/notebook/workflow/BacteriologyWorkflowTab.js`  
**Stages registry**: `frontend/src/constants/ahriWorkflowRegistry.js`
(workflowType `bacteriology`)

### Page 1 — Sample Reception **[INTAKE]**

- **What is done**
  - Accession/registration of incoming samples + required metadata at arrival
    (SRS).
  - (Often includes manifest/batch intake in practice.)
- **Outputs**
  - Parent sample + metadata completeness.

### Page 2 — Laboratory Reception & Verification **[QC]**

- **What is done**
  - Quality assessment (pass/fail), mandatory rejection reasons, remarks (SRS).
  - Notify researcher/bringing person on failure (SRS).
- **Outputs**
  - QC pass/fail + rejection reasons + disposition notes.

### Page 3 — Temporary Storage Assignment **[STORAGE]**

- **What is done**
  - Temporary storage placement (Room → Freezer → Raw → Rack → Box → Well), temp
    monitoring twice daily (SRS).
- **Outputs**
  - Recorded location for retrieval.

### Page 4 — Processing & Quality Control **[PROCESS] [QC]**

- **What is done**
  - Media preparation + internal QC (sterility/growth support),
    enrichment/incubation (SRS).
  - Processing QC; repeat process if QC fails (SRS).
- **Outputs**
  - Processing logs + QC results.

### Page 5 — Assay/Test Execution **[EXECUTE]**

- **What is done**
  - Gram stain, microscopy, inoculation, isolation/ID, biochemical tests (SRS).
  - DST methods (disc diffusion, microdilution, AST strip), automated ID/AST
    (SRS).
  - Molecular techniques (extraction, PCR, WGS) (SRS).
- **Outputs**
  - Test execution records + instrument outputs where applicable.

### Page 6 — Isolate Creation **[PROCESS]**

- **What is done**
  - Create/track isolates and derived aliquots; maintain parent–child
    relationships (SRS “Sample/Aliquotes Tracking”).
- **Outputs**
  - Isolate records linked to original samples.

### Page 7 — Post-Analysis Storage **[STORAGE]**

- **What is done**
  - Long-term storage placement; record exact placement and monitoring (SRS).
- **Outputs**
  - Storage coordinates + monitoring data.

### Page 8 — Sample Retrieval, Archival & Disposal **[DISPOSAL] [STORAGE]**

- **What is done**
  - Retrieval for shipping/retesting; disposal criteria and methods (SRS).
  - Transfer to biorepository for future use when applicable (SRS).
- **Outputs**
  - Chain-of-custody + disposal logs.

### Page 9 — Reporting & Data Export **[REPORT] [ANALYSIS]**

- **What is done**
  - Results validation/review/approval and reporting (SRS).
  - Export raw data to LMS if supported; data manager analysis; integrate
    outputs to REDCap (SRS).
- **Outputs**
  - Approved results + exports.

---

## 3) Biorepository

**Page titles from**:
`frontend/src/components/notebook/workflow/BiorepositoryWorkflowTab.js`  
**Stages registry**: `frontend/src/constants/ahriWorkflowRegistry.js`
(workflowType `biorepository`)

### Page 1 — Sample Intake & Registration **[INTAKE] [QC]**

- **What is done**
  - Verify documentation completeness (identifiers, project linkage,
    ethics/consent, MTA, biosafety packaging) (SRS).
  - Register minimum metadata (source, PI, dates, sample type, storage medium,
    retention policy, conditions, arrival condition, receiving personnel) (SRS).
  - Generate/validate immutable barcodes; preserve parent–child lineage; secure
    documentation archival (SRS).
- **Outputs**
  - Biorepository registration records + barcodes + lineage.

### Page 2 — Storage Assignment **[STORAGE]**

- **What is done**
  - Assign storage environment; enforce segregation; digital hierarchical
    mapping.
  - Box layout/digital view placement; scan-based verification; dual
    verification for critical samples (SRS).
  - Record storage unit metadata and qualification/calibration history (SRS).
- **Outputs**
  - Verified storage coordinates + equipment/stability metadata.

### Page 3 — Ongoing Storage and Monitoring **[STORAGE]**

- **What is done**
  - Temperature monitoring and alerts; custody history
    (transfers/withdrawals/returns) with timestamps (SRS).
  - Maintenance/calibration events linked to units (SRS).
- **Outputs**
  - Monitoring logs + alert trail + custody trail.

### Page 4 — Sample Request & Retrieval **[STORAGE]**

- **What is done**
  - Digital request workflow; validate authorization/project/ethics/availability
    (SRS).
  - Generate retrieval work orders with coordinates; log release condition;
    update custody status; chain-of-custody for transfers (SRS).
- **Outputs**
  - Approved requests + retrieval logs + custody updates.

### Page 5 — QC Inspection **[QC]**

- **What is done**
  - Scheduled/random QC; generate QC layout sheets; physical verification;
    record discrepancies and corrective actions; escalation and archiving (SRS).
- **Outputs**
  - QC outcomes + discrepancy/corrective action tracking.

### Page 6 — Reporting & Audit **[REPORT]**

- **What is done**
  - Dashboard summaries (capacity/utilization, aging/expiration, QC trends,
    retrieval/disposal stats) and immutable audit trail (SRS).
- **Outputs**
  - Reports, audit exports.

### Page 7 — Retention & Disposal **[DISPOSAL]**

- **What is done**
  - Enforce retention policies, alert near limits, perform disposal with
    signatures/timestamps and evidence retention (SRS).
- **Outputs**
  - Retention/disposal records and evidence.

---

## 4) Pathology

**Page titles from**:
`frontend/src/components/notebook/workflow/PathologyWorkflowTab.js`

> Note: Pathology supports multiple internal workflow types; the UI normalizes
> them into a canonical 1–13 order.

### Page 1 — Sample Creation and Metadata Capture **[INTAKE]**

- **What is done**
  - Register clinical or research specimen metadata; assign unique lab accession
    number; capture receiving staff and timestamps (SRS).

### Page 2 — Sample Quality Control **[QC]**

- **What is done**
  - Initial inspection and specimen-type checks
    (fixation/container/clots/consent) (SRS).
  - Tissue block QC post-embedding; document actions and escalation (SRS).

### Page 3 — Gross Examination **[PROCESS]**

- **What is done**
  - Gross exam/description/sectioning (pathologist or assistant) (SRS).

### Page 4 — Cassette Setup **[PROCESS]**

- **What is done**
  - Cassette creation/setup and tracking (implied by pathology processing chain;
    aligns to SRS processing/logbook requirements).

### Page 5 — Sample Processing **[PROCESS]**

- **What is done**
  - Tissue processing through alcohols/xylene/paraffin embedding; cytology
    processing and cell blocks; research SOP processing (SRS).
  - Manual tracking in processing logbook (SRS).

### Page 6 — Block Creation **[PROCESS]**

- **What is done**
  - Block creation/embedding outputs and QC continuation (SRS block QC details).

### Page 7 — Slide Preparation **[PROCESS]**

- **What is done**
  - Microtomy sections; prepare smears; label slide IDs; maintain parent-child
    links (SRS).

### Page 8 — Slide Staining **[EXECUTE] [QC]**

- **What is done**
  - Routine/special stains; advanced techniques (IHC/ICC/ISH) with controls
    (SRS).

### Page 9 — Microscopy and Diagnosis **[EXECUTE] [ANALYSIS]**

- **What is done**
  - Microscopy review and diagnosis; clinical verification by certified
    pathologist (SRS).

### Page 10 — Individual Patient Report Preview and Print **[REPORT]**

- **What is done**
  - Generate/preview/print individual reports (SRS
    reporting/records/signatures).

### Page 11 — Storage and Inventory Management **[STORAGE]**

- **What is done**
  - Store blocks/slides/residual material/frozen samples; maintain exact
    location logbook; retrieval signatures; environmental monitoring twice daily
    (SRS).

### Page 12 — Reporting and Performance Monitoring **[REPORT]**

- **What is done**
  - Monthly metrics (volume/TAT/rejection/QC meetings, downtime) (SRS).

### Page 13 — Disposal and Archiving **[DISPOSAL]**

- **What is done**
  - Disposal per policy with logbook + approvals; archive physical and digital
    records (SRS).
