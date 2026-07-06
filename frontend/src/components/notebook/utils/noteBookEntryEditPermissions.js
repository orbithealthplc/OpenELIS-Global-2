import { Permissions } from "../../../constants/roles";
import {
  sampleProcessingPersonas,
  sampleRegistrationPersonas,
} from "../../../constants/ahriSrsPersonas";

const PATHOLOGY_WORKFLOW_TYPE_IDS = new Set([
  "pathology",
  "histopathology_biopsy_tissue",
  "peripheral_smear_bone_marrow_morphology",
  "fnac",
  "cytology_liquid_based_pap_smear",
]);

/** SRS lab personas allowed to edit pathology notebook entries (workflow registry). */
export const PATHOLOGY_ENTRY_EDIT_PERSONAS = [
  ...new Set([...sampleRegistrationPersonas, ...sampleProcessingPersonas]),
];

export const normalizeWorkflowTypeKey = (workflowType) =>
  String(workflowType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export const isPathologyWorkflowType = (workflowType) =>
  PATHOLOGY_WORKFLOW_TYPE_IDS.has(normalizeWorkflowTypeKey(workflowType));

const MNTD_WORKFLOW_TYPE_IDS = new Set(["mntd"]);

/** SRS personas that may edit MNTD notebook entries (intake / registration stages). */
export const MNTD_ENTRY_EDIT_PERSONAS = [...sampleRegistrationPersonas];

export const isMntdWorkflowType = (workflowType) =>
  MNTD_WORKFLOW_TYPE_IDS.has(normalizeWorkflowTypeKey(workflowType));

/** Prefer instance workflow type, then parent template. */
export const resolveEffectiveWorkflowType = (
  data = {},
  templateData = null,
) => {
  const direct = String(data?.workflowType || "").trim();
  if (direct) {
    return direct;
  }
  return String(templateData?.workflowType || "").trim();
};

const idsMatch = (left, right) =>
  left != null && right != null && String(left) === String(right);

/**
 * Whether the current user may edit a notebook entry (Save button / dashboard Edit).
 * Mirrors backend entry-update rules: template roles, fallback roles, creator/technician,
 * and AHRI pathology personas on the active department.
 */
export const canEditNotebookEntry = ({
  hasRoleForCurrentLabUnit,
  hasPersonaForActiveDepartment,
  templateAllowedRoles = [],
  fallbackRoles = Permissions.CREATE_OR_EDIT_NOTEBOOK_ENTRY,
  pathologyPersonas = PATHOLOGY_ENTRY_EDIT_PERSONAS,
  userId,
  creatorId,
  technicianId,
  workflowType,
}) => {
  if (typeof hasRoleForCurrentLabUnit !== "function") {
    return false;
  }

  if (idsMatch(userId, creatorId) || idsMatch(userId, technicianId)) {
    return true;
  }

  const rolesToCheck =
    templateAllowedRoles.length > 0 ? templateAllowedRoles : fallbackRoles;
  if (hasRoleForCurrentLabUnit(rolesToCheck)) {
    return true;
  }

  const resolvedWorkflowType = normalizeWorkflowTypeKey(workflowType);

  if (
    isPathologyWorkflowType(resolvedWorkflowType) &&
    typeof hasPersonaForActiveDepartment === "function" &&
    hasPersonaForActiveDepartment(pathologyPersonas)
  ) {
    return true;
  }

  if (
    isMntdWorkflowType(resolvedWorkflowType) &&
    typeof hasPersonaForActiveDepartment === "function" &&
    hasPersonaForActiveDepartment(MNTD_ENTRY_EDIT_PERSONAS)
  ) {
    return true;
  }

  return false;
};

export const getNotebookEntrySaveDisabledReason = ({
  intl,
  canEditEntry,
  isViewMode,
}) => {
  if (isViewMode) {
    return intl.formatMessage({
      id: "notebook.permission.entry.save.viewMode",
      defaultMessage: "Open with Edit (not View) to save changes",
    });
  }
  if (!canEditEntry) {
    return intl.formatMessage({
      id: "notebook.permission.entry.edit.required",
      defaultMessage: "You need permission to create or edit notebook entries",
    });
  }
  return undefined;
};
