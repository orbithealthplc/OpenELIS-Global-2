import {
  canEditNotebookEntry,
  canOpenNotebookEntry,
  getEntryEditPersonasForWorkflow,
  getEntryOpenPersonasForWorkflow,
  getNotebookEntrySaveDisabledReason,
  isPathologyWorkflowType,
} from "./noteBookEntryEditPermissions";
import { Roles } from "../../../constants/roles";

describe("noteBookEntryEditPermissions", () => {
  const labTechRoleCheck = (roles) =>
    roles.includes(Roles.LABORATORY_TECHNICIAN);

  const pathologyPersonaCheck = (personas) =>
    personas.includes(Roles.LABORATORY_TECHNICIAN);

  const jrResearcherPersonaCheck = (personas) =>
    personas.includes(Roles.JUNIOR_RESEARCHER);

  const pathologistPersonaCheck = (personas) =>
    personas.includes(Roles.PATHOLOGIST);

  const biomedicalPersonaCheck = (personas) =>
    personas.includes(Roles.BIOMEDICAL_STAFF);

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

  test("Junior Researcher on bacteriology can edit despite narrow template roles", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: jrResearcherPersonaCheck,
        templateAllowedRoles: ["Technician"],
        userId: 10,
        creatorId: 99,
        technicianId: 88,
        workflowType: "bacteriology",
      }),
    ).toBe(true);
  });

  test("Junior Researcher on bioanalytical can edit entry", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: jrResearcherPersonaCheck,
        templateAllowedRoles: ["Sample Collector"],
        userId: 10,
        creatorId: 99,
        technicianId: 88,
        workflowType: "bioanalytical",
      }),
    ).toBe(true);
  });

  test("Pathologist on pathology workflow can edit entry", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: pathologistPersonaCheck,
        templateAllowedRoles: ["Technician"],
        userId: 10,
        creatorId: 99,
        technicianId: 88,
        workflowType: "pathology",
      }),
    ).toBe(true);
  });

  test("Biomedical Staff without registry stages cannot edit bacteriology", () => {
    expect(
      canEditNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: biomedicalPersonaCheck,
        templateAllowedRoles: ["Technician"],
        userId: 10,
        creatorId: 99,
        technicianId: 88,
        workflowType: "bacteriology",
      }),
    ).toBe(false);
  });

  test("Biomedical Staff can open bacteriology notebook (Restricted stages)", () => {
    expect(
      canOpenNotebookEntry({
        hasRoleForCurrentLabUnit: () => false,
        hasPersonaForActiveDepartment: biomedicalPersonaCheck,
        templateAllowedRoles: ["Technician"],
        userId: 10,
        creatorId: 99,
        technicianId: 88,
        workflowType: "bacteriology",
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

  test("isPathologyWorkflowType recognizes pathology variants", () => {
    expect(isPathologyWorkflowType("fnac")).toBe(true);
    expect(isPathologyWorkflowType("medlab")).toBe(false);
  });

  test("getEntryEditPersonasForWorkflow unions stage personas", () => {
    const personas = getEntryEditPersonasForWorkflow("bacteriology");
    expect(personas).toEqual(
      expect.arrayContaining([
        "Sample Collector",
        "Laboratory Technician",
        "Junior Researcher",
        "Senior Researcher",
        "Lab Manager",
      ]),
    );
    expect(personas).not.toContain("Biomedical Staff");
  });

  test("getEntryOpenPersonasForWorkflow includes Biomedical Staff", () => {
    expect(getEntryOpenPersonasForWorkflow("bacteriology")).toContain(
      "Biomedical Staff",
    );
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
