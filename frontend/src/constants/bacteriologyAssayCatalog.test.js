import {
  BACTERIOLOGY_ANTIBIOTIC_CATALOG,
  buildAntibioticResultsFromSelection,
  findAntibioticOption,
  mergeAssayCatalogWithInventory,
  normalizeAntibioticResults,
} from "./bacteriologyAssayCatalog";

describe("bacteriologyAssayCatalog", () => {
  test("includes all antibiotics from the reference list", () => {
    expect(BACTERIOLOGY_ANTIBIOTIC_CATALOG.length).toBeGreaterThanOrEqual(49);
    expect(
      BACTERIOLOGY_ANTIBIOTIC_CATALOG.some((item) => item.id === "VAN"),
    ).toBe(true);
  });

  test("merges inventory items without duplicating catalog names", () => {
    const merged = mergeAssayCatalogWithInventory(
      BACTERIOLOGY_ANTIBIOTIC_CATALOG,
      [{ id: 99, name: "Vancomycin", text: "Vancomycin" }],
    );

    const vancomycinMatches = merged.filter((item) =>
      (item.name || "").toLowerCase().includes("vancomycin"),
    );
    expect(vancomycinMatches).toHaveLength(1);
    expect(merged.some((item) => item.id === 99)).toBe(false);
  });

  test("normalizes saved antibiotic rows by name", () => {
    const normalized = normalizeAntibioticResults(
      BACTERIOLOGY_ANTIBIOTIC_CATALOG,
      [{ antibiotic: "Vancomycin", zoneDiameter: "18", interpretation: "S" }],
    );

    expect(normalized[0].antibioticId).toBe("VAN");
    expect(
      findAntibioticOption(BACTERIOLOGY_ANTIBIOTIC_CATALOG, normalized[0]),
    ).not.toBeNull();
  });

  test("builds result rows from multi-select", () => {
    const selected = BACTERIOLOGY_ANTIBIOTIC_CATALOG.filter((item) =>
      ["VAN", "GEN"].includes(item.id),
    );
    const results = buildAntibioticResultsFromSelection(selected, [
      { antibioticId: "VAN", antibiotic: "Vancomycin", zoneDiameter: "20" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].zoneDiameter).toBe("20");
    expect(results[1].antibioticId).toBe("GEN");
  });
});
