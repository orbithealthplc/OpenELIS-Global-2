import {
  canEditNotebookEntry,
  getNotebookEntrySaveDisabledReason,
  isPathologyWorkflowType,
  isMntdWorkflowType,
  resolveEffectiveWorkflowType,
} from "./noteBookEntryEditPermissions";
import { Roles } from "../../../constants/roles";

describe("noteBookEntryEditPermissions", () => {
  const labTechRoleCheck = (roles) =>
    roles.includes(Roles.LABORATORY_TECHNICIAN);

  const pathologyPersonaCheck = (personas) =>
    personas.includes(Roles.LABORATORY_TECHNICIAN);

  test("Laboratory Technician on pathology workflow can edit entry", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: pathologyPersonaCheck,
        templateAllowedRoles: ["Technician"],
        userId: 10,
        creatorId: 99,
        technicianId: 88,
        workflowType: "histopathology_biopsy_tissue",
      }),
    ).toBe(true);
  });

  test("Creator bypass allows edit without template role", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: () => false,
        templateAllowedRoles: ["Supervisor"],
        userId: 42,
        creatorId: 42,
        technicianId: null,
        workflowType: "medlab",
      }),
    ).toBe(true);
  });

  test("Technician bypass allows edit without template role", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: () => false,
        templateAllowedRoles: ["Supervisor"],
        userId: 7,
        creatorId: 1,
        technicianId: 7,
        workflowType: "medlab",
      }),
    ).toBe(true);
  });

  test("Fallback CREATE_OR_EDIT_NOTEBOOK_ENTRY roles grant edit when template has no roles", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: labTechRoleCheck,
        hasPersonaForActiveDepartment: () => false,
        templateAllowedRoles: [],
        userId: 10,
        workflowType: "medlab",
      }),
    ).toBe(true);
  });

  test("Sample Collector on MNTD workflow can edit entry", () => {
    const sampleCollectorPersonaCheck = (personas) =>
      personas.includes("Sample Collector");

    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: sampleCollectorPersonaCheck,
        templateAllowedRoles: ["Supervisor"],
        userId: 10,
        creatorId: 99,
        technicianId: 88,
        workflowType: "mntd",
      }),
    ).toBe(true);
  });

  test("isMntdWorkflowType recognizes mntd", () => {
    expect(isMntdWorkflowType("mntd")).toBe(true);
    expect(isMntdWorkflowType("medlab")).toBe(false);
  });

  test("workflow entry creator bypasses template role restriction", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: () => false,
        templateAllowedRoles: ["Supervisor"],
        userId: 10,
        creatorId: 10,
        technicianId: 99,
        workflowType: "mntd",
      }),
    ).toBe(true);
  });

  test("resolveEffectiveWorkflowType prefers instance then template", () => {
    expect(
      resolveEffectiveWorkflowType({ workflowType: "mntd" }, { workflowType: "medlab" }),
    ).toBe("mntd");
    expect(
      resolveEffectiveWorkflowType({ workflowType: null }, { workflowType: "mntd" }),
    ).toBe("mntd");
  });

  test("isPathologyWorkflowType recognizes pathology variants", () => {
    expect(isPathologyWorkflowType("fnac")).toBe(true);
    expect(isPathologyWorkflowType("medlab")).toBe(false);
  });

  test("getNotebookEntrySaveDisabledReason explains view mode", () => {
    const intl = {
      formatMessage: ({ defaultMessage }) => defaultMessage,
    };
    expect(
      getNotebookEntrySaveDisabledReason({
        intl,
        canEditEntry: true,
        isViewMode: true,
      }),
    ).toBe("Open with Edit (not View) to save changes");
  });
});
