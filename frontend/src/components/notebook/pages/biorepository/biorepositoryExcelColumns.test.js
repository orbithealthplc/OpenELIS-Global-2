import {
  mapBioSampleToExcelFields,
  normalizeManifestSno,
  parseSpecialHandlingFields,
  sortBioSamplesByManifestSno,
} from "./biorepositoryExcelColumns";
import { mergeMappedRowValues } from "./manifestImportHelpers";

describe("biorepositoryExcelColumns", () => {
  test("normalizeManifestSno parses Excel numeric serial values", () => {
    expect(normalizeManifestSno("1.0")).toBe(1);
    expect(normalizeManifestSno(42)).toBe(42);
    expect(normalizeManifestSno("")).toBeNull();
  });

  test("parseSpecialHandlingFields extracts AHRI storage metadata", () => {
    const fields = parseSpecialHandlingFields(
      "Zone: Zone 1 | Freezer: Freezer 04 | External ID: E1JR0001XS",
    );
    expect(fields.zone).toBe("Zone 1");
    expect(fields.freezerNo).toBe("Freezer 04");
    expect(fields.externalId).toBe("E1JR0001XS");
  });

  test("sortBioSamplesByManifestSno orders by Excel row number", () => {
    const sorted = sortBioSamplesByManifestSno([
      { id: 3, manifestSno: 3 },
      { id: 1, manifestSno: 1 },
      { id: 2, manifestSno: 2 },
    ]);
    expect(sorted.map((sample) => sample.manifestSno)).toEqual([1, 2, 3]);
  });

  test("mapBioSampleToExcelFields maps lab ID from special handling", () => {
    const fields = mapBioSampleToExcelFields({
      barcode: "H-0001",
      specialHandling: "External ID: E1JR0001XS | Zone: Zone 1",
      manifestSno: 1,
      sampleType: { description: "DNA" },
    });
    expect(fields.externalId).toBe("E1JR0001XS");
    expect(fields.zone).toBe("Zone 1");
    expect(fields.manifestSno).toBe(1);
  });
});

describe("manifest import sno alias", () => {
  test("mergeMappedRowValues maps Sr. no header to sno", () => {
    const headers = [
      "Sr. no",
      "Sample_ID",
      "Lab ID",
      "sample type",
      "Transfering_Unit",
      "Project_Name",
      "Request_Date",
    ];
    const values = [
      "1",
      "H-0001",
      "E1JR0001XS",
      "DNA",
      "Bacteriology",
      "HIEPV",
      "02/09/2026",
    ];
    const row = mergeMappedRowValues(headers, values);
    expect(row.sno).toBe("1");
    expect(row.barcode).toBe("H-0001");
    expect(row.externalId).toBe("E1JR0001XS");
  });
});
