import { resolvePageAllowedRoles } from "../constants/ahriWorkflowRegistry";
import { sessionHasAnyRole } from "../security/routeAccess";
import { Roles } from "../constants/roles";

describe("MNTD stage access helpers", () => {
  const mntdSession = (labRoles) => ({
    authenticated: true,
    loginLabUnit: "Malaria and Neglected Tropical Disease (MNTD) Laboratory",
    userLabRolesMap: {
      "Malaria and Neglected Tropical Disease (MNTD) Laboratory": labRoles,
    },
    roles: [],
  });

  it("allows Sample Collector on intake via sessionHasAnyRole", () => {
    const personas = resolvePageAllowedRoles("mntd", { order: 1 });
    const session = mntdSession([Roles.SAMPLE_COLLECTOR]);
    expect(sessionHasAnyRole(session, personas)).toBe(true);
  });

  it("allows Lab Manager supervisor override on any stage personas", () => {
    const personas = resolvePageAllowedRoles("mntd", { order: 1 });
    const session = mntdSession([Roles.LAB_MANAGER]);
    expect(sessionHasAnyRole(session, personas)).toBe(true);
  });

  it("denies Junior Researcher on intake", () => {
    const personas = resolvePageAllowedRoles("mntd", { order: 1 });
    const session = mntdSession([Roles.JUNIOR_RESEARCHER]);
    expect(sessionHasAnyRole(session, personas)).toBe(false);
  });

  it("denies when active department is not selected and multiple departments assigned", () => {
    const personas = resolvePageAllowedRoles("mntd", { order: 1 });
    const session = {
      authenticated: true,
      loginLabUnit: null,
      userLabRolesMap: {
        "Malaria and Neglected Tropical Disease (MNTD) Laboratory": [
          Roles.SAMPLE_COLLECTOR,
        ],
        Immunology: [Roles.LABORATORY_TECHNICIAN],
      },
      roles: [],
    };
    expect(sessionHasAnyRole(session, personas)).toBe(false);
  });

  it("allows Senior Researcher on reporting stage 11", () => {
    const personas = resolvePageAllowedRoles("mntd", {
      order: 11,
      pageKey: "reporting",
    });
    const session = mntdSession([Roles.SENIOR_RESEARCHER]);
    expect(sessionHasAnyRole(session, personas)).toBe(true);
  });
});
