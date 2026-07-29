import { resolvePageAllowedRoles } from "./ahriWorkflowRegistry";

describe("MNTD workflow registry personas", () => {
  it("includes Lab Manager on intake and reception stages", () => {
    const intake = resolvePageAllowedRoles("mntd", {
      order: 1,
      pageKey: "intake",
    });
    const reception = resolvePageAllowedRoles("mntd", {
      order: 2,
      pageKey: "lab_reception",
    });
    expect(intake).toContain("Sample Collector");
    expect(intake).toContain("Laboratory Technician");
    expect(intake).toContain("Lab Manager");
    expect(reception).toContain("Lab Manager");
  });

  it("includes Lab Manager on processing stages 4-8", () => {
    for (const order of [4, 5, 6, 7, 8]) {
      const roles = resolvePageAllowedRoles("mntd", { order });
      expect(roles).toContain("Lab Manager");
    }
  });

  it("defines stage 11 reporting personas", () => {
    const roles = resolvePageAllowedRoles("mntd", {
      order: 11,
      pageKey: "reporting",
    });
    expect(roles).toContain("Lab Manager");
    expect(roles).toContain("Senior Researcher");
  });

  it("does not grant biomedical staff notebook stage access", () => {
    const intake = resolvePageAllowedRoles("mntd", { order: 1 });
    expect(intake).not.toContain("Biomedical Staff");
  });
});
