# AHRI Notebook Workflow Pages (all departments)

This is the **single index** of AHRI notebook workflow pages as implemented in
the UI.

It is designed to support your **page-first permission design**:

- treat each page as its own permission unit now
- later combine pages into role bundles (personas) per lab unit

## How this was generated (repeatable)

- **Source of truth**: `frontend/src/constants/ahriWorkflowRegistry.js`
  - `REGISTRY_BY_WORKFLOW_TYPE[workflowType]` defines the ordered workflow
    “pages” via `stageOrder` + `stageTitle`
  - `allowedPersonas` is the default persona set per stage (useful starting
    point, not final RBAC)

## Detailed page-by-page (4 departments)

For the “what is done” (SRS-aligned) decomposition per page, see:

- `docs/workflows/ahri-notebook-pages-4-departments.md`

---

## Biorepository (`biorepository`)

1. Sample Intake & Registration
2. Storage Assignment
3. Ongoing Storage and Monitoring
4. Sample Request & Retrieval
5. QC Inspection
6. Reporting & Audit
7. Retention & Disposal

## Immunology (`immunology`)

1. Sample Reception
2. Initial Processing
3. Assays
4. Child Samples
5. Prep
6. Analysis
7. Storage
8. Results
9. Archive
10. Reporting & REDCap

## Bacteriology (`bacteriology`)

1. Sample Reception
2. Laboratory Reception & Verification
3. Temporary Storage Assignment
4. Processing & Quality Control
5. Assay/Test Execution
6. Isolate Creation
7. Post-Analysis Storage
8. Sample Retrieval, Archival & Disposal
9. Reporting & Data Export

## MNTD (`mntd`)

1. Sample Intake / Sample Creation
2. Laboratory Reception & Verification
3. Temporary Storage Assignment
4. Sample Processing Preparation
5. Aliquoting / Bulk Sample Import
6. Processing & Quality Control
7. Test Assignment & Machine Scheduling
8. Test Execution & Raw Data Capture
9. Sample Archiving
10. Data Analysis & Export
11. Reporting & REDCap Integration

## Tuberculosis (`tuberculosis`)

1. Sample Accession & Registration
2. Raw Sample Quality Check (QC)
3. Initial Sample Processing
4. Incubation & Monitoring
5. Test Execution
6. Isolate Storage
7. Disposal & Archiving
8. Reporting

## Pharmaceuticals (`pharmaceutical`)

1. Sample Creation & Full Metadata Capture
2. Raw Sample Quality Check (QC)
3. Sample Processing & Aliquoting
4. Assay & Test Execution
5. Storage & Inventory Management
6. Reporting & Performance Monitoring
7. Disposal & Archiving

## Traditional Medicine (`traditional_medicine`)

1. Sample Intake, Registration & Authentication
2. Sample Storage & Herbarium Placement
3. Sample Preparation for Analysis
4. Extraction, Filtration & Concentration
5. Analytical Pathway
6. Product Development & Testing
7. Formulation of Medical Product
8. Storage, Reporting & Archival

## Bioanalytical (`bioanalytical`)

1. Sample Reception & Registration
2. Test Assignment & Preparation
3. Conduct Analysis / Test
4. Reporting & Release
5. Post-Test Sample & Data Handling

## Bioequivalence (`bioequivalence`)

1. Sample Reception & Registration
2. Test Assignment & Preparation
3. Conduct Analysis / Test
4. Reporting & Release
5. Post-Test Sample & Data Handling

## Pathology (`pathology`)

1. Sample Creation and Metadata Capture
2. Sample Quality Control
3. Gross Examination
4. Cassette Setup
5. Sample Processing
6. Block Creation
7. Slide Preparation
8. Slide Staining
9. Microscopy and Diagnosis
10. Individual Patient Report Preview and Print
11. Storage and Inventory Management
12. Reporting and Performance Monitoring
13. Disposal and Archiving

## Medical Laboratory / Clinical Trial Laboratory (`medlab`)

1. Patient Registration
2. Sample Collection
3. Transport & Packaging
4. Sample Receipt & Quality Assessment
5. Sample Routing
6. Sample Processing
7. Testing & Analyzer
8. Result Entry
9. Validation, Reporting & Performance Monitoring
10. Disposal, Archiving & Accreditation

## GBD (`gbd`)

1. Sample Intake & Registration
2. DNA/RNA Extraction
3. Quality & Quantity Assessment
4. PCR Amplification
5. Gel Electrophoresis
6. Library Preparation
7. Bioanalyzer QC
8. Sequencing
9. Bioinformatics Analysis & Data Submission
10. Storage & Environmental Monitoring

## Genomics (`genomics`)

1. Sample Intake & Registration
2. DNA/RNA Extraction
3. Quality & Quantity Assessment
4. PCR Amplification
5. Gel Electrophoresis
6. Library Preparation
7. Bioanalyzer QC
8. Sequencing
9. Bioinformatics Analysis & Data Submission
10. Storage & Environmental Monitoring

## Virology (`virology`)

1. Sample Intake & Registration
2. DNA/RNA Extraction
3. Quality & Quantity Assessment
4. PCR Amplification
5. Gel Electrophoresis
6. Library Preparation
7. Bioanalyzer QC
8. Sequencing
9. Bioinformatics Analysis & Data Submission
10. Storage & Environmental Monitoring

## Viral Vaccine (`viral_vaccine`)

1. Sample Intake and Registration
2. Media Preparation
3. Cell Culture
4. Quality Control
5. Virus Culture
6. Dark Room Imaging
7. Formulation
8. Feeding
9. Packaging
10. Virus Isolation
11. Titer Measurement
12. Genome Sequencing
13. Seed Virus Production
14. Preclinical & Clinical Trials
