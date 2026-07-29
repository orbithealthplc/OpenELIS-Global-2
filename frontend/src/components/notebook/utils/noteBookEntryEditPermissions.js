import { Permissions } from "../../../constants/roles";
import {
  getRegistryStages,
  normalizeWorkflowType,
} from "../../../constants/ahriWorkflowRegistry";

/** Pathology specialty titles used at AHRI (in addition to SRS lab personas). */
export const PATHOLOGY_SPECIALTY_PERSONAS = ["Pathologist", "Cytopathologist"];

export const normalizeWorkflowTypeKey = (workflowType) =>
  normalizeWorkflowType(workflowType);

export const isPathologyWorkflowType = (workflowType) =>
  normalizeWorkflowTypeKey(workflowType) === "pathology";

/**
 * Personas allowed to open a notebook entry/instance in edit mode for a workflow.
 * Union of all SRS stage personas for that workflow (+ Lab Manager).
 * Stage Restricted still applies inside the workflow tab.
 */
export const getEntryEditPersonasForWorkflow = (workflowType) => {
  const stages = getRegistryStages(workflowType);
  const personas = new Set();
  for (const stage of stages) {
    for (const persona of stage.allowedPersonas || []) {
      if (persona) {
        personas.add(persona);
      }
    }
  }
  // Supervisor override — always present even if CSV omits a stage
  personas.add("Lab Manager");
  if (isPathologyWorkflowType(workflowType)) {
    for (const persona of PATHOLOGY_SPECIALTY_PERSONAS) {
      personas.add(persona);
    }
  }
  return [...personas];
};

/**
 * Personas allowed to open a notebook instance (view workflow / Restricted tags).
 * Includes Biomedical Staff even when they have no editable SRS stages — equipment
 * persona may open the notebook; stage Restricted still blocks page edits.
 */
export const getEntryOpenPersonasForWorkflow = (workflowType) => {
  const personas = new Set(getEntryEditPersonasForWorkflow(workflowType));
  personas.add("Biomedical Staff");
  return [...personas];
};

/** @deprecated Prefer getEntryEditPersonasForWorkflow — kept for existing tests/imports */
export const PATHOLOGY_ENTRY_EDIT_PERSONAS =
  getEntryEditPersonasForWorkflow("pathology");

const idsMatch = (left, right) =>
  left != null && right != null && String(left) === String(right);

const hasRegistryPersonaAccess = ({
  hasPersonaForActiveDepartment,
  workflowType,
  personas,
}) =>
  personas.length > 0 &&
  typeof hasPersonaForActiveDepartment === "function" &&
  hasPersonaForActiveDepartment(personas);

/**
 * Whether the current user may open a notebook entry (dashboard / deep link).
 * Broader than {@link canEditNotebookEntry} — Biomedical Staff can open.
 */
export const canOpenNotebookEntry = ({
  hasRoleForCurrentLabUnit,
  hasPersonaForActiveDepartment,
  templateAllowedRoles = [],
  fallbackRoles = Permissions.CREATE_OR_EDIT_NOTEBOOK_ENTRY,
  userId,
  creatorId,
  technicianId,
  workflowType,
}) => {
  if (
    canEditNotebookEntry({
      hasRoleForCurrentLabUnit,
      hasPersonaForActiveDepartment,
      templateAllowedRoles,
      fallbackRoles,
      userId,
      creatorId,
      technicianId,
      workflowType,
    })
  ) {
    return true;
  }
  return hasRegistryPersonaAccess({
    hasPersonaForActiveDepartment,
    workflowType,
    personas: getEntryOpenPersonasForWorkflow(workflowType),
  });
};

/**
 * Whether the current user may edit a notebook entry (Save button / dashboard Edit).
 * If a persona is allowed on ANY stage of the workflow, they can open edit mode;
 * stage-level Restricted still limits which pages they can change.
 */
export const canEditNotebookEntry = ({
  hasRoleForCurrentLabUnit,
  hasPersonaForActiveDepartment,
  templateAllowedRoles = [],
  fallbackRoles = Permissions.CREATE_OR_EDIT_NOTEBOOK_ENTRY,
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

  return hasRegistryPersonaAccess({
    hasPersonaForActiveDepartment,
    workflowType,
    personas: getEntryEditPersonasForWorkflow(workflowType),
  });
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
