import {
  buildStorageBoxLayoutPrintHtml,
  printStorageBoxLayout,
} from "./storageBoxLayoutPrint";

describe("buildStorageBoxLayoutPrintHtml", () => {
  test("includes path line and occupied well labels only", () => {
    const html = buildStorageBoxLayoutPrintHtml({
      pathLabel: "Path:",
      path: "Room A > Freezer 1 > Box 42",
      boxId: 42,
      layout: { "1-1": { externalId: "H-0001", sampleItemId: "99" } },
      rows: 2,
      columns: 2,
      positionSchemaHint: "number-number",
    });

    expect(html).toContain("Path:");
    expect(html).toContain("Room A &gt; Freezer 1 &gt; Box 42");
    expect(html).toContain("H-0001");
    expect(html).toContain("@page { size: landscape");
    expect(html).not.toContain("Retention Period");
  });
});

describe("printStorageBoxLayout", () => {
  test("uses hidden iframe and triggers print", () => {
    const printMock = jest.fn();
    const iframe = {
      style: {},
      contentWindow: {
        document: {
          open: jest.fn(),
          write: jest.fn(),
          close: jest.fn(),
          readyState: "complete",
        },
        focus: jest.fn(),
        print: printMock,
        addEventListener: jest.fn(),
      },
      setAttribute: jest.fn(),
      onload: null,
    };
    const createElement = jest
      .spyOn(document, "createElement")
      .mockReturnValue(iframe);
    const appendChild = jest
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => {});

    jest.spyOn(window, "setTimeout").mockImplementation((fn) => {
      fn();
      return 0;
    });

    expect(
      printStorageBoxLayout({
        path: "Room > Box",
        boxId: 1,
        rows: 2,
        columns: 2,
      }),
    ).toBe(true);
    expect(printMock).toHaveBeenCalled();

    createElement.mockRestore();
    appendChild.mockRestore();
    window.setTimeout.mockRestore();
  });
});
