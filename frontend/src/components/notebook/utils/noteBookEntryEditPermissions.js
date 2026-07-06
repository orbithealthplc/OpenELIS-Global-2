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

/** Templates may still expose numeric role IDs; fall back to generic entry roles. */
export const normalizeTemplateAllowedRoles = (roles) => {
  const arr = roles ? (Array.isArray(roles) ? roles : Array.from(roles)) : [];
  if (arr.length === 0) {
    return [];
  }
  if (arr.every((role) => /^\d+$/.test(String(role || "").trim()))) {
    return [];
  }
  return arr;
};

export const NOTEBOOK_ENTRY_EDIT_AUTH_KEY = "notebookEntryEditAuth";

export const readNotebookEntryEditAuth = () => {
  try {
    const raw = sessionStorage.getItem(NOTEBOOK_ENTRY_EDIT_AUTH_KEY);
    if (!raw) {
      return null;
    }
    sessionStorage.removeItem(NOTEBOOK_ENTRY_EDIT_AUTH_KEY);
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

export const stashNotebookEntryEditAuth = (entry) => {
  if (!entry) {
    return;
  }
  sessionStorage.setItem(
    NOTEBOOK_ENTRY_EDIT_AUTH_KEY,
    JSON.stringify({
      creatorId: entry.creatorId ?? null,
      technicianId: entry.technicianId ?? null,
      allowedRoles: entry.allowedRoles ?? [],
      workflowType: entry.workflowType ?? null,
      workflowEntryId: entry.workflowEntryId ?? null,
      instanceNotebookId: entry.instanceNotebookId ?? null,
    }),
  );
};

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

  const normalizedTemplateRoles =
    normalizeTemplateAllowedRoles(templateAllowedRoles);
  const rolesToCheck =
    normalizedTemplateRoles.length > 0
      ? normalizedTemplateRoles
      : fallbackRoles;
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
