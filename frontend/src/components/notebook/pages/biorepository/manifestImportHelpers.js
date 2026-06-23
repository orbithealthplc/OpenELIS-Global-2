/**
 * Pure helpers for biorepository manifest import (legacy AHRI Excel + CSV).
 */

export const MANIFEST_FIELDS = [
  "sno",
  "barcode",
  "externalId",
  "sampleType",
  "projectId",
  "originLab",
  "receiptDate",
  "requiredTempMin",
  "requiredTempMax",
  "biosafetyLevel",
  "collectionDate",
  "principalInvestigator",
  "consentId",
  "ethicsApprovalRef",
  "mtaReference",
  "preservationMedium",
  "arrivalCondition",
  "specialHandling",
];

/** Legacy convertLegacyWorksheetRows output omits sno; keep indices aligned. */
export const LEGACY_MANIFEST_FIELDS = MANIFEST_FIELDS.filter(
  (field) => field !== "sno",
);

/**
 * True when the worksheet uses the full AHRI Excel template (Sr. no + storage columns).
 * These sheets must use header-based parsing, not convertLegacyWorksheetRows.
 */
export const isFullAhriManifestSheet = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }

  const rawHeaders = rows[0];
  if (!Array.isArray(rawHeaders)) {
    return false;
  }

  const mappedHeaders = rawHeaders.map(
    (header) => HEADER_ALIASES[normalizeHeaderToken(header)] || null,
  );

  if (mappedHeaders.includes("sno")) {
    return true;
  }

  return rawHeaders.some(
    (header) => STORAGE_METADATA_ALIASES[normalizeHeaderToken(header)],
  );
};

export const HEADER_ALIASES = {
  sno: "sno",
  sn: "sno",
  srno: "sno",
  serialno: "sno",
  serialnumber: "sno",
  serial: "sno",
  rowno: "sno",
  rownumber: "sno",
  no: "sno",
  barcode: "barcode",
  sampleid: "barcode",
  samplebarcode: "barcode",
  externalid: "externalId",
  labid: "externalId",
  sampletype: "sampleType",
  samplegiventobiorepository: "biorepositorySampleType",
  sampletypeid: "sampleType",
  projectid: "projectId",
  projectname: "projectId",
  originlab: "originLab",
  transferingunit: "originLab",
  receiptdate: "receiptDate",
  requestdate: "receiptDate",
  transferdate: "collectionDate",
  requiredtempmin: "requiredTempMin",
  requiredtempmax: "requiredTempMax",
  storagetemperature: "storageTemperaturePreset",
  storagepreset: "storageTemperaturePreset",
  temperaturerequirement: "storageTemperaturePreset",
  biosafetylevel: "biosafetyLevel",
  collectiondate: "collectionDate",
  principalinvestigator: "principalInvestigator",
  consentid: "consentId",
  ethicsapprovalref: "ethicsApprovalRef",
  mtareference: "mtaReference",
  preservationmedium: "preservationMedium",
  preservativeormedium: "preservationMedium",
  arrivalcondition: "arrivalCondition",
  samplecondition: "arrivalCondition",
  specialhandling: "specialHandling",
  notes: "specialHandling",
  comments: "specialHandling",
  volume: "volume",
};

/** Unmapped AHRI template columns preserved in specialHandling notes. */
export const STORAGE_METADATA_ALIASES = {
  zone: "Zone",
  freezerno: "Freezer",
  shelfno: "Shelf",
  rackno: "Rack",
  boxno: "Box",
  location: "Location",
  coordinate: "Coordinate",
  qcstatus: "QC Status",
  deviationorincident: "Deviation",
  transferredby: "Transferred By",
  transferreason: "Transfer Reason",
  transferbatchnumber: "Transfer Batch",
  receivedby: "Received by",
  approvalsign: "Approval/Sign",
};

export const FIRST_WINS_MANIFEST_FIELDS = new Set([
  "receiptDate",
  "barcode",
  "externalId",
]);

export const normalizeHeaderToken = (header) =>
  String(header || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Normalize common manifest date strings to yyyy-MM-dd or yyyy-MM-dd HH:mm:ss.
 */
export const normalizeDateValue = (value, allowTime = true) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }

  const dotDateTime = trimmed.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dotDateTime) {
    const [, dd, mm, yyyy, hh, min, sec] = dotDateTime;
    const datePart = `${yyyy}-${mm}-${dd}`;
    if (hh !== undefined && allowTime) {
      return `${datePart} ${pad2(hh)}:${pad2(min)}:${pad2(sec || "00")}`;
    }
    return datePart;
  }

  const slashDateTime = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (slashDateTime) {
    const [, mm, dd, yyyy, hh, min, sec] = slashDateTime;
    const datePart = `${yyyy}-${mm}-${dd}`;
    if (hh !== undefined && allowTime) {
      return `${datePart} ${pad2(hh)}:${pad2(min)}:${pad2(sec || "00")}`;
    }
    return datePart;
  }

  const dashDateTime = trimmed.match(
    /^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dashDateTime) {
    const [, dd, mm, yyyy, hh, min, sec] = dashDateTime;
    const datePart = `${yyyy}-${mm}-${dd}`;
    if (hh !== undefined && allowTime) {
      return `${datePart} ${pad2(hh)}:${pad2(min)}:${pad2(sec || "00")}`;
    }
    return datePart;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.replace("T", " ");
  }

  return trimmed;
};

