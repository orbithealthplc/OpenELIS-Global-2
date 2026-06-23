/**
 * AHRI biorepository Excel template column registry.
 * Matches: Bac_Sample submission and deposition template (Sr. no → Lab ID).
 */

export const AHRI_EXCEL_COLUMNS = [
  {
    key: "manifestSno",
    excelHeader: "Sr. no",
    stages: ["import", "reception", "storage", "detail"],
  },
  {
    key: "receiptDate",
    excelHeader: "Request_Date",
    stages: ["reception", "detail"],
  },
  {
    key: "originLab",
    excelHeader: "Transfering_Unit",
    stages: ["import", "reception", "storage", "detail"],
  },
  {
    key: "transferBatchNumber",
    excelHeader: "Transfer batch number",
    stages: ["detail"],
  },
  {
    key: "projectId",
    excelHeader: "Project_Name",
    stages: ["import", "reception", "storage", "detail"],
  },
  {
    key: "sampleType",
    excelHeader: "sample type",
    stages: ["import", "reception", "storage", "detail"],
  },
  {
    key: "barcode",
    excelHeader: "Sample_ID",
    stages: ["import", "reception", "storage", "detail"],
  },
  {
    key: "arrivalCondition",
    excelHeader: "Sample_Condition",
    stages: ["detail"],
  },
  { key: "volume", excelHeader: "Volume", stages: ["detail"] },
  { key: "zone", excelHeader: "Zone", stages: ["detail"] },
  { key: "freezerNo", excelHeader: "Freezer_No", stages: ["detail"] },
  { key: "shelfNo", excelHeader: "Shelf_No.", stages: ["detail"] },
  { key: "rackNo", excelHeader: "Rack_No.", stages: ["detail"] },
  { key: "boxNo", excelHeader: "Box_No.", stages: ["detail"] },
  { key: "location", excelHeader: "Location", stages: ["detail"] },
  { key: "qcStatus", excelHeader: "QC_Status", stages: ["detail"] },
  {
    key: "deviationOrIncident",
    excelHeader: "Deviation_or_Incident",
    stages: ["detail"],
  },
  { key: "collectionDate", excelHeader: "Transfer_Date", stages: ["detail"] },
  { key: "transferredBy", excelHeader: "Transferred_By", stages: ["detail"] },
  { key: "transferReason", excelHeader: "Transfer_Reason", stages: ["detail"] },
  { key: "receivedBy", excelHeader: "Received by", stages: ["detail"] },
  { key: "approvalSign", excelHeader: "Approval/sign", stages: ["detail"] },
  {
    key: "externalId",
    excelHeader: "Lab ID",
    stages: ["import", "reception", "storage", "detail"],
  },
];

const RECEPTION_COLUMN_KEYS = [
  "manifestSno",
  "barcode",
  "externalId",
  "sampleType",
  "projectId",
  "originLab",
  "receiptDate",
  "workflowStatus",
];

const MESSAGE_IDS = {
  manifestSno: "biorepository.excel.column.srNo",
  receiptDate: "biorepository.excel.column.requestDate",
  originLab: "biorepository.excel.column.transferingUnit",
  transferBatchNumber: "biorepository.excel.column.transferBatchNumber",
  projectId: "biorepository.excel.column.projectName",
  sampleType: "biorepository.excel.column.sampleType",
  barcode: "biorepository.excel.column.sampleId",
  arrivalCondition: "biorepository.excel.column.sampleCondition",
  volume: "biorepository.excel.column.volume",
  zone: "biorepository.excel.column.zone",
  freezerno: "biorepository.excel.column.freezerNo",
  shelfNo: "biorepository.excel.column.shelfNo",
  rackNo: "biorepository.excel.column.rackNo",
  boxNo: "biorepository.excel.column.boxNo",
  location: "biorepository.excel.column.location",
  qcStatus: "biorepository.excel.column.qcStatus",
  deviationOrIncident: "biorepository.excel.column.deviationOrIncident",
  collectionDate: "biorepository.excel.column.transferDate",
  transferredBy: "biorepository.excel.column.transferredBy",
  transferReason: "biorepository.excel.column.transferReason",
  receivedBy: "biorepository.excel.column.receivedBy",
  approvalSign: "biorepository.excel.column.approvalSign",
  externalId: "biorepository.excel.column.labId",
  workflowStatus: "biorepository.sample.field.status",
};

