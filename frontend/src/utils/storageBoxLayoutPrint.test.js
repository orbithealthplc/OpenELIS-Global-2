import { buildStorageBoxLayoutPrintHtml } from "./storageBoxLayoutPrint";

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
