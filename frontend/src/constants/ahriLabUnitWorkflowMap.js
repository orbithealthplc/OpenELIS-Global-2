/**
 * Map AHRI lab-unit / test-section display names to workflowType keys
 * (from ahri-workflows.csv departmentName column).
 */
const LAB_NAME_TO_WORKFLOW = {
  "biorepository laboratory": "biorepository",
  immunology: "immunology",
  "immunology laboratory": "immunology",
  bacteriology: "bacteriology",
  "bacteriology laboratory": "bacteriology",
  "malaria and neglected tropical disease (mntd) laboratory": "mntd",
  "tuberculosis laboratory": "tuberculosis",
  "pharmaceuticals laboratory": "pharmaceutical",
  "traditional & modern medicine research lab": "traditional_medicine",
  "bioanalytical laboratory": "bioanalytical",
  "bioequivalence laboratory": "bioequivalence",
  "pathology laboratory": "pathology",
  ctd: "medlab",
  "ctd department": "medlab",
  "medical laboratory": "medlab",
  "genomics & bioinformatics laboratory": "gbd",
  "virology laboratory": "virology",
  "viral vaccine": "viral_vaccine",
};

function normalizeLabName(name) {
  if (!name) return "";
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {string} labUnitName test section display name
 * @returns {string} workflowType or ""
 */
export function getWorkflowTypeForLabUnitName(labUnitName) {
  return LAB_NAME_TO_WORKFLOW[normalizeLabName(labUnitName)] || "";
}

export { LAB_NAME_TO_WORKFLOW };