export const normalizeManifestSno = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const normalized = String(value).trim().replace(/\.0+$/, "");
  const parsed = parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseSpecialHandlingFields = (specialHandling) => {
  const fields = {};
  if (!specialHandling) {
    return fields;
  }

  String(specialHandling)
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const colonIndex = part.indexOf(":");
      if (colonIndex === -1) {
        return;
      }
      const label = part.slice(0, colonIndex).trim();
      const value = part.slice(colonIndex + 1).trim();
      fields[label] = value;

      switch (label) {
        case "Zone":
          fields.zone = value;
          break;
        case "Freezer":
          fields.freezerNo = value;
          break;
        case "Shelf":
          fields.shelfNo = value;
          break;
        case "Rack":
          fields.rackNo = value;
          break;
        case "Box":
          fields.boxNo = value;
          break;
        case "Location":
          fields.location = value;
          break;
        case "Coordinate":
          fields.location = value;
          fields.coordinate = value;
          break;
        case "QC Status":
          fields.qcStatus = value;
          break;
        case "Deviation":
          fields.deviationOrIncident = value;
          break;
        case "Transferred By":
          fields.transferredBy = value;
          break;
        case "Transfer Reason":
          fields.transferReason = value;
          break;
        case "Transfer Batch":
          fields.transferBatchNumber = value;
          break;
        case "Received by":
          fields.receivedBy = value;
          break;
        case "Approval/Sign":
          fields.approvalSign = value;
          break;
        case "External ID":
          fields.externalId = value;
          fields.labId = value;
          break;
        case "Volume":
          fields.volume = value;
          break;
        default:
          break;
      }
    });

  return fields;
};

export const extractLabId = (sample) => {
  if (sample?.externalId && sample.externalId !== sample?.barcode) {
    return sample.externalId;
  }
  const parsed = parseSpecialHandlingFields(sample?.specialHandling);
  return parsed.externalId || parsed.labId || "";
};

const formatDateValue = (value, includeTime = false) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  if (includeTime) {
    return date.toLocaleString();
  }
  return date.toLocaleDateString();
};

export const mapBioSampleToExcelFields = (sample) => {
  const parsed = parseSpecialHandlingFields(sample?.specialHandling);
  const labId = extractLabId(sample);

  return {
    manifestSno: sample?.manifestSno ?? null,
    receiptDate: sample?.receiptDate,
    originLab: sample?.originLab || parsed.originLab || "",
    transferBatchNumber: parsed.transferBatchNumber || "",
    projectId: sample?.projectId || "",
    sampleType: sample?.sampleType?.description || sample?.sampleType || "",
    barcode: sample?.barcode || "",
    arrivalCondition: sample?.arrivalCondition || parsed.arrivalCondition || "",
    volume: parsed.volume || "",
    zone: parsed.zone || "",
    freezerNo: parsed.freezerNo || "",
    shelfNo: parsed.shelfNo || "",
    rackNo: parsed.rackNo || "",
    boxNo: parsed.boxNo || "",
    location: parsed.location || "",
    qcStatus: parsed.qcStatus || "",
    deviationOrIncident: parsed.deviationOrIncident || "",
    collectionDate: sample?.collectionDate,
    transferredBy: parsed.transferredBy || "",
    transferReason: parsed.transferReason || "",
    receivedBy: parsed.receivedBy || "",
    approvalSign: parsed.approvalSign || "",
    externalId: labId || sample?.barcode || "",
    workflowStatus: sample?.workflowStatus || sample?.status || "REGISTERED",
    documentationStatus: sample?.documentationStatus || "PENDING",
    biosafetyLevel: sample?.biosafetyLevel || "",
    accessionNumber: sample?.accessionNumber || "",
    principalInvestigator: sample?.principalInvestigator || "",
    consentId: sample?.consentId || "",
    ethicsApprovalRef: sample?.ethicsApprovalRef || "",
    mtaReference: sample?.mtaReference || "",
    preservationMedium: sample?.preservationMedium || "",
    requiredTempMin: sample?.requiredTempMin,
    requiredTempMax: sample?.requiredTempMax,
    specialHandling: sample?.specialHandling || "",
  };
};

