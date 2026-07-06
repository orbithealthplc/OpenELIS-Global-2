/**
 * Regression: MNTD Sample Collector can open workflow entry edit form
 * without "no permission" redirect (matches dashboard Edit behavior).
 */
import LoginPage from "../pages/LoginPage";

const loginPage = new LoginPage();
const PASSWORD = "adminADMIN!";
const API_BASE = "/OpenELIS-Global";

function loginAs(username) {
  cy.session(
    `mntd-edit-${username}`,
    () => {
      loginPage.visit();
      cy.get("body", { timeout: 30000 }).then(($body) => {
        if (!$body.find("#loginName").length) {
          cy.contains("Login", { timeout: 30000 }).click({ force: true });
        }
      });
      cy.get("#loginName", { timeout: 120000 }).should("be.visible");
      loginPage.clearInputs();
      loginPage.enterUsername(username);
      loginPage.enterPassword(PASSWORD);
      loginPage.signIn();
      cy.url({ timeout: 60000 }).should("not.include", "/login");
    },
    { cacheAcrossSpecs: false },
  );
}

describe("MNTD notebook edit form permission", () => {
  beforeEach(() => {
    loginAs("mntd_collector");
    cy.request({
      method: "POST",
      url: `${API_BASE}/rest/setUserLoginLabUnit/191`,
      failOnStatusCode: false,
    });
  });

  it("opens workflow entry edit form without permission redirect", () => {
    cy.request(`${API_BASE}/rest/notebook/dashboard/entries?noteBookId=2`).then(
      (resp) => {
        const entry = (resp.body || []).find(
          (row) => row.workflowEntryId && row.instanceNotebookId,
        );
        expect(entry, "workflow dashboard entry").to.exist;

        const url = `/NoteBookInstanceEditForm/${entry.instanceNotebookId}?mode=edit&tab=workflow&entryId=${entry.workflowEntryId}`;
        cy.visit(url, { timeout: 120000 });

        cy.url({ timeout: 30000 }).should("include", "NoteBookInstanceEditForm");
        cy.url().should("not.include", "NoteBookDashboard");
        cy.contains(/need permission to create or edit notebook entries/i).should(
          "not.exist",
        );
        cy.get(".page-navigation .page-item", { timeout: 60000 }).should(
          "have.length.at.least",
          1,
        );
      },
    );
  });
});
