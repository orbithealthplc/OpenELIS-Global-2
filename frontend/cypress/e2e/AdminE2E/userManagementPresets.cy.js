import LoginPage from "../../pages/LoginPage";

describe("User Management presets", () => {
  it("applies a lab-unit permission preset", () => {
    const loginPage = new LoginPage();
    loginPage.visit();
    const homePage = loginPage.goToHomePage();
    const adminPage = homePage.goToAdminPage();
    const userManagement = adminPage.goToUserManagementPage();

    userManagement.verifyPageTitle();
    userManagement.clickAddButton();
    userManagement.validatePageTitle();

    const username = `preset${Date.now().toString(36)}`
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 18);
    cy.get("#login-name").clear().type(username);
    cy.get("#login-password").clear().type("Preset123!");
    cy.get("#login-repeat-password").clear().type("Preset123!");
    cy.get("#first-name").clear().type("Preset");
    cy.get("#last-name").clear().type("User");
    cy.get("#password-expire-date")
      .find("input")
      .clear({ force: true })
      .type("01/01/2035", { force: true });
    cy.get("body").click(0, 0);
    cy.get("#login-timeout").clear().type("450");
    cy.get("[for='radio-2']").click(); // not locked
    cy.get("[for='radio-4']").click(); // enabled
    cy.get("[for='radio-5']").click(); // active

    // Apply preset: prefer MNTD lab unit, otherwise fall back.
    cy.get("[data-cy='preset-test-section']")
      .find("option")
      .then(($options) => {
        const texts = [...$options].map((o) => o.textContent || "");
        const mntdText =
          texts.find((t) => /mntd|malaria/i.test(t)) ||
          texts.find(
            (t) => !/select/i.test(t) && !/all\s*lab\s*units/i.test(t),
          );

        if (mntdText) {
          cy.get("[data-cy='preset-test-section']").select(mntdText);
        } else {
          cy.get("[data-cy='preset-test-section']").select(1);
        }
      });
    cy.get("[data-cy='preset-lab-role']").select("Laboratory Technician");
    cy.get("[data-cy='preset-apply']").click();
    cy.wait(300);

    // Verify a permission row exists and the lab role is checked.
    cy.contains("label", "Laboratory Technician")
      .closest(".cds--checkbox-wrapper")
      .find("input[type='checkbox']")
      .should("be.checked");

    // Saving is covered by the existing AdminE2E userManagement.cy.js spec.
    // Here we verify the preset correctly updates the Lab Unit Roles UI state.
    cy.get("[data-cy='saveButton']").should("not.be.disabled");
  });
});
