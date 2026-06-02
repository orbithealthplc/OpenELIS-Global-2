import { normalizeLastQCInspection } from "./BiorepositoryQCInspectionPage";

describe("normalizeLastQCInspection", () => {
  it("normalizes inspectionDate from lastQCDate fallback", () => {
    const normalized = normalizeLastQCInspection({
      id: 1,
      qcResult: "DISCREPANCY_FOUND",
      lastQCDate: "2026-06-02T10:00:00.000Z",
    });

    expect(normalized.inspectionDate).toBe("2026-06-02T10:00:00.000Z");
    expect(normalized.lastQCDate).toBe("2026-06-02T10:00:00.000Z");
  });

  it("returns null for empty inspection payload", () => {
    expect(normalizeLastQCInspection(null)).toBeNull();
    expect(normalizeLastQCInspection(undefined)).toBeNull();
  });
});
