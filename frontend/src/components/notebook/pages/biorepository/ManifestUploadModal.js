import React, {
  useState,
  useCallback,
  useEffect,
  useContext,
  useMemo,
} from "react";
import {
  Modal,
  FileUploader,
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  InlineNotification,
  Loading,
  Tag,
  Dropdown,
  Checkbox,
} from "@carbon/react";
import { Checkmark, Warning, Download } from "@carbon/icons-react";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";
import * as XLSX from "xlsx";
import {
  postToOpenElisServerJsonResponse,
  getFromOpenElisServer,
} from "../../../utils/Utils";
import UserSessionDetailsContext from "../../../../UserSessionDetailsContext";
import { hasUnrestrictedDepartmentAccess } from "../../../../security/departmentAccess";
import {
  filterOwningDepartments,
  loadNotebookDepartmentIds,
} from "../../utils/notebookInventoryScope";
import {
  translateManifestImportMessage,
  translateManifestImportMessages,
  translateManifestDuplicateWarning,
} from "./manifestImportErrorMessages";
import {
  MANIFEST_FIELDS,
  LEGACY_MANIFEST_FIELDS,
  isFullAhriManifestSheet,
  convertLegacyWorksheetRows,
  firstNonEmptyValue,
  formatCurrentReceiptDate,
  inferLegacyBiosafetyLevel,
  inferLegacyTemperatureRange,
  isSupportedDateValue,
  mergeMappedRowValues,
  normalizeCellValue,
  normalizeDateValue,
  normalizeHeaderToken,
  normalizeLegacyDuplicateBarcodes,
  buildSpecialHandlingNotes,
  HEADER_ALIASES,
  STORAGE_METADATA_ALIASES,
  DUPLICATE_ISSUE,
  getDuplicateIssueType,
  partitionDuplicateMessages,
  isDuplicateWarningMessage,
  reconcileCrossBatchManifestDuplicates,
  computeDuplicateImportPreviews,
  parseDuplicateSampleId,
} from "./manifestImportHelpers";
import {
  buildImportPreviewColumns,
  normalizeManifestSno,
} from "./biorepositoryExcelColumns";

const REQUIRED_FIELDS = [
  "barcode",
  "sampleType",
  "originLab",
  "receiptDate",
];

const CONDITIONAL_FIELDS = [
  { name: "consentId", description: "Required for human samples" },
  { name: "ethicsApprovalRef", description: "Required for human samples" },
  { name: "mtaReference", description: "Required for external samples" },
];

const OPTIONAL_FIELDS = MANIFEST_FIELDS.filter(
  (field) => !REQUIRED_FIELDS.includes(field),
);

// Batch backend validation/import to keep payload sizes safe while minimizing
// round-trips for typical manifests.
const VALIDATION_BATCH_SIZE = 2000;

/**
 * ManifestUploadModal - manifest upload modal for bulk sample import
 * Part of Sub-stage 1b of the Biorepository Intake workflow
 *
 * Expected manifest format:
 * barcode,externalId,sampleType,projectId,originLab,receiptDate,requiredTempMin,requiredTempMax,...
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {number} props.shipmentId - The shipment ID to associate samples with
 * @param {number} props.notebookId - The notebook ID (for department auto-select)
 * @param {Function} props.onImportComplete - Callback when import is complete
 */
