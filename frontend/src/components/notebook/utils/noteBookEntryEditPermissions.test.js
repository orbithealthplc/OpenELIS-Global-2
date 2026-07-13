import {
  canEditNotebookEntry,
  getEntryEditPersonasForWorkflow,
  getNotebookEntrySaveDisabledReason,
  isEditFromUrl,
  isMntdWorkflowType,
  isPathologyWorkflowType,
  normalizeTemplateAllowedRoles,
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
        templateAllowedRoles: ["Supervisor"],
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

  test.each([
    "biorepository",
    "immunology",
    "bacteriology",
    "tuberculosis",
    "medlab",
    "virology",
    "genomics",
  ])(
    "Sample Collector on %s workflow can edit entry via registry intake personas",
    (workflowType) => {
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
          workflowType,
        }),
      ).toBe(true);
    },
  );

  test("getEntryEditPersonasForWorkflow uses registry stage 1 for non-pathology", () => {
    const mntd = getEntryEditPersonasForWorkflow("mntd");
    expect(mntd).toContain("Sample Collector");
    expect(mntd).toContain("Laboratory Technician");

    const immuno = getEntryEditPersonasForWorkflow("immunology");
    expect(immuno).toContain("Sample Collector");
    expect(immuno).toContain("Laboratory Technician");
  });

  test("getEntryEditPersonasForWorkflow keeps pathology registration+processing set", () => {
    const pathology = getEntryEditPersonasForWorkflow("fnac");
    expect(pathology).toContain("Sample Collector");
    expect(pathology).toContain("Junior Researcher");
    expect(pathology).toContain("Senior Researcher");
    expect(pathology).toContain("Pathologist");
    expect(pathology).toContain("Cytopathologist");
  });

  test("Pathologist can edit pathology entries via persona bypass", () => {
    const pathologistPersonaCheck = (personas) =>
      personas.includes("Pathologist");

    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: pathologistPersonaCheck,
        templateAllowedRoles: ["Sample Collector"],
        userId: 10,
        workflowType: "pathology",
      }),
    ).toBe(true);
  });

  test("Cytopathologist can edit pathology entries via persona bypass", () => {
    const cytoPersonaCheck = (personas) =>
      personas.includes("Cytopathologist");

    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: cytoPersonaCheck,
        templateAllowedRoles: ["Sample Collector"],
        userId: 10,
        workflowType: "fnac",
      }),
    ).toBe(true);
  });

  test("unknown workflow types get no persona bypass", () => {
    expect(getEntryEditPersonasForWorkflow("unknown_lab")).toEqual([]);
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: () => true,
        templateAllowedRoles: ["Supervisor"],
        userId: 10,
        workflowType: "unknown_lab",
      }),
    ).toBe(false);
  });

  test("normalizeTemplateAllowedRoles treats numeric role IDs as unresolved", () => {
    expect(normalizeTemplateAllowedRoles(["83", "42"])).toEqual([]);
    expect(normalizeTemplateAllowedRoles(["Sample Collector"])).toEqual([
      "Sample Collector",
    ]);
  });

  test("Sample Collector uses fallback when template stores numeric role IDs", () => {
    const sampleCollectorRoleCheck = (roles) =>
      roles.includes(Roles.SAMPLE_COLLECTOR);

    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: sampleCollectorRoleCheck,
        hasPersonaForActiveDepartment: () => false,
        templateAllowedRoles: ["83"],
        userId: 10,
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
      resolveEffectiveWorkflowType(
        { workflowType: "mntd" },
        { workflowType: "medlab" },
      ),
    ).toBe("mntd");
    expect(
      resolveEffectiveWorkflowType(
        { workflowType: null },
        { workflowType: "mntd" },
      ),
    ).toBe("mntd");
  });

  test("isEditFromUrl detects edit mode from URL params", () => {
    expect(isEditFromUrl("228", "edit")).toBe(true);
    expect(isEditFromUrl("228", "view")).toBe(false);
    expect(isEditFromUrl(null, "edit")).toBe(false);
    expect(isEditFromUrl("228", null)).toBe(true);
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