export const sortBioSamplesByManifestSno = (samples) =>
  [...(samples || [])].sort((left, right) => {
    const leftSno = left?.manifestSno;
    const rightSno = right?.manifestSno;
    if (leftSno != null && rightSno != null && leftSno !== rightSno) {
      return leftSno - rightSno;
    }
    if (leftSno != null && rightSno == null) {
      return -1;
    }
    if (leftSno == null && rightSno != null) {
      return 1;
    }
    return (left?.id || 0) - (right?.id || 0);
  });

const columnHeader = (intl, key, excelHeader) => {
  const messageId = MESSAGE_IDS[key];
  if (messageId) {
    return intl.formatMessage({ id: messageId, defaultMessage: excelHeader });
  }
  return excelHeader;
};

export const buildImportPreviewColumns = (intl) => {
  const columns = AHRI_EXCEL_COLUMNS.filter((column) =>
    column.stages.includes("import"),
  ).map((column) => ({
    key: column.key === "manifestSno" ? "manifestSno" : column.key,
    header: columnHeader(intl, column.key, column.excelHeader),
  }));

  return [
    {
      key: "row",
      header: "#",
    },
    ...columns,
  ];
};

export const buildReceptionTableColumns = (intl) => {
  const columns = RECEPTION_COLUMN_KEYS.map((key) => {
    const definition = AHRI_EXCEL_COLUMNS.find((column) => column.key === key);
    const excelHeader = definition?.excelHeader || key;
    if (key === "workflowStatus") {
      return {
        key,
        header: intl.formatMessage({
          id: "biorepository.sample.field.status",
          defaultMessage: "Status",
        }),
      };
    }
    return {
      key,
      header: columnHeader(intl, key, excelHeader),
    };
  });

  columns.push({
    key: "actions",
    header: intl.formatMessage({
      id: "biorepository.sample.field.actions",
      defaultMessage: "Actions",
    }),
  });

  return columns;
};

export const mapBioSampleToReceptionRow = (sample) => {
  const fields = mapBioSampleToExcelFields(sample);
  return {
    id: sample.id.toString(),
    manifestSno: fields.manifestSno ?? "-",
    barcode: fields.barcode || "-",
    externalId: fields.externalId || "-",
    sampleType: fields.sampleType || "-",
    projectId: fields.projectId || "-",
    originLab: fields.originLab || "-",
    receiptDate: formatDateValue(fields.receiptDate, false),
    workflowStatus: fields.workflowStatus,
    documentationStatus: fields.documentationStatus,
    biosafetyLevel: fields.biosafetyLevel || "-",
    actions: "",
    _sourceSample: sample,
  };
};

export const buildDetailModalFields = (intl) =>
  AHRI_EXCEL_COLUMNS.filter((column) => column.stages.includes("detail")).map(
    (column) => ({
      key: column.key,
      label: columnHeader(intl, column.key, column.excelHeader),
    }),
  );

export const formatDetailFieldValue = (fields, key) => {
  if (!fields) {
    return "-";
  }
  if (key === "receiptDate" || key === "collectionDate") {
    return formatDateValue(fields[key], true);
  }
  if (key === "manifestSno") {
    return fields.manifestSno != null ? String(fields.manifestSno) : "-";
  }
  const value = fields[key];
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};
