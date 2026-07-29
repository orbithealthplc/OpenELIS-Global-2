import { isDocumentationReady } from "./ShipmentListTable";

describe("ShipmentListTable helpers", () => {
  test("isDocumentationReady_trueForVerifiedAndQuarantine", () => {
    expect(isDocumentationReady("VERIFIED")).toBe(true);
    expect(isDocumentationReady("QUARANTINE")).toBe(true);
  });

  test("isDocumentationReady_falseForPendingAndUnknown", () => {
    expect(isDocumentationReady("PENDING")).toBe(false);
    expect(isDocumentationReady(undefined)).toBe(false);
    expect(isDocumentationReady(null)).toBe(false);
    expect(isDocumentationReady("")).toBe(false);
  });
});