export const normalizeCellValue = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }
  const normalizedDate = normalizeDateValue(trimmed, true);
  if (
    normalizedDate !== trimmed &&
    isSupportedDateValue(normalizedDate, true)
  ) {
    return normalizedDate;
  }
  return trimmed;
};

export const isSupportedDateValue = (value, allowTime = false) => {
  if (!value) {
    return false;
  }

  const patterns = allowTime
    ? [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{2}\/\d{2}\/\d{4}[ T]\d{2}:\d{2}(:\d{2})?$/,
        /^\d{2}-\d{2}-\d{4}$/,
        /^\d{2}-\d{2}-\d{4}[ T]\d{2}:\d{2}(:\d{2})?$/,
        /^\d{2}\.\d{2}\.\d{4}$/,
        /^\d{2}\.\d{2}\.\d{4}[ T]\d{2}:\d{2}(:\d{2})?$/,
      ]
    : [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{2}-\d{2}-\d{4}$/,
        /^\d{2}\.\d{2}\.\d{4}$/,
      ];

  return patterns.some((pattern) => pattern.test(value));
};

export const firstNonEmptyValue = (...values) =>
  values.find(
    (value) =>
      value !== undefined && value !== null && String(value).trim() !== "",
  ) || "";

export const formatCurrentReceiptDate = () =>
  new Date().toISOString().slice(0, 19).replace("T", " ");

/**
 * Map raw header row + values into manifest row object.
 * receiptDate keeps first non-empty; storage columns go to _storageNotes.
 */
export const mergeMappedRowValues = (rawHeaders, values) => {
  const row = {};
  const storageParts = [];

  rawHeaders.forEach((rawHeader, index) => {
    const token = normalizeHeaderToken(rawHeader);
    const mappedField = HEADER_ALIASES[token];
    const storageLabel = STORAGE_METADATA_ALIASES[token];
    const nextValue = normalizeCellValue(values[index]);

    if (!nextValue) {
      return;
    }

    if (mappedField) {
      if (FIRST_WINS_MANIFEST_FIELDS.has(mappedField) && row[mappedField]) {
        return;
      }
      if (row[mappedField] && !nextValue) {
        return;
      }
      row[mappedField] = row[mappedField] || nextValue;
      return;
    }

    if (storageLabel) {
      storageParts.push(`${storageLabel}: ${nextValue}`);
    }
  });

  if (storageParts.length > 0) {
    row._storageNotes = storageParts.join(" | ");
  }

  if (
    row.storageTemperaturePreset &&
    !row.requiredTempMin &&
    !row.requiredTempMax
  ) {
    const presetRange = resolveStorageTemperaturePreset(
      row.storageTemperaturePreset,
    );
    if (presetRange) {
      row.requiredTempMin = presetRange.min;
      row.requiredTempMax = presetRange.max;
    }
  }

  return row;
};