function ManifestUploadModal({
  open,
  onClose,
  shipmentId,
  notebookId,
  onImportComplete,
}) {
  const intl = useIntl();
  const { userSessionDetails } = useContext(UserSessionDetailsContext);
  const requiresDepartmentSelection =
    hasUnrestrictedDepartmentAccess(userSessionDetails);

  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importStatus, setImportStatus] = useState(null); // null, 'parsed', 'validating', 'preview', 'importing', 'complete'
  const [backendValidationDone, setBackendValidationDone] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [validationProgress, setValidationProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [importProgress, setImportProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState(null);
  const [duplicateRowApprovals, setDuplicateRowApprovals] = useState({});
  const [allowAllDuplicates, setAllowAllDuplicates] = useState(false);

  const requiredFields = REQUIRED_FIELDS;
  const conditionalFields = CONDITIONAL_FIELDS;
  const optionalFields = OPTIONAL_FIELDS;
  const expectedHeaders = MANIFEST_FIELDS;

  const formatImportMessage = useCallback(
    (message) => translateManifestImportMessage(message, intl.formatMessage),
    [intl],
  );

  const applyDefaultDepartmentSelection = useCallback(
    (list, preferredIds = []) => {
      const owningDepartments = filterOwningDepartments(list);
      setDepartments(
        owningDepartments.map((item) => ({
          id: item.id,
          text: item.value || item.name || item.id,
        })),
      );

      const loginId = userSessionDetails?.loginLabUnitId;
      if (
        preferredIds.length === 1 &&
        owningDepartments.some(
          (department) => String(department.id) === String(preferredIds[0]),
        )
      ) {
        setDepartmentId(String(preferredIds[0]));
      } else if (
        loginId &&
        owningDepartments.some(
          (department) => String(department.id) === String(loginId),
        )
      ) {
        setDepartmentId(String(loginId));
      } else if (owningDepartments.length === 1) {
        setDepartmentId(String(owningDepartments[0].id));
      } else {
        setDepartmentId("");
      }
    },
    [userSessionDetails],
  );

  useEffect(() => {
    if (!open || !requiresDepartmentSelection) {
      return;
    }

    let cancelled = false;
    setDepartmentsLoading(true);
    setDepartmentError(null);

    getFromOpenElisServer(
      "/rest/inventory/items/assignable-departments",
      (data) => {
        if (cancelled) {
          return;
        }
        if (!Array.isArray(data)) {
          setDepartments([]);
          setDepartmentId("");
          setDepartmentsLoading(false);
          return;
        }

        if (notebookId) {
          loadNotebookDepartmentIds(notebookId, (preferredIds) => {
            if (cancelled) {
              return;
            }
            applyDefaultDepartmentSelection(data, preferredIds);
            setDepartmentsLoading(false);
          });
          return;
        }

        applyDefaultDepartmentSelection(data);
        setDepartmentsLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    open,
    requiresDepartmentSelection,
    notebookId,
    applyDefaultDepartmentSelection,
  ]);

  /**
   * Generate and download CSV template per spec FR-MAN-002
   */
  const downloadTemplate = useCallback(() => {
    const headers = expectedHeaders.join(",");
    // Example row matching the header order
    const exampleRow =
      "BIO-2026-001,PARTICIPANT-001,Serum,PROJ-123,AHRI Lab,2026-01-09 09:30:00,2,8,BSL_2,2026-01-08,Dr. Smith,CONSENT-001,ETH-2025-001,MTA-001,EDTA,Good,Keep upright during transport";
    const csvContent = `${headers}\n${exampleRow}`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "biorepository_manifest_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [expectedHeaders]);

  const extractWorkbookRows = useCallback((workbook) => {
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd hh:mm:ss",
    });

    if (isFullAhriManifestSheet(rows)) {
      return rows;
    }

    const convertedLegacyRows = convertLegacyWorksheetRows(
      rows,
      firstSheetName,
    );
    if (convertedLegacyRows.length > 0) {
      return [
        LEGACY_MANIFEST_FIELDS,
        ...normalizeLegacyDuplicateBarcodes(convertedLegacyRows),
      ];
    }

    return rows;
  }, []);

  const parseManifestRows = useCallback(
    (rows) => {
      const normalizedRows = rows
        .map((row) =>
          Array.isArray(row)
            ? row.map((value) => normalizeCellValue(value))
            : [],
        )
        .filter((row) => row.some((value) => value !== ""));

      if (normalizedRows.length === 0) {
        throw new Error(
          intl.formatMessage({
            id: "biorepository.manifest.error.noCellData",
            defaultMessage:
              "No spreadsheet cell data found. This file may contain only an image or formatting. Please upload a sheet with header and sample rows.",
          }),
        );
      }

      if (normalizedRows.length < 2) {
        throw new Error(
          intl.formatMessage({
            id: "biorepository.manifest.error.emptyFile",
            defaultMessage:
              "Manifest must contain at least a header row and one data row",
          }),
        );
      }

      const rawHeaders = normalizedRows[0];
      const headers = rawHeaders.map(
        (header) => HEADER_ALIASES[normalizeHeaderToken(header)] || null,
      );

      // Keep header requirements backward-compatible with older manifests.
      // Some historical files omit receiptDate/requiredTemp* and rely on
      // collectionDate/sampleType so we infer those values per-row later.
      const minimumHeaderFields = ["sampleType", "originLab"];
      const missingHeaders = minimumHeaderFields.filter(
        (field) => !headers.includes(field),
      );

      if (!headers.includes("barcode") && !headers.includes("externalId")) {
        missingHeaders.unshift("barcode/externalId");
      }
      if (missingHeaders.length > 0) {
        throw new Error(
          intl.formatMessage(
            {
              id: "biorepository.manifest.error.missingHeaders",
              defaultMessage:
                "Missing required columns: {fields}. Please download the template.",
            },
            { fields: missingHeaders.join(", ") },
          ),
        );
      }

      const unknownColumns = rawHeaders.filter((header, index) => {
        const token = normalizeHeaderToken(header);
        return !headers[index] && !STORAGE_METADATA_ALIASES[token];
      });
      if (unknownColumns.length > 0) {
        throw new Error(
          intl.formatMessage(
            {
              id: "biorepository.manifest.error.unknownColumns",
              defaultMessage:
                "Unknown columns in manifest: {columns}. Please use the current template.",
            },
            { columns: unknownColumns.join(", ") },
          ),
        );
      }

      const data = [];
      const errors = [];

      for (let i = 1; i < normalizedRows.length; i++) {
        const values = normalizedRows[i];
        const row = mergeMappedRowValues(rawHeaders, values);
        row.barcode = row.barcode || "";
        row.externalId = row.externalId || row.barcode || "";
        row.sno = normalizeManifestSno(row.sno);

        row.receiptDate = normalizeDateValue(
          firstNonEmptyValue(
            row.receiptDate,
            row.collectionDate,
            formatCurrentReceiptDate(),
          ),
          true,
        );
        row.collectionDate = normalizeDateValue(row.collectionDate, false);
        row.specialHandling = buildSpecialHandlingNotes(row);

        const inferredTempRange = inferLegacyTemperatureRange(
          row.sampleType,
          "",
        );
        row.requiredTempMin = firstNonEmptyValue(
          row.requiredTempMin,
          inferredTempRange.min,
        );
        row.requiredTempMax = firstNonEmptyValue(
          row.requiredTempMax,
          inferredTempRange.max,
        );

        if (!row.biosafetyLevel) {
          row.biosafetyLevel = inferLegacyBiosafetyLevel(row.sampleType, "");
        }

        requiredFields.forEach((field) => {
          const value =
            field === "barcode" ? row.barcode || row.externalId : row[field];
          if (!value) {
            errors.push({
              row: i + 1,
              field,
              message: intl.formatMessage(
                {
                  id: "biorepository.manifest.error.required",
                  defaultMessage: "{field} is required",
                },
                { field },
              ),
            });
          }
        });

        if (
          row.biosafetyLevel &&
          !["BSL_1", "BSL_2", "BSL_3", "BSL_4"].includes(row.biosafetyLevel)
        ) {
          errors.push({
            row: i + 1,
            field: "biosafetyLevel",
            message: intl.formatMessage(
              {
                id: "biorepository.manifest.error.invalidBSL",
                defaultMessage:
                  "Invalid biosafety level: {value}. Must be BSL_1, BSL_2, BSL_3, or BSL_4",
              },
              { value: row.biosafetyLevel },
            ),
          });
        }

        if (row.receiptDate && !isSupportedDateValue(row.receiptDate, true)) {
          errors.push({
            row: i + 1,
            field: "receiptDate",
            message: intl.formatMessage({
              id: "biorepository.manifest.error.invalidReceiptDate",
              defaultMessage:
                "Invalid receipt date format. Use yyyy-MM-dd, dd/MM/yyyy, dd-MM-yyyy, or dd.MM.yyyy",
            }),
          });
        }

        if (
          row.collectionDate &&
          !isSupportedDateValue(row.collectionDate, false)
        ) {
          errors.push({
            row: i + 1,
            field: "collectionDate",
            message: intl.formatMessage({
              id: "biorepository.manifest.error.invalidDate",
              defaultMessage:
                "Invalid collection date format. Use yyyy-MM-dd, dd/MM/yyyy, dd-MM-yyyy, or dd.MM.yyyy",
            }),
          });
        }

        const minTemp =
          row.requiredTempMin === "" ? Number.NaN : Number(row.requiredTempMin);
        const maxTemp =
          row.requiredTempMax === "" ? Number.NaN : Number(row.requiredTempMax);

        if (row.requiredTempMin !== "" && Number.isNaN(minTemp)) {
          errors.push({
            row: i + 1,
            field: "requiredTempMin",
            message: intl.formatMessage({
              id: "biorepository.manifest.error.invalidMinTemp",
              defaultMessage: "requiredTempMin must be a number",
            }),
          });
        }

        if (row.requiredTempMax !== "" && Number.isNaN(maxTemp)) {
          errors.push({
            row: i + 1,
            field: "requiredTempMax",
            message: intl.formatMessage({
              id: "biorepository.manifest.error.invalidMaxTemp",
              defaultMessage: "requiredTempMax must be a number",
            }),
          });
        }

        if (
          !Number.isNaN(minTemp) &&
          !Number.isNaN(maxTemp) &&
          minTemp > maxTemp
        ) {
          errors.push({
            row: i + 1,
            field: "requiredTempMax",
            message: intl.formatMessage({
              id: "biorepository.manifest.error.invalidTempRange",
              defaultMessage:
                "requiredTempMax must be greater than or equal to requiredTempMin",
            }),
          });
        }

        row._rowNumber = i + 1;
        row._valid = errors.filter((e) => e.row === i + 1).length === 0;
        data.push(row);
      }

      return { data, errors };
    },
    [intl, isSupportedDateValue, requiredFields],
  );

  const handleFileChange = useCallback(
    (event) => {
      const uploadedFile = event.target.files?.[0];
      if (!uploadedFile) return;

      const fileName = uploadedFile.name.toLowerCase();
      if (
        !fileName.endsWith(".csv") &&
        !fileName.endsWith(".xlsx") &&
        !fileName.endsWith(".xls")
      ) {
        setError(
          intl.formatMessage({
            id: "biorepository.manifest.error.invalidFormat",
            defaultMessage: "Please upload a CSV or Excel file",
          }),
        );
        return;
      }

      setError(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, {
            type: "array",
            cellDates: true,
          });
          const rows = extractWorkbookRows(workbook);
          const { data, errors } = parseManifestRows(rows);
          setParsedData(data);
          setValidationErrors(errors);
          setValidationWarnings([]);
          setBackendValidationDone(false);
          setImportStatus("parsed");
        } catch (err) {
          setError(err.message);
          setParsedData([]);
          setValidationErrors([]);
        }
      };
      reader.onerror = () => {
        setError(
          intl.formatMessage({
            id: "biorepository.manifest.error.readFile",
            defaultMessage: "Failed to read file",
          }),
        );
      };
      reader.readAsArrayBuffer(uploadedFile);
    },
    [extractWorkbookRows, intl, parseManifestRows],
  );

  /**
   * Transform parsed CSV data to backend DTO format
   */
  const transformToBackendFormat = useCallback((data) => {
    return data.map((row) => {
      const barcode = row.barcode || row.externalId || "";
      const sample = {
        barcode,
        externalId: row.externalId || row.barcode || "",
        sampleType: row.sampleType,
        originLab: row.originLab,
        receiptDate: row.receiptDate,
      };

      if (row.sno != null) {
        sample.sno = row.sno;
      }

      if (row.projectId) {
        sample.projectId = row.projectId;
      }
      if (row.requiredTempMin !== "") {
        sample.requiredTempMin = Number(row.requiredTempMin);
      }
      if (row.requiredTempMax !== "") {
        sample.requiredTempMax = Number(row.requiredTempMax);
      }
      if (row.collectionDate) {
        sample.collectionDate = row.collectionDate;
      }
      if (row.principalInvestigator) {
        sample.principalInvestigator = row.principalInvestigator;
      }
      if (row.consentId) {
        sample.consentId = row.consentId;
      }
      if (row.ethicsApprovalRef) {
        sample.ethicsApprovalRef = row.ethicsApprovalRef;
      }
      if (row.mtaReference) {
        sample.mtaReference = row.mtaReference;
      }
      if (row.preservationMedium) {
        sample.preservationMedium = row.preservationMedium;
      }
      if (row.arrivalCondition) {
        sample.arrivalCondition = row.arrivalCondition;
      }
      if (row.specialHandling) {
        sample.specialHandling = row.specialHandling;
      } else if (row._storageNotes) {
        sample.specialHandling = row._storageNotes;
      }
      if (row.biosafetyLevel) {
        sample.biosafetyLevel = row.biosafetyLevel;
      } else {
        sample.biosafetyLevel = "BSL_1";
      }
      return sample;
    });
  }, []);

  const formatServerRequestError = useCallback(
    (result, fallbackId, fallbackMessage) => {
      if (result?.error || result?.message) {
        return formatImportMessage(result.message || result.error);
      }
      const status = result?.status || result?.statusCode;
      if (status === 413) {
        return intl.formatMessage({
          id: "biorepository.manifest.error.payloadTooLarge",
          defaultMessage:
            "The manifest batch is too large for the server. Try again after the update completes, or split the file into smaller uploads.",
        });
      }
      if (status === 504 || status === 408) {
        return intl.formatMessage({
          id: "biorepository.manifest.error.validationTimeout",
          defaultMessage:
            "Server validation timed out. Please try again; large manifests are processed in batches.",
        });
      }
      if (status) {
        return intl.formatMessage(
          {
            id: "biorepository.manifest.error.validationFailedWithStatus",
            defaultMessage:
              "Server validation failed (HTTP {status}). Please try again.",
          },
          { status },
        );
      }
      return intl.formatMessage({
        id: fallbackId,
        defaultMessage: fallbackMessage,
      });
    },
    [formatImportMessage, intl],
  );

  const validateBatchWithBackend = useCallback(
    (samples) =>
      new Promise((resolve) => {
        postToOpenElisServerJsonResponse(
          "/rest/biorepository/sample/validate-manifest-import",
          JSON.stringify({
            samples,
            shipmentId,
          }),
          (validationResult) => resolve(validationResult),
        );
      }),
    [shipmentId],
  );

  const runBatchedValidation = useCallback(
    async (allSamples) => {
      const mergedRows = new Array(allSamples.length);
      let mergedValid = true;
      let mergedInvalidCount = 0;

      setValidationProgress({ completed: 0, total: allSamples.length });

      for (
        let start = 0;
        start < allSamples.length;
        start += VALIDATION_BATCH_SIZE
      ) {
        const batch = allSamples.slice(start, start + VALIDATION_BATCH_SIZE);
        setValidationProgress({ completed: start, total: allSamples.length });

        const validationResult = await validateBatchWithBackend(batch);

        if (validationResult?.error) {
          throw validationResult;
        }
        if (!validationResult || !Array.isArray(validationResult.rows)) {
          throw validationResult || { status: 0 };
        }

        validationResult.rows.forEach((row, index) => {
          mergedRows[start + index] = row;
        });
        if (!validationResult.valid) {
          mergedValid = false;
        }
        mergedInvalidCount += Number(validationResult.invalidCount || 0);
      }

      setValidationProgress({
        completed: allSamples.length,
        total: allSamples.length,
      });

      const reconciledRows = reconcileCrossBatchManifestDuplicates(
        allSamples,
        mergedRows,
      );
      let reconciledInvalidCount = 0;
      reconciledRows.forEach((row) => {
        if (row && row.valid === false) {
          reconciledInvalidCount += 1;
        }
      });

      return {
        valid: reconciledInvalidCount === 0,
        invalidCount: reconciledInvalidCount,
        rows: reconciledRows,
      };
    },
    [validateBatchWithBackend],
  );

  const registerBatchWithBackend = useCallback(
    (samples, duplicateResolution) =>
      new Promise((resolve) => {
        const payload = {
          samples,
          shipmentId,
        };
        if (duplicateResolution) {
          payload.duplicateResolution = duplicateResolution;
        }
        if (requiresDepartmentSelection && departmentId) {
          const deptNum = parseInt(departmentId, 10);
          if (!Number.isNaN(deptNum)) {
            payload.departmentTestSectionId = deptNum;
          }
        }
        postToOpenElisServerJsonResponse(
          "/rest/biorepository/sample/register-bulk",
          JSON.stringify(payload),
          (response) => resolve(response),
        );
      }),
    [shipmentId, requiresDepartmentSelection, departmentId],
  );

  const runBatchedImport = useCallback(
    async (allSamples, duplicateResolution) => {
      const merged = {
        registeredCount: 0,
        failedCount: 0,
        rowErrors: [],
        samples: [],
        success: true,
      };

      setImportProgress({ completed: 0, total: allSamples.length });

      for (
        let start = 0;
        start < allSamples.length;
        start += VALIDATION_BATCH_SIZE
      ) {
        const batch = allSamples.slice(start, start + VALIDATION_BATCH_SIZE);
        setImportProgress({ completed: start, total: allSamples.length });

        let batchDuplicateResolution;
        if (duplicateResolution?.allowedRowIndexes?.length) {
          const batchAllowed = duplicateResolution.allowedRowIndexes
            .filter(
              (index) =>
                index >= start && index < start + VALIDATION_BATCH_SIZE,
            )
            .map((index) => index - start);
          if (batchAllowed.length > 0) {
            batchDuplicateResolution = {
              mode: duplicateResolution.mode || "SUFFIX",
              allowedRowIndexes: batchAllowed,
            };
          }
        }

        const response = await registerBatchWithBackend(
          batch,
          batchDuplicateResolution,
        );
        if (!response) {
          throw { status: 0 };
        }
        if (response?.error) {
          throw response;
        }

        merged.registeredCount += Number(response?.registeredCount || 0);
        merged.failedCount += Number(response?.failedCount || 0);
        if (Array.isArray(response?.rowErrors)) {
          merged.rowErrors.push(...response.rowErrors);
        }
        if (Array.isArray(response?.samples)) {
          merged.samples.push(...response.samples);
        }
        if (response?.success === false) {
          merged.success = false;
        }
      }

      setImportProgress({
        completed: allSamples.length,
        total: allSamples.length,
      });

      return merged;
    },
    [registerBatchWithBackend],
  );

  const applyBackendValidationResults = useCallback(
    (validationResult) => {
      const backendErrors = [];
      const backendWarnings = [];
      const provisionalRows = parsedData.map((row, index) => {
        const backendRow = validationResult.rows?.[index];
        const { duplicateMessages, hardErrors } = partitionDuplicateMessages(
          backendRow?.errors || [],
        );
        const duplicateIssue = getDuplicateIssueType(
          backendRow?.duplicateIssue,
          [...(backendRow?.warnings || []), ...duplicateMessages],
        );
        const isDuplicate = duplicateIssue !== DUPLICATE_ISSUE.NONE;

        hardErrors.forEach((errMsg) => {
          backendErrors.push({
            row: row._rowNumber,
            field: "backend",
            message: formatImportMessage(errMsg),
          });
        });

        const nonDuplicateWarnings = (backendRow?.warnings || []).filter(
          (warningMsg) => !isDuplicateWarningMessage(warningMsg),
        );
        nonDuplicateWarnings.forEach((warningMsg) => {
          backendWarnings.push({
            row: row._rowNumber,
            field: "sampleType",
            message: warningMsg,
          });
        });

        return {
          ...row,
          _valid: hardErrors.length === 0,
          _backendErrors: hardErrors,
          _backendWarnings: [
            ...(backendRow?.warnings || []),
            ...duplicateMessages,
          ],
          _duplicateIssue: duplicateIssue,
          _isDuplicate: isDuplicate,
        };
      });

      const duplicatePreviews = computeDuplicateImportPreviews(
        provisionalRows,
        {},
      );
      const updatedData = provisionalRows.map((row) => {
        if (!row._isDuplicate) {
          return row;
        }
        const duplicateWarning = row._backendWarnings.find((warningMsg) =>
          isDuplicateWarningMessage(warningMsg),
        );
        const suggestedId =
          duplicatePreviews[row._rowNumber] ||
          parseDuplicateSampleId(duplicateWarning);
        backendWarnings.push({
          row: row._rowNumber,
          field: "duplicate",
          message: translateManifestDuplicateWarning(
            duplicateWarning,
            intl.formatMessage,
            suggestedId,
          ),
        });
        return row;
      });

      const hardErrorCount = updatedData.filter((row) => !row._valid).length;

      setParsedData(updatedData);
      setValidationErrors(backendErrors);
      setValidationWarnings(backendWarnings);
      setDuplicateRowApprovals({});
      setAllowAllDuplicates(false);
      setBackendValidationDone(true);
      setImportStatus("preview");

      if (hardErrorCount > 0) {
        setError(
          intl.formatMessage(
            {
              id: "biorepository.manifest.error.backendValidationPreview",
              defaultMessage:
                "{count} sample(s) have validation errors. Please review below.",
            },
            { count: hardErrorCount },
          ),
        );
      } else {
        setError(null);
      }
    },
    [parsedData, formatImportMessage, intl],
  );

  /**
   * Handle Preview & Validate button click.
   * Sends parsed data to backend for validation and shows results.
   */
  const handlePreviewValidation = useCallback(() => {
    if (validationErrors.length > 0) {
      setError(
        intl.formatMessage({
          id: "biorepository.manifest.error.fixErrorsFirst",
          defaultMessage: "Please fix the validation errors before previewing.",
        }),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setImportStatus("validating");
    setBackendValidationDone(false);

    const samples = transformToBackendFormat(parsedData);

    runBatchedValidation(samples)
      .then((validationResult) => {
        setLoading(false);
        applyBackendValidationResults(validationResult);
      })
      .catch((failure) => {
        setLoading(false);
        setImportStatus("parsed");
        setValidationProgress({ completed: 0, total: 0 });
        setError(
          formatServerRequestError(
            failure,
            "biorepository.manifest.error.validationFailed",
            "Failed to validate samples with server. Please try again.",
          ),
        );
      });
  }, [
    validationErrors,
    intl,
    transformToBackendFormat,
    parsedData,
    runBatchedValidation,
    applyBackendValidationResults,
    formatServerRequestError,
  ]);

  const duplicateRows = useMemo(
    () => parsedData.filter((row) => row._isDuplicate),
    [parsedData],
  );

  const duplicateImportPreviews = useMemo(
    () => computeDuplicateImportPreviews(parsedData, duplicateRowApprovals),
    [parsedData, duplicateRowApprovals],
  );

  const isRowImportable = useCallback(
    (row) => {
      if (!row._valid) {
        return false;
      }
      if (row._isDuplicate && !duplicateRowApprovals[row._rowNumber]) {
        return false;
      }
      return true;
    },
    [duplicateRowApprovals],
  );

  const importableSampleCount = parsedData.filter(isRowImportable).length;
  const approvedDuplicateCount = duplicateRows.filter(
    (row) => duplicateRowApprovals[row._rowNumber],
  ).length;
  const hardErrorCount = parsedData.filter((row) => !row._valid).length;

  const handleToggleAllowAllDuplicates = useCallback(
    (checked) => {
      setAllowAllDuplicates(checked);
      if (!checked) {
        setDuplicateRowApprovals({});
        return;
      }
      const approvals = {};
      duplicateRows.forEach((row) => {
        approvals[row._rowNumber] = true;
      });
      setDuplicateRowApprovals(approvals);
    },
    [duplicateRows],
  );

  const handleToggleDuplicateRow = useCallback((rowNumber, checked) => {
    setDuplicateRowApprovals((prev) => ({
      ...prev,
      [rowNumber]: checked,
    }));
    setAllowAllDuplicates(false);
  }, []);

  const handleImport = useCallback(() => {
    if (requiresDepartmentSelection) {
      if (departmentsLoading) {
        setDepartmentError(
          intl.formatMessage({
            id: "storage.room.department.loading",
            defaultMessage: "Loading departments…",
          }),
        );
        return;
      }
      if (departments.length === 0) {
        setDepartmentError(
          intl.formatMessage({
            id: "storage.room.department.none",
            defaultMessage:
              "No lab unit / department is assigned to your account. Contact an administrator.",
          }),
        );
        return;
      }
      if (!departmentId) {
        setDepartmentError(
          intl.formatMessage({
            id: "biorepository.sample.error.department.required",
            defaultMessage: "Select a department (lab unit) for this sample",
          }),
        );
        return;
      }
    }

    if (!backendValidationDone) {
      setError(
        intl.formatMessage({
          id: "biorepository.manifest.error.notValidated",
          defaultMessage:
            "Please validate the samples first by clicking Preview & Validate",
        }),
      );
      return;
    }

    const importableEntries = parsedData
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => isRowImportable(row));

    if (importableEntries.length === 0) {
      setError(
        intl.formatMessage({
          id: "biorepository.manifest.error.noValidSamples",
          defaultMessage:
            "No valid samples to import. Please fix errors first.",
        }),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setImportStatus("importing");
    setImportResult(null);

    const samples = transformToBackendFormat(
      importableEntries.map((entry) => entry.row),
    );
    const allowedRowIndexes = importableEntries
      .map((entry, sentIndex) => ({ ...entry, sentIndex }))
      .filter(
        ({ row }) => row._isDuplicate && duplicateRowApprovals[row._rowNumber],
      )
      .map(({ sentIndex }) => sentIndex);
    const duplicateResolution =
      allowedRowIndexes.length > 0
        ? { mode: "SUFFIX", allowedRowIndexes }
        : undefined;

    runBatchedImport(samples, duplicateResolution)
      .then((response) => {
        setLoading(false);
        const rowErrors = translateManifestImportMessages(
          response?.rowErrors,
          intl.formatMessage,
        );
        const registeredCount = Number(response?.registeredCount || 0);
        const failedCount = Number(
          response?.failedCount ?? rowErrors.length ?? 0,
        );

        setImportResult({
          registeredCount,
          failedCount,
          rowErrors,
        });
        setImportStatus("complete");
        if (onImportComplete) {
          try {
            onImportComplete(response?.samples || []);
          } catch (callbackError) {
            // eslint-disable-next-line no-console
            console.error(
              "Biorepository manifest import completed, but follow-up refresh failed:",
              callbackError,
            );
          }
        }
        if (rowErrors.length === 0) {
          setTimeout(() => {
            handleClose();
          }, 2000);
        }
      })
      .catch((failure) => {
        setLoading(false);
        setImportStatus("preview");
        setImportProgress({ completed: 0, total: 0 });
        setError(
          formatServerRequestError(
            failure,
            "biorepository.manifest.error.importFailed",
            "Failed to import samples with server. Please try again.",
          ),
        );
      });
  }, [
    parsedData,
    backendValidationDone,
    onImportComplete,
    intl,
    formatImportMessage,
    transformToBackendFormat,
    runBatchedImport,
    formatServerRequestError,
    requiresDepartmentSelection,
    departmentsLoading,
    departments.length,
    departmentId,
    isRowImportable,
    duplicateRowApprovals,
  ]);

  const handleClear = useCallback(() => {
    setParsedData([]);
    setValidationErrors([]);
    setValidationWarnings([]);
    setImportStatus(null);
    setError(null);
    setDepartmentError(null);
    setBackendValidationDone(false);
    setImportResult(null);
    setValidationProgress({ completed: 0, total: 0 });
    setImportProgress({ completed: 0, total: 0 });
    setDuplicateRowApprovals({});
    setAllowAllDuplicates(false);
  }, []);

  const handleClose = useCallback(() => {
    handleClear();
    onClose();
  }, [handleClear, onClose]);

  const showDuplicateColumns =
    importStatus === "preview" && duplicateRows.length > 0;

  const tableHeaders = useMemo(() => {
    const headers = buildImportPreviewColumns(intl);

    if (showDuplicateColumns) {
      headers.push({
        key: "include",
        header: intl.formatMessage({
          id: "biorepository.manifest.duplicate.column.include",
          defaultMessage: "Include",
        }),
      });
      headers.push({
        key: "importAs",
        header: intl.formatMessage({
          id: "biorepository.manifest.duplicate.column.importAs",
          defaultMessage: "Import as",
        }),
      });
    }

    headers.push({
      key: "status",
      header: intl.formatMessage({
        id: "biorepository.manifest.column.status",
        defaultMessage: "Status",
      }),
    });

    return headers;
  }, [intl, showDuplicateColumns]);

  const tableRows = parsedData.map((row) => {
    const hasNonDuplicateWarnings = (row._backendWarnings || []).some(
      (warningMsg) =>
        !String(warningMsg)
          .toLowerCase()
          .startsWith("duplicate sample id in manifest:") &&
        !String(warningMsg)
          .toLowerCase()
          .startsWith("sample id already exists:"),
    );
    let status = "error";
    if (row._valid) {
      if (row._isDuplicate) {
        status = "duplicate";
      } else if (hasNonDuplicateWarnings) {
        status = "warning";
      } else {
        status = "valid";
      }
    }

    const tableRow = {
      id: String(row._rowNumber),
      row: row._rowNumber,
      manifestSno: row.sno != null ? String(row.sno) : "-",
      originLab: row.originLab || "-",
      projectId: row.projectId || "-",
      sampleType: row.sampleType || "-",
      barcode: row.barcode || "-",
      externalId: row.externalId || "-",
      status,
      _isDuplicate: row._isDuplicate,
    };

    if (showDuplicateColumns) {
      tableRow.include = row._isDuplicate ? "checkbox" : "";
      tableRow.importAs = row._isDuplicate
        ? duplicateImportPreviews[row._rowNumber] || "-"
        : "";
    }

    return tableRow;
  });

  const importButtonLabel = useMemo(() => {
    if (approvedDuplicateCount > 0) {
      return intl.formatMessage(
        {
          id: "biorepository.manifest.button.importWithDuplicates",
          defaultMessage:
            "Import {count} Samples ({duplicateCount} as new IDs)",
        },
        {
          count: importableSampleCount,
          duplicateCount: approvedDuplicateCount,
        },
      );
    }
    if (
      hardErrorCount > 0 ||
      duplicateRows.some((row) => !duplicateRowApprovals[row._rowNumber])
    ) {
      return intl.formatMessage(
        {
          id: "biorepository.manifest.button.import",
          defaultMessage: "Import {count} Valid Samples",
        },
        { count: importableSampleCount },
      );
    }
    return intl.formatMessage(
      {
        id: "biorepository.manifest.button.importAll",
        defaultMessage: "Import {count} Samples",
      },
      { count: importableSampleCount },
    );
  }, [
    intl,
    importableSampleCount,
    approvedDuplicateCount,
    hardErrorCount,
    duplicateRows,
    duplicateRowApprovals,
  ]);

  // Show errors for specific rows
  const getRowErrors = (rowNumber) => {
    return validationErrors.filter((e) => e.row === rowNumber);
  };

  const getRowWarnings = (rowNumber) => {
    return validationWarnings.filter((e) => e.row === rowNumber);
  };

  const formatRowError = (error) => {
    if (!error) {
      return "";
    }

    if (error.field === "backend") {
      return error.message;
    }

    return `${error.field}: ${error.message}`;
  };

  return (
    <Modal
      open={open}
      onRequestClose={handleClose}
      modalHeading={intl.formatMessage({
        id: "biorepository.manifest.modal.title",
        defaultMessage: "Import Sample Manifest",
      })}
      modalLabel={intl.formatMessage({
        id: "biorepository.manifest.modal.label",
        defaultMessage: "Bulk Sample Registration",
      })}
      primaryButtonText={
        importStatus === "preview" ? importButtonLabel : undefined
      }
      secondaryButtonText={
        importStatus === "preview"
          ? intl.formatMessage({
              id: "biorepository.manifest.button.clear",
              defaultMessage: "Upload Different File",
            })
          : importStatus === "parsed" || importStatus === "validating"
            ? undefined // Buttons are inline for parsed/validating states
            : intl.formatMessage({
                id: "biorepository.button.close",
                defaultMessage: "Close",
              })
      }
      onRequestSubmit={importStatus === "preview" ? handleImport : undefined}
      onSecondarySubmit={
        importStatus === "preview"
          ? handleClear
          : importStatus === "parsed" || importStatus === "validating"
            ? undefined
            : handleClose
      }
      primaryButtonDisabled={
        loading ||
        importableSampleCount === 0 ||
        importStatus !== "preview" ||
        (requiresDepartmentSelection &&
          (departmentsLoading || departments.length === 0 || !departmentId))
      }
      size="lg"
      preventCloseOnClickOutside={loading}
    >
      {loading && <Loading description="Importing samples..." />}

      {requiresDepartmentSelection && (
        <div style={{ marginBottom: "1rem" }}>
          {departmentsLoading ? (
            <p>
              {intl.formatMessage({
                id: "storage.room.department.loading",
                defaultMessage: "Loading departments…",
              })}
            </p>
          ) : departments.length > 0 ? (
            <Dropdown
              id="manifest-department"
              titleText={intl.formatMessage({
                id: "biorepository.sample.field.department",
                defaultMessage: "Department / Lab Unit *",
              })}
              label={intl.formatMessage({
                id: "storage.room.department.placeholder",
                defaultMessage: "Choose department",
              })}
              items={departments}
              itemToString={(item) => (item ? item.text : "")}
              selectedItem={
                departments.find(
                  (department) =>
                    String(department.id) === String(departmentId),
                ) || null
              }
              onChange={({ selectedItem }) => {
                if (selectedItem) {
                  setDepartmentId(String(selectedItem.id));
                  setDepartmentError(null);
                }
              }}
              invalid={!!departmentError}
              invalidText={departmentError}
            />
          ) : (
            <InlineNotification
              kind="error"
              title={intl.formatMessage({
                id: "storage.room.department.none",
                defaultMessage:
                  "No lab unit / department is assigned to your account. Contact an administrator.",
              })}
              lowContrast
              hideCloseButton
            />
          )}
        </div>
      )}

      {error && (
        <InlineNotification
          kind="error"
          title={intl.formatMessage({
            id: "biorepository.manifest.error.title",
            defaultMessage: "Error",
          })}
          subtitle={error}
          lowContrast
          onClose={() => setError(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}

      {importStatus === "complete" && (
        <InlineNotification
          kind="success"
          title={intl.formatMessage({
            id: "biorepository.manifest.success.title",
            defaultMessage: "Import Complete",
          })}
          subtitle={intl.formatMessage(
            {
              id: "biorepository.manifest.success.message",
              defaultMessage:
                "{importedCount} samples registered in intake successfully.{skippedMessage}",
            },
            {
              importedCount:
                importResult?.registeredCount ?? importableSampleCount,
              skippedMessage:
                (importResult?.failedCount ?? 0) > 0
                  ? ` ${importResult.failedCount} sample(s) could not be imported.`
                  : parsedData.length > importableSampleCount
                    ? ` ${parsedData.length - importableSampleCount} sample(s) were skipped.`
                    : "",
            },
          )}
          lowContrast
          hideCloseButton
          style={{ marginBottom: "1rem" }}
        />
      )}

      {importStatus === "complete" && (importResult?.failedCount ?? 0) > 0 && (
        <InlineNotification
          kind="warning"
          title={intl.formatMessage({
            id: "biorepository.manifest.partialImport.title",
            defaultMessage: "Some Samples Were Not Imported",
          })}
          subtitle={
            importResult?.rowErrors?.slice(0, 3).join("; ") ||
            intl.formatMessage({
              id: "biorepository.manifest.partialImport.message",
              defaultMessage:
                "One or more samples could not be imported. Please review the failed rows and try again.",
            })
          }
          lowContrast
          style={{ marginBottom: "1rem" }}
        />
      )}

      {importStatus === null && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ marginBottom: "1rem" }}>
            <FormattedMessage
              id="biorepository.manifest.instructions"
              defaultMessage="Upload a CSV or Excel manifest to register samples on the intake page. Later storage, QC, retrieval, and disposal steps remain manual."
            />
          </p>
          <div style={{ marginBottom: "1rem" }}>
            <Button
              kind="tertiary"
              size="sm"
              renderIcon={Download}
              onClick={downloadTemplate}
            >
              <FormattedMessage
                id="biorepository.manifest.button.downloadTemplate"
                defaultMessage="Download Manifest Template"
              />
            </Button>
          </div>
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f4f4f4",
              borderRadius: "4px",
              marginBottom: "1rem",
            }}
          >
            <h6 style={{ marginBottom: "0.5rem" }}>
              <FormattedMessage
                id="biorepository.manifest.requiredFields.title"
                defaultMessage="Required Fields:"
              />
            </h6>
            <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
              {requiredFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>

            <h6 style={{ marginBottom: "0.5rem", marginTop: "1rem" }}>
              <FormattedMessage
                id="biorepository.manifest.conditionalFields.title"
                defaultMessage="Conditional Fields:"
              />
            </h6>
            <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
              {conditionalFields.map((field) => (
                <li key={field.name}>
                  {field.name}{" "}
                  <span style={{ color: "#525252", fontSize: "0.75rem" }}>
                    ({field.description})
                  </span>
                </li>
              ))}
            </ul>

            <h6 style={{ marginBottom: "0.5rem", marginTop: "1rem" }}>
              <FormattedMessage
                id="biorepository.manifest.optionalFields.title"
                defaultMessage="Optional Fields:"
              />
            </h6>
            <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
              {optionalFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>

          <div
            style={{
              padding: "1rem",
              backgroundColor: "#e8f3ff",
              borderRadius: "4px",
              marginBottom: "1rem",
            }}
          >
            <h6 style={{ marginBottom: "0.5rem" }}>
              <FormattedMessage
                id="biorepository.manifest.sampleTypes.title"
                defaultMessage="Sample Type Handling:"
              />
            </h6>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#393939" }}>
              <FormattedMessage
                id="biorepository.manifest.sampleTypes.help"
                defaultMessage="The manifest accepts the sample type labels used by AHRI. Existing sample types are matched by ID, name, localized name, or abbreviation. If a biorepository sample type is not already configured, validation will mark it for creation and the import will register it automatically."
              />
            </p>
          </div>
          <FileUploader
            labelTitle={intl.formatMessage({
              id: "biorepository.manifest.upload.title",
              defaultMessage: "Select manifest file",
            })}
            labelDescription={intl.formatMessage({
              id: "biorepository.manifest.upload.description",
              defaultMessage:
                "Upload CSV, XLSX, or XLS. AHRI Bacteriology multi-sheet workbooks are supported (Request_Date = receipt, Transfer_Date = collection). Dates may use yyyy-MM-dd, dd/MM/yyyy, dd-MM-yyyy, or dd.MM.yyyy.",
            })}
            buttonLabel={intl.formatMessage({
              id: "biorepository.manifest.upload.button",
              defaultMessage: "Select manifest file",
            })}
            iconDescription={intl.formatMessage({
              id: "biorepository.manifest.upload.iconDescription",
              defaultMessage: "Delete file",
            })}
            accept={[".csv", ".xlsx", ".xls"]}
            multiple={false}
            onChange={handleFileChange}
            filenameStatus="edit"
          />
        </div>
      )}

      {(importStatus === "parsed" || importStatus === "validating") &&
        parsedData.length > 0 && (
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <h5 style={{ display: "inline-block", marginRight: "0.5rem" }}>
                <FormattedMessage
                  id="biorepository.manifest.parsed.title"
                  defaultMessage="Parsed: {count} samples"
                  values={{ count: parsedData.length }}
                />
              </h5>
              {validationErrors.length > 0 && (
                <Tag type="red">
                  <Warning size={16} style={{ marginRight: "0.25rem" }} />
                  {validationErrors.length}{" "}
                  <FormattedMessage
                    id="biorepository.manifest.parsed.formatErrors"
                    defaultMessage="format error(s)"
                  />
                </Tag>
              )}
              {validationErrors.length === 0 && (
                <Tag type="blue">
                  <FormattedMessage
                    id="biorepository.manifest.parsed.readyToValidate"
                    defaultMessage="Ready for validation"
                  />
                </Tag>
              )}
            </div>

            {validationErrors.length > 0 && (
              <InlineNotification
                kind="warning"
                title={intl.formatMessage({
                  id: "biorepository.manifest.formatErrors.title",
                  defaultMessage: "Format Errors",
                })}
                subtitle={intl.formatMessage({
                  id: "biorepository.manifest.formatErrors.subtitle",
                  defaultMessage:
                    "Please fix these errors before validation. You may need to upload a corrected manifest file.",
                })}
                lowContrast
                hideCloseButton
                style={{ marginBottom: "1rem" }}
              />
            )}

            {importStatus === "validating" && (
              <InlineNotification
                kind="info"
                title={intl.formatMessage({
                  id: "biorepository.manifest.validating.title",
                  defaultMessage: "Validating",
                })}
                subtitle={intl.formatMessage(
                  {
                    id: "biorepository.manifest.validating.progress",
                    defaultMessage:
                      "Checking samples against the database ({completed} / {total})...",
                  },
                  {
                    completed: validationProgress.completed,
                    total: validationProgress.total || parsedData.length,
                  },
                )}
                lowContrast
                hideCloseButton
                style={{ marginBottom: "1rem" }}
              />
            )}

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                marginBottom: "1rem",
              }}
            >
              <DataTable rows={tableRows} headers={tableHeaders} size="sm">
                {({
                  rows,
                  headers,
                  getTableProps,
                  getHeaderProps,
                  getRowProps,
                }) => (
                  <Table {...getTableProps()} size="sm">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader
                            key={header.key}
                            {...getHeaderProps({ header })}
                          >
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => {
                        const rowNumber = parseInt(row.id);
                        const rowErrors = getRowErrors(rowNumber);
                        const rowWarnings = getRowWarnings(rowNumber);
                        return (
                          <React.Fragment key={row.id}>
                            <TableRow {...getRowProps({ row })}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === "status" ? (
                                    cell.value === "valid" ? (
                                      <Tag type="gray" size="sm">
                                        <FormattedMessage
                                          id="biorepository.manifest.status.ready"
                                          defaultMessage="Ready"
                                        />
                                      </Tag>
                                    ) : cell.value === "warning" ? (
                                      <Tag type="warm-gray" size="sm">
                                        <FormattedMessage
                                          id="biorepository.manifest.status.warning"
                                          defaultMessage="Will Create Type"
                                        />
                                      </Tag>
                                    ) : (
                                      <Tag type="red" size="sm">
                                        <FormattedMessage
                                          id="biorepository.manifest.status.error"
                                          defaultMessage="Error"
                                        />
                                      </Tag>
                                    )
                                  ) : (
                                    cell.value
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                            {rowErrors.length > 0 && (
                              <TableRow>
                                <TableCell colSpan={headers.length}>
                                  <div
                                    style={{
                                      backgroundColor: "#fff1f1",
                                      padding: "0.5rem",
                                      fontSize: "0.875rem",
                                    }}
                                  >
                                    {rowErrors.map((err, idx) => (
                                      <div key={idx}>
                                        • {err.field}: {err.message}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            {rowWarnings.length > 0 && (
                              <TableRow>
                                <TableCell colSpan={headers.length}>
                                  <div
                                    style={{
                                      backgroundColor: "#fff8e1",
                                      padding: "0.5rem",
                                      fontSize: "0.875rem",
                                    }}
                                  >
                                    {rowWarnings.map((warning, idx) => (
                                      <div key={idx}>• {warning.message}</div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </DataTable>
            </div>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "flex-end",
              }}
            >
              <Button
                kind="secondary"
                size="md"
                onClick={handleClear}
                disabled={loading}
              >
                <FormattedMessage
                  id="biorepository.manifest.button.uploadDifferent"
                  defaultMessage="Upload Different File"
                />
              </Button>
              <Button
                kind="primary"
                size="md"
                onClick={handlePreviewValidation}
                disabled={loading || validationErrors.length > 0}
                renderIcon={
                  importStatus === "validating" ? undefined : Checkmark
                }
              >
                {importStatus === "validating" ? (
                  <FormattedMessage
                    id="biorepository.manifest.button.validating"
                    defaultMessage="Validating..."
                  />
                ) : (
                  <FormattedMessage
                    id="biorepository.manifest.button.previewValidate"
                    defaultMessage="Preview & Validate"
                  />
                )}
              </Button>
            </div>
          </div>
        )}

      {importStatus === "preview" && parsedData.length > 0 && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <h5 style={{ display: "inline-block", marginRight: "0.5rem" }}>
              <FormattedMessage
                id="biorepository.manifest.preview.title"
                defaultMessage="Preview: {count} samples"
                values={{ count: parsedData.length }}
              />
            </h5>
            {validationErrors.length > 0 && (
              <Tag type="red">
                <Warning size={16} style={{ marginRight: "0.25rem" }} />
                {validationErrors.length} error(s)
              </Tag>
            )}
            {validationErrors.length === 0 && duplicateRows.length === 0 && (
              <Tag type="green">
                <Checkmark size={16} style={{ marginRight: "0.25rem" }} />
                <FormattedMessage
                  id="biorepository.manifest.preview.valid"
                  defaultMessage="All valid"
                />
              </Tag>
            )}
            {duplicateRows.length > 0 && (
              <Tag type="purple" style={{ marginLeft: "0.5rem" }}>
                <Warning size={16} style={{ marginRight: "0.25rem" }} />
                {intl.formatMessage(
                  {
                    id: "biorepository.manifest.duplicate.count",
                    defaultMessage: "{count} duplicate(s)",
                  },
                  { count: duplicateRows.length },
                )}
              </Tag>
            )}
            {validationWarnings.some(
              (warning) => warning.field === "sampleType",
            ) && (
              <Tag type="warm-gray" style={{ marginLeft: "0.5rem" }}>
                <Warning size={16} style={{ marginRight: "0.25rem" }} />
                <FormattedMessage
                  id="biorepository.manifest.preview.sampleTypeWarnings"
                  defaultMessage="New sample type warnings"
                />
              </Tag>
            )}
          </div>

          {duplicateRows.length > 0 && (
            <InlineNotification
              kind="info"
              title={intl.formatMessage({
                id: "biorepository.manifest.duplicate.title",
                defaultMessage: "Duplicate Sample IDs",
              })}
              subtitle={intl.formatMessage(
                {
                  id: "biorepository.manifest.duplicate.descriptionCount",
                  defaultMessage:
                    "{count} row(s) reuse a Sample ID already in this file or the system. Approved duplicates are registered with auto-generated unique IDs (for example, H-0001-R2). Unapproved duplicate rows are skipped.",
                },
                { count: duplicateRows.length },
              )}
              lowContrast
              hideCloseButton
              style={{ marginBottom: "1rem" }}
            />
          )}

          {duplicateRows.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <Checkbox
                id="allow-all-duplicates"
                labelText={intl.formatMessage({
                  id: "biorepository.manifest.duplicate.allowAll",
                  defaultMessage:
                    "Import duplicates as new samples (auto-assign unique IDs)",
                })}
                checked={allowAllDuplicates}
                onChange={(_, { checked }) =>
                  handleToggleAllowAllDuplicates(checked)
                }
              />
            </div>
          )}

          {duplicateRows.length > 0 && importableSampleCount === 0 && (
            <InlineNotification
              kind="warning"
              title={intl.formatMessage({
                id: "biorepository.manifest.duplicate.approvalRequired.title",
                defaultMessage: "Approval required to import duplicates",
              })}
              subtitle={intl.formatMessage({
                id: "biorepository.manifest.duplicate.approvalRequired.subtitle",
                defaultMessage:
                  'Check "Import duplicates as new samples" above, or use Include on individual rows, then click Import.',
              })}
              lowContrast
              hideCloseButton
              style={{ marginBottom: "1rem" }}
            />
          )}

          {validationErrors.length > 0 && (
            <InlineNotification
              kind="warning"
              title={intl.formatMessage({
                id: "biorepository.manifest.validation.title",
                defaultMessage: "Validation Errors",
              })}
              subtitle={intl.formatMessage({
                id: "biorepository.manifest.validation.subtitle",
                defaultMessage:
                  "Please fix the errors below before importing. Rows with errors are highlighted.",
              })}
              lowContrast
              hideCloseButton
              style={{ marginBottom: "1rem" }}
            />
          )}

          {validationErrors.length > 0 && importableSampleCount > 0 && (
            <InlineNotification
              kind="info"
              title={intl.formatMessage({
                id: "biorepository.manifest.partialImport.title",
                defaultMessage: "Partial Import Available",
              })}
              subtitle={intl.formatMessage(
                {
                  id: "biorepository.manifest.partialImport.subtitle",
                  defaultMessage:
                    "{count} valid sample(s) can still be imported. Rows marked Error will be skipped.",
                },
                { count: importableSampleCount },
              )}
              lowContrast
              hideCloseButton
              style={{ marginBottom: "1rem" }}
            />
          )}

          {validationWarnings.length > 0 && (
            <InlineNotification
              kind="info"
              title={intl.formatMessage({
                id: "biorepository.manifest.warnings.title",
                defaultMessage: "Validation Warnings",
              })}
              subtitle={intl.formatMessage({
                id: "biorepository.manifest.warnings.subtitle",
                defaultMessage:
                  "Some rows introduce new sample types. Those sample types will be created automatically during import and added to the biorepository-approved list.",
              })}
              lowContrast
              hideCloseButton
              style={{ marginBottom: "1rem" }}
            />
          )}

          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            <DataTable rows={tableRows} headers={tableHeaders} size="sm">
              {({
                rows,
                headers,
                getTableProps,
                getHeaderProps,
                getRowProps,
              }) => (
                <Table {...getTableProps()} size="sm">
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader
                          key={header.key}
                          {...getHeaderProps({ header })}
                        >
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const rowNumber = parseInt(row.id);
                      const rowErrors = getRowErrors(rowNumber);
                      const rowWarnings = getRowWarnings(rowNumber);
                      return (
                        <React.Fragment key={row.id}>
                          <TableRow {...getRowProps({ row })}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>
                                {cell.info.header === "status" ? (
                                  cell.value === "valid" ? (
                                    <Tag type="green" size="sm">
                                      <FormattedMessage
                                        id="biorepository.manifest.status.valid"
                                        defaultMessage="Valid"
                                      />
                                    </Tag>
                                  ) : cell.value === "warning" ? (
                                    <Tag type="warm-gray" size="sm">
                                      <FormattedMessage
                                        id="biorepository.manifest.status.warning"
                                        defaultMessage="Will Create Type"
                                      />
                                    </Tag>
                                  ) : cell.value === "duplicate" ? (
                                    <Tag type="purple" size="sm">
                                      <FormattedMessage
                                        id="biorepository.manifest.status.duplicate"
                                        defaultMessage="Duplicate"
                                      />
                                    </Tag>
                                  ) : (
                                    <Tag type="red" size="sm">
                                      <FormattedMessage
                                        id="biorepository.manifest.status.error"
                                        defaultMessage="Error"
                                      />
                                    </Tag>
                                  )
                                ) : cell.info.key === "include" &&
                                  cell.value === "checkbox" ? (
                                  <Checkbox
                                    id={`duplicate-include-${row.id}`}
                                    labelText=""
                                    hideLabel
                                    checked={Boolean(
                                      duplicateRowApprovals[rowNumber],
                                    )}
                                    onChange={(_, { checked }) =>
                                      handleToggleDuplicateRow(
                                        rowNumber,
                                        checked,
                                      )
                                    }
                                  />
                                ) : (
                                  cell.value
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                          {rowErrors.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={headers.length}>
                                <div
                                  style={{
                                    backgroundColor: "#fff1f1",
                                    padding: "0.5rem",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {rowErrors.map((err, idx) => (
                                    <div key={idx}>• {formatRowError(err)}</div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {rowWarnings.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={headers.length}>
                                <div
                                  style={{
                                    backgroundColor: "#fff8e1",
                                    padding: "0.5rem",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {rowWarnings.map((warning, idx) => (
                                    <div key={idx}>• {warning.message}</div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          </div>
        </div>
      )}
    </Modal>
  );
}

ManifestUploadModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  shipmentId: PropTypes.number,
  notebookId: PropTypes.number,
  onImportComplete: PropTypes.func,
};

export default ManifestUploadModal;
