import {
  convertLegacyWorksheetRows,
  isSupportedDateValue,
  mergeMappedRowValues,
  normalizeDateValue,
  resolveUniqueBarcodePreview,
  isDuplicateWarningMessage,
  reconcileCrossBatchManifestDuplicates,
  computeDuplicateImportPreviews,
  reclassifyLegacyDuplicateValidationRows,
  partitionDuplicateMessages,
  buildSingleEntrySpecialHandling,
  DUPLICATE_ISSUE,
} from "./manifestImportHelpers";

describe("manifestImportHelpers", () => {
  test("normalizeDateValue converts European dot dates", () => {
    expect(normalizeDateValue("11.02.2026")).toBe("2026-02-11");
    expect(normalizeDateValue("11.02.2026 14:30")).toBe("2026-02-11 14:30:00");
  });

  test("isSupportedDateValue accepts normalized European dates", () => {
    expect(isSupportedDateValue("2026-02-11", false)).toBe(true);
    expect(isSupportedDateValue("11.02.2026", false)).toBe(true);
  });

  test("mergeMappedRowValues keeps Request_Date as receiptDate when Transfer_Date present", () => {
    const headers = [
      "Request_Date",
      "Transfering_Unit",
      "Project_Name",
      "sample type",
      "Sample_ID",
      "Transfer_Date",
    ];
    const values = [
      "02/09/2026",
      "Bacteriology",
      "HIEPV",
      "DNA",
      "H-0001",
      "11.02.2026",
    ];

    const row = mergeMappedRowValues(headers, values);
    expect(row.receiptDate).toBe("2026-02-09");
    expect(row.collectionDate).toBe("2026-02-11");
    expect(row.barcode).toBe("H-0001");
  });

  test("convertLegacyWorksheetRows produces zero invalid receipt dates for AHRI template row", () => {
    const rows = [
      [
        "Request_Date",
        "Transfering_Unit",
        "Project_Name",
        "sample type",
        "Sample_ID",
        "Transfer_Date",
      ],
      ["02/09/2026", "Bacteriology", "HIEPV", "DNA", "H-0001", "11.02.2026"],
    ];

    const converted = convertLegacyWorksheetRows(rows, "HIEPVBacteriology");
    expect(converted).toHaveLength(1);
    expect(converted[0][6]).toBe("2026-02-09");
    expect(converted[0][10]).toBe("2026-02-11");
    expect(isSupportedDateValue(converted[0][6], true)).toBe(true);
  });

  test("resolveUniqueBarcodePreview keeps original barcode for duplicates", () => {
    const reserved = new Set(["PAT-001"]);
    expect(resolveUniqueBarcodePreview("PAT-001", reserved, new Set())).toBe(
      "PAT-001",
    );
  });

  test("isDuplicateWarningMessage detects duplicate warnings", () => {
    expect(
      isDuplicateWarningMessage("Duplicate sample ID in manifest: BIO-001"),
    ).toBe(true);
    expect(isDuplicateWarningMessage("Sample type is required")).toBe(false);
  });

  test("reconcileCrossBatchManifestDuplicates flags later batches", () => {
    const samples = [
      { barcode: "BIO-001", externalId: "BIO-001" },
      { barcode: "BIO-001", externalId: "BIO-001" },
    ];
    const rows = [
      { valid: true, warnings: [], errors: [] },
      { valid: true, warnings: [], errors: [] },
    ];

    const reconciled = reconcileCrossBatchManifestDuplicates(samples, rows);
    expect(reconciled[1].duplicateIssue).toBe(DUPLICATE_ISSUE.IN_MANIFEST);
    expect(reconciled[1].warnings[0]).toContain("BIO-001");
  });

  test("reclassifyLegacyDuplicateValidationRows converts duplicate errors to warnings", () => {
    const rows = [
      {
        valid: false,
        errors: ["Sample ID already exists: H-0001"],
        warnings: [],
      },
    ];

    const reclassified = reclassifyLegacyDuplicateValidationRows(rows);
    expect(reclassified[0].valid).toBe(true);
    expect(reclassified[0].errors).toEqual([]);
    expect(reclassified[0].warnings[0]).toContain("H-0001");
    expect(reclassified[0].duplicateIssue).toBe(DUPLICATE_ISSUE.IN_DATABASE);
  });

  test("partitionDuplicateMessages separates hard errors from duplicate errors", () => {
    const { duplicateMessages, hardErrors } = partitionDuplicateMessages([
      "Sample ID already exists: H-0002",
      "Origin lab is required",
    ]);

    expect(duplicateMessages).toHaveLength(1);
    expect(hardErrors).toEqual(["Origin lab is required"]);
  });

  test("computeDuplicateImportPreviews keeps original barcode", () => {
    const rows = [
      { _rowNumber: 1, barcode: "BIO-001", _isDuplicate: false },
      { _rowNumber: 2, barcode: "BIO-001", _isDuplicate: true },
    ];

    const previews = computeDuplicateImportPreviews(rows, { 2: true });
    expect(previews[2]).toBe("BIO-001");
  });

  test("buildSingleEntrySpecialHandling composes custody and volume notes", () => {
    const notes = buildSingleEntrySpecialHandling({
      specialHandling: "Handle with care",
      volume: "insufficient",
      receiverName: "Abay A.",
      approvalSign: "AAA",
    });

    expect(notes).toContain("Handle with care");
    expect(notes).toContain("Received by: Abay A.");
    expect(notes).toContain("Approval/Sign: AAA");
    expect(notes).toContain("Volume: insufficient");
  });

  test("buildSingleEntrySpecialHandling omits sufficient volume note", () => {
    const notes = buildSingleEntrySpecialHandling({
      specialHandling: "",
      volume: "sufficient",
      receiverName: "Open ELIS",
      approvalSign: "",
    });

    expect(notes).toBe("Received by: Open ELIS");
  });
});