export const buildSpecialHandlingNotes = (row) =>
  [
    row.specialHandling,
    row._storageNotes,
    row.volume && row.volume.toLowerCase() !== "sufficient"
      ? `Volume: ${row.volume}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

/** Compose special-handling notes for single-entry intake (matches bulk import). */
export const buildSingleEntrySpecialHandling = ({
  specialHandling,
  volume,
  receiverName,
  approvalSign,
}) => {
  const custodyParts = [];
  if (receiverName?.trim()) {
    custodyParts.push(`Received by: ${receiverName.trim()}`);
  }
  if (approvalSign?.trim()) {
    custodyParts.push(`Approval/Sign: ${approvalSign.trim()}`);
  }

  const baseHandling = [specialHandling?.trim(), custodyParts.join(" | ")]
    .filter(Boolean)
    .join(" | ");

  return buildSpecialHandlingNotes({
    specialHandling: baseHandling,
    volume: volume?.trim() || "",
  });
};

export const resolveStorageTemperaturePreset = (value) => {
  const normalized = normalizeCellValue(value).toUpperCase().replace(/\s/g, "");
  if (
    normalized === "FROZEN_150" ||
    normalized === "-150" ||
    normalized === "-150C" ||
    normalized === "150C" ||
    normalized === "VAPORPHASE"
  ) {
    return { min: "-196", max: "-150" };
  }
  return null;
};

export const inferLegacyTemperatureRange = (sampleType, sheetName) => {
  const normalized = `${sampleType || ""} ${sheetName || ""}`.toLowerCase();

  if (normalized.includes("pbmc") || normalized.includes("cell line")) {
    return { min: "-196", max: "-150" };
  }

  if (
    normalized.includes("ffpe") ||
    normalized.includes("block") ||
    normalized.includes("paraffin")
  ) {
    return { min: "20", max: "25" };
  }

  return { min: "-80", max: "-20" };
};

export const inferLegacyBiosafetyLevel = (sampleType, sheetName) => {
  const normalized = `${sampleType || ""} ${sheetName || ""}`.toLowerCase();
  if (
    normalized.includes("bacter") ||
    normalized.includes("culture") ||
    normalized.includes("isolate") ||
    normalized.includes("pseudomonas") ||
    normalized.includes("k.") ||
    normalized.includes("e. coli") ||
    normalized.includes("staph") ||
    normalized.includes("enterococcus")
  ) {
    return "BSL_2";
  }
  return "BSL_2";
};

export const normalizeLegacyDuplicateBarcodes = (rows) => {
  const seen = new Map();

  return rows.map((row) => {
    const normalizedRow = Array.isArray(row) ? [...row] : row;
    const barcode = normalizeCellValue(normalizedRow[0]);

    if (!barcode) {
      return normalizedRow;
    }

    const seenCount = seen.get(barcode) || 0;
    seen.set(barcode, seenCount + 1);

    if (seenCount === 0) {
      normalizedRow[1] = normalizeCellValue(normalizedRow[1]) || barcode;
      return normalizedRow;
    }

    const duplicateIndex = seenCount + 1;
    normalizedRow[0] = `${barcode}-R${duplicateIndex}`;
    normalizedRow[1] = normalizeCellValue(normalizedRow[1]) || barcode;

    const duplicateNote = `Original Sample ID: ${barcode}`;
    const existingSpecialHandling = normalizeCellValue(normalizedRow[16]);
    normalizedRow[16] = existingSpecialHandling
      ? `${existingSpecialHandling} | ${duplicateNote}`
      : duplicateNote;

    return normalizedRow;
  });
};

export const convertLegacyWorksheetRows = (rows, sheetName) => {
  const normalizedRows = rows
    .map((row) =>
      Array.isArray(row) ? row.map((value) => normalizeCellValue(value)) : [],
    )
    .filter((row) => row.some((value) => value !== ""));

  if (normalizedRows.length < 2) {
    return [];
  }

  const rawHeaders = normalizedRows[0];
  const mappedHeaders = rawHeaders.map(
    (header) => HEADER_ALIASES[normalizeHeaderToken(header)] || null,
  );

  const looksLegacyWorkbook =
    mappedHeaders.includes("barcode") &&
    mappedHeaders.includes("originLab") &&
    mappedHeaders.includes("projectId");

  if (!looksLegacyWorkbook) {
    return [];
  }

  const convertedRows = [];

  for (let i = 1; i < normalizedRows.length; i++) {
    const values = normalizedRows[i];
    const row = mergeMappedRowValues(rawHeaders, values);
    const sampleType = firstNonEmptyValue(
      row.biorepositorySampleType,
      row.sampleType,
    );
    const barcode = row.barcode || "";
    if (!barcode) {
      continue;
    }

    const tempRange = inferLegacyTemperatureRange(sampleType, sheetName);
    const receiptDate = normalizeDateValue(
      firstNonEmptyValue(
        row.receiptDate,
        row.collectionDate,
        formatCurrentReceiptDate(),
      ),
      true,
    );
    const collectionDate = normalizeDateValue(row.collectionDate, false);

    convertedRows.push([
      barcode,
      row.externalId,
      sampleType,
      row.projectId,
      row.originLab,
      receiptDate,
      firstNonEmptyValue(row.requiredTempMin, tempRange.min),
      firstNonEmptyValue(row.requiredTempMax, tempRange.max),
      firstNonEmptyValue(
        row.biosafetyLevel,
        inferLegacyBiosafetyLevel(sampleType, sheetName),
      ),
      collectionDate,
      row.principalInvestigator,
      row.consentId,
      row.ethicsApprovalRef,
      row.mtaReference,
      row.preservationMedium,
      row.arrivalCondition,
      buildSpecialHandlingNotes(row),
    ]);
  }

  return convertedRows;
};

export const DUPLICATE_ISSUE = {
  NONE: "NONE",
  IN_MANIFEST: "IN_MANIFEST",
  IN_DATABASE: "IN_DATABASE",
};

export const isDuplicateWarningMessage = (message) => {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.startsWith("duplicate sample id in manifest:") ||
    normalized.startsWith("sample id already exists:")
  );
};

export const parseDuplicateSampleId = (message) => {
  const detail = String(message || "");
  const colonIndex = detail.indexOf(":");
  if (colonIndex < 0) {
    return detail.trim();
  }
  return detail.slice(colonIndex + 1).trim();
};

export const buildSuffixedBarcode = (baseBarcode, replicaIndex) =>
  `${baseBarcode}-R${replicaIndex}`;

export const resolveUniqueBarcodePreview = (
  baseBarcode,
  reservedInBatch = new Set(),
  existingInDb = new Set(),
) => {
  const normalized = normalizeCellValue(baseBarcode);
  if (!normalized) {
    return normalized;
  }
  if (!reservedInBatch.has(normalized) && !existingInDb.has(normalized)) {
    return normalized;
  }

  let replicaIndex = 2;
  let candidate = buildSuffixedBarcode(normalized, replicaIndex);
  while (reservedInBatch.has(candidate) || existingInDb.has(candidate)) {
    replicaIndex += 1;
    candidate = buildSuffixedBarcode(normalized, replicaIndex);
  }
  return candidate;
};

export const getDuplicateIssueType = (duplicateIssue, messages = []) => {
  if (duplicateIssue && duplicateIssue !== DUPLICATE_ISSUE.NONE) {
    return duplicateIssue;
  }
  if (!messages.some(isDuplicateWarningMessage)) {
    return DUPLICATE_ISSUE.NONE;
  }
  const manifestMessage = messages.find((message) =>
    String(message)
      .toLowerCase()
      .startsWith("duplicate sample id in manifest:"),
  );
  if (manifestMessage) {
    return DUPLICATE_ISSUE.IN_MANIFEST;
  }
  return DUPLICATE_ISSUE.IN_DATABASE;
};

export const partitionDuplicateMessages = (messages = []) => {
  const duplicateMessages = [];
  const hardErrors = [];

  messages.forEach((message) => {
    if (isDuplicateWarningMessage(message)) {
      duplicateMessages.push(message);
    } else {
      hardErrors.push(message);
    }
  });

  return { duplicateMessages, hardErrors };
};

export const reclassifyLegacyDuplicateValidationRows = (rows = []) =>
  rows.map((row) => {
    if (!row) {
      return row;
    }
    const { duplicateMessages, hardErrors } = partitionDuplicateMessages(
      row.errors || [],
    );
    const duplicateIssue = getDuplicateIssueType(row.duplicateIssue, [
      ...(row.warnings || []),
      ...duplicateMessages,
    ]);
    const warnings = [...(row.warnings || []), ...duplicateMessages];

    return {
      ...row,
      errors: hardErrors,
      warnings,
      duplicateIssue,
      valid: hardErrors.length === 0,
    };
  });

export const reconcileCrossBatchManifestDuplicates = (samples, rows) => {
  const seenBarcodes = new Set();

  const reconciledRows = rows.map((row, index) => {
    const sample = samples[index] || {};
    const barcode = normalizeCellValue(
      firstNonEmptyValue(sample.barcode, sample.externalId),
    );
    if (!barcode) {
      return row;
    }

    const updatedRow = { ...row };
    if (seenBarcodes.has(barcode)) {
      if (
        !updatedRow.duplicateIssue ||
        updatedRow.duplicateIssue === DUPLICATE_ISSUE.NONE
      ) {
        updatedRow.duplicateIssue = DUPLICATE_ISSUE.IN_MANIFEST;
        updatedRow.warnings = [...(updatedRow.warnings || [])];
        updatedRow.warnings.push(`Duplicate sample ID in manifest: ${barcode}`);
      }
      if (!updatedRow.errors || updatedRow.errors.length === 0) {
        updatedRow.valid = true;
      }
    } else {
      seenBarcodes.add(barcode);
    }

    return updatedRow;
  });

  return reclassifyLegacyDuplicateValidationRows(reconciledRows);
};

export const computeDuplicateImportPreviews = (
  rows,
  duplicateApprovals = {},
  existingBarcodes = new Set(),
) => {
  const reserved = new Set();
  const previews = {};

  rows.forEach((row) => {
    const barcode = normalizeCellValue(
      firstNonEmptyValue(row.barcode, row.externalId),
    );
    if (!barcode) {
      return;
    }

    const isDuplicate = row._isDuplicate;
    const approved = Boolean(duplicateApprovals[row._rowNumber]);

    if (isDuplicate) {
      const resolved = resolveUniqueBarcodePreview(
        barcode,
        reserved,
        existingBarcodes,
      );
      previews[row._rowNumber] = resolved;
      if (approved) {
        reserved.add(resolved);
      }
      return;
    }

    reserved.add(barcode);
  });

  return previews;
};
