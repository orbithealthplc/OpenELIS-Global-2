/**
 * Regression: MNTD Sample Collector can open workflow entry edit form
 * via dashboard Edit click (sessionStorage stash + URL edit mode).
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

  it("opens workflow entry edit form from dashboard Edit without permission error", () => {
    cy.request(`${API_BASE}/rest/notebook/dashboard/notebooks`).then(
      (notebooksResp) => {
        const notebook = (notebooksResp.body || []).find((nb) => nb.id === 2);
        expect(notebook, "MNTD notebook template").to.exist;

        cy.request(
          `${API_BASE}/rest/notebook/dashboard/entries?noteBookId=2`,
        ).then((resp) => {
          const entry = (resp.body || []).find(
            (row) => row.workflowEntryId && row.instanceNotebookId,
          );
          expect(entry, "workflow dashboard entry").to.exist;

          cy.visit("/NoteBookDashboard", { timeout: 120000 });
          cy.intercept("GET", "**/rest/notebook/dashboard/entries*").as(
            "dashboardEntries",
          );

          cy.contains(notebook.title, { timeout: 60000 })
            .should("be.visible")
            .click({ force: true });

          cy.wait("@dashboardEntries", { timeout: 60000 });

          cy.contains("button", /edit/i, { timeout: 60000 })
            .not("[disabled]")
            .first()
            .click({ force: true });

          cy.url({ timeout: 30000 }).should(
            "include",
            "NoteBookInstanceEditForm",
          );
          cy.url().should("not.include", "NoteBookDashboard");
          cy.contains(
            /need permission to create or edit notebook entries/i,
          ).should("not.exist");
          cy.get(".page-navigation .page-item", { timeout: 60000 }).should(
            "have.length.at.least",
            1,
          );
        });
      },
    );
  });

  it("opens workflow entry edit form via direct URL without permission redirect", () => {
    cy.request(`${API_BASE}/rest/notebook/dashboard/entries?noteBookId=2`).then(
      (resp) => {
        const entry = (resp.body || []).find(
          (row) => row.workflowEntryId && row.instanceNotebookId,
        );
        expect(entry, "workflow dashboard entry").to.exist;

        const url = `/NoteBookInstanceEditForm/${entry.instanceNotebookId}?mode=edit&tab=workflow&entryId=${entry.workflowEntryId}`;
        cy.visit(url, { timeout: 120000 });

        cy.url({ timeout: 30000 }).should(
          "include",
          "NoteBookInstanceEditForm",
        );
        cy.url().should("not.include", "NoteBookDashboard");
        cy.contains(
          /need permission to create or edit notebook entries/i,
        ).should("not.exist");
        cy.get(".page-navigation .page-item", { timeout: 60000 }).should(
          "have.length.at.least",
          1,
        );
      },
    );
  });
});
