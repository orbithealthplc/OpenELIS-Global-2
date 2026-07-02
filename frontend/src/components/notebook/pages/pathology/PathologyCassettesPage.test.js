import React from "react";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import PathologyCassettesPage from "./PathologyCassettesPage";
import {
  getFromOpenElisServer,
  postToOpenElisServerJsonResponse,
} from "../../../utils/Utils";

jest.mock("../../../utils/Utils", () => ({
  getFromOpenElisServer: jest.fn(),
  postToOpenElisServerJsonResponse: jest.fn(),
}));

// CRA's react-app/jest preset enables resetMocks, which clears factory
// implementations before each test, so (re)install them in beforeEach.
const installServerMock = () => {
  getFromOpenElisServer.mockImplementation((url, callback) => {
    if (url.includes("/workflow/samples-ready")) {
      callback([
        {
          id: "1",
          accessionNumber: "ACC-1",
          externalId: "EXT-1",
          typeOfSample: { description: "Tissue" },
        },
        {
          id: "2",
          accessionNumber: "ACC-2",
          externalId: "EXT-2",
          typeOfSample: { description: "Tissue" },
        },
      ]);
      return;
    }
    if (url.includes("/page/") && url.includes("/samples")) {
      callback([
        {
          sampleItemId: "1",
          pageStatus: "IN_PROGRESS",
          data: {
            cassettesCreated: true,
            cassetteCount: 2,
            cassetteLabels: ["ACC-1-01", "ACC-1-02"],
            cassettes: [
              { index: 1, label: "ACC-1-01", tissuePieceCount: 3 },
              { index: 2, label: "ACC-1-02", tissuePieceCount: 5 },
            ],
          },
        },
        {
          // Legacy record: only cassetteLabels, no per-cassette tissue data
          sampleItemId: "2",
          pageStatus: "IN_PROGRESS",
          data: {
            cassettesCreated: true,
            cassetteCount: 1,
            cassetteLabels: ["ACC-2-01"],
          },
        },
      ]);
      return;
    }
    callback({ success: true, hasData: false });
  });
};

const renderPage = () =>
  render(
    <IntlProvider locale="en">
      <PathologyCassettesPage
        entryId="entry-1"
        pageData={{ id: 10 }}
        progress={{}}
        onProgressUpdate={jest.fn()}
        notebookId="nb-1"
      />
    </IntlProvider>,
  );

describe("PathologyCassettesPage tissue piece tracking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installServerMock();
    postToOpenElisServerJsonResponse.mockImplementation(() => {});
  });

  test("loads samples-ready for the cassettes step on mount", () => {
    renderPage();

    expect(getFromOpenElisServer).toHaveBeenCalledWith(
      expect.stringContaining("/workflow/samples-ready"),
      expect.any(Function),
    );
  });

  test("renders a Tissue Pieces column in the child cassette tracking table", async () => {
    renderPage();

    // findByText throws if the element is not present, so a truthy result
    // confirms the new column header rendered.
    expect(await screen.findByText("Tissue Pieces")).toBeTruthy();
  });

  test("shows per-cassette tissue piece counts and falls back for legacy records", async () => {
    renderPage();

    // Counts from persisted cassettes[] for sample 1
    expect(await screen.findByText("3")).toBeTruthy();
    expect(await screen.findByText("5")).toBeTruthy();

    // Legacy row (only cassetteLabels) still renders its cassette label
    expect(await screen.findByText("ACC-2-01")).toBeTruthy();
  });
});
