import { Permissions, Roles } from "../../../constants/roles";
import {
  sampleProcessingPersonas,
  sampleRegistrationPersonas,
} from "../../../constants/ahriSrsPersonas";
import {
  getRegistryStages,
  normalizeWorkflowType,
  resolvePageAllowedRoles,
} from "../../../constants/ahriWorkflowRegistry";

/**
 * Personas allowed to edit pathology notebook entries.
 * Registration + processing SRS personas, plus clinical Pathologist roles
 * used for microscopy / diagnosis (not in stage-1 intake alone).
 */
export const PATHOLOGY_ENTRY_EDIT_PERSONAS = [
  ...new Set([
    ...sampleRegistrationPersonas,
    ...sampleProcessingPersonas,
    Roles.PATHOLOGIST,
    Roles.CYTOPATHOLOGIST,
  ]),
];

/** @deprecated Prefer getEntryEditPersonasForWorkflow — kept for MNTD tests/callers. */
export const MNTD_ENTRY_EDIT_PERSONAS = [...sampleRegistrationPersonas];

export const normalizeWorkflowTypeKey = (workflowType) =>
  normalizeWorkflowType(workflowType);

export const isPathologyWorkflowType = (workflowType) =>
  normalizeWorkflowType(workflowType) === "pathology";

export const isMntdWorkflowType = (workflowType) =>
  normalizeWorkflowType(workflowType) === "mntd";

/**
 * Intake / registration personas that may create or edit notebook entries for a
 * workflow. Driven by ahri-workflows.csv (stage order 1). Pathology keeps a
 * broader registration+processing set (existing behavior).
 */
export const getEntryEditPersonasForWorkflow = (workflowType) => {
  const key = normalizeWorkflowType(workflowType);
  if (!key || getRegistryStages(key).length === 0) {
    return [];
  }
  if (key === "pathology") {
    return PATHOLOGY_ENTRY_EDIT_PERSONAS;
  }
  const intakePersonas = resolvePageAllowedRoles(key, { order: 1 });
  return intakePersonas.length > 0
    ? intakePersonas
    : [...sampleRegistrationPersonas];
};

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

/** Stable edit intent from URL (avoids stale React mode state during async load). */
export const isEditFromUrl = (notebookEntryId, viewModeParam) =>
  Boolean(notebookEntryId) && viewModeParam !== "view";

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
 * and AHRI workflow-registry intake personas on the active department.
 */
export const canEditNotebookEntry = ({
  hasRoleForCurrentLabUnit,
  hasPersonaForActiveDepartment,
  templateAllowedRoles = [],
  fallbackRoles = Permissions.CREATE_OR_EDIT_NOTEBOOK_ENTRY,
  entryEditPersonas,
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

  if (typeof hasPersonaForActiveDepartment !== "function") {
    return false;
  }

  let personas = entryEditPersonas;
  if (personas == null) {
    personas = isPathologyWorkflowType(workflowType)
      ? pathologyPersonas
      : getEntryEditPersonasForWorkflow(workflowType);
  }

  return personas.length > 0 && hasPersonaForActiveDepartment(personas);
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
