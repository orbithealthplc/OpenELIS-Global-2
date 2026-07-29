import React, { useState, useCallback, useEffect, useContext } from "react";
import {
  Grid,
  Column,
  Section,
  Heading,
  Button,
  FileUploader,
  DataTable,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  InlineNotification,
  InlineLoading,
  ContentSwitcher,
  Switch,
  Dropdown,
} from "@carbon/react";
import { Download, Upload } from "@carbon/icons-react";
import { FormattedMessage, useIntl } from "react-intl";
import config from "../../config.json";
import { InventoryItemAPI } from "./InventoryService";
import UserSessionDetailsContext from "../../UserSessionDetailsContext";
import { filterOwningDepartments } from "../notebook/utils/notebookInventoryScope";
import {
  parseImportFile,
  validateCatalogImportLocal,
  validateLotImportLocal,
  importCatalogLocal,
  importLotsLocal,
  isImportApiUnavailable,
} from "./inventoryBulkImportHelpers";

const ACCEPTED_FILE_TYPES = [".csv", ".xlsx", ".xls"];

const CATALOG_TEMPLATE = `name,itemType,category,manufacturer,units,lowStockThreshold,concentration,storageRequirements
Ethanol 70%,REAGENT,Solvent,Merck,mL,10,70%,Room temperature`;

const LOTS_TEMPLATE = `itemName,lotNumber,quantity,expirationDate,qcStatus
Ethanol 70%,LOT-2024-001,500,2026-12-31,PENDING`;

const MODE_CATALOG = 0;
const MODE_LOTS = 1;

const normalizeValidationResult = (data) => ({
  ...data,
  valid: data?.valid ?? data?.isValid ?? false,
  totalRows: data?.totalRows ?? 0,
  validRows: data?.validRows ?? 0,
  invalidRows: data?.invalidRows ?? 0,
  errors: Array.isArray(data?.errors) ? data.errors : [],
  previewRows: Array.isArray(data?.previewRows) ? data.previewRows : [],
});

const InventoryBulkImport = () => {
  const intl = useIntl();
  const { userSessionDetails } = useContext(UserSessionDetailsContext);
  const [mode, setMode] = useState(MODE_CATALOG);
  const [file, setFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [assignableDepartments, setAssignableDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [usingLocalImport, setUsingLocalImport] = useState(false);

  const validateEndpoint =
    mode === MODE_CATALOG
      ? "/rest/inventory/import/catalog/validate"
      : "/rest/inventory/import/lots/validate";

  const importEndpoint =
    mode === MODE_CATALOG
      ? "/rest/inventory/import/catalog"
      : "/rest/inventory/import/lots";

  useEffect(() => {
    let cancelled = false;
    setDepartmentsLoading(true);
    InventoryItemAPI.getAssignableDepartments()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) {
          return;
        }
        const departments = filterOwningDepartments(list).map((item) => ({
          id: item.id,
          text: item.value || item.name || item.text || String(item.id),
        }));
        setAssignableDepartments(departments);
        const loginId = userSessionDetails?.loginLabUnitId;
        if (
          loginId &&
          departments.some((d) => String(d.id) === String(loginId))
        ) {
          setDepartmentId(String(loginId));
        } else if (departments.length === 1) {
          setDepartmentId(String(departments[0].id));
        } else {
          setDepartmentId("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignableDepartments([]);
          setDepartmentId("");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDepartmentsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userSessionDetails]);

  const resetState = useCallback(() => {
    setFile(null);
    setValidationResult(null);
    setImportResult(null);
    setError(null);
    setParsedRows([]);
    setUsingLocalImport(false);
  }, []);

  const handleModeChange = useCallback(
    ({ index }) => {
      setMode(index);
      resetState();
    },
    [resetState],
  );

  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
      setValidationResult(null);
      setImportResult(null);
      setError(null);
    }
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append("file", file);
    if (mode === MODE_CATALOG && departmentId) {
      formData.append("departmentId", departmentId);
    }
    return formData;
  };

  const handleDownloadTemplate = () => {
    const content = mode === MODE_CATALOG ? CATALOG_TEMPLATE : LOTS_TEMPLATE;
    const filename =
      mode === MODE_CATALOG
        ? "inventory-catalog-import-template.csv"
        : "inventory-lot-import-template.csv";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const runLocalValidation = async () => {
    const { rows } = await parseImportFile(file);
    setParsedRows(rows);
    setUsingLocalImport(true);

    const result =
      mode === MODE_CATALOG
        ? validateCatalogImportLocal(rows, departmentId)
        : await validateLotImportLocal(rows);

    const normalized = normalizeValidationResult(result);
    if (!normalized.valid && normalized.errors.length > 0) {
      setError("Validation failed. Please check the errors below.");
    }
    setValidationResult(normalized);
  };

  const handleValidate = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    if (
      mode === MODE_CATALOG &&
      assignableDepartments.length > 0 &&
      !departmentId
    ) {
      setError("Please select a department before validating");
      return;
    }

    setValidating(true);
    setError(null);
    setValidationResult(null);
    setImportResult(null);
    setUsingLocalImport(false);

    try {
      const response = await fetch(config.serverBaseUrl + validateEndpoint, {
        credentials: "include",
        method: "POST",
        headers: {
          "X-CSRF-Token": localStorage.getItem("CSRF"),
        },
        body: buildFormData(),
      });

      if (isImportApiUnavailable(response)) {
        await runLocalValidation();
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        setError(
          data?.error ||
            data?.message ||
            `Validation failed (${response.status})`,
        );
        return;
      }

      const normalized = normalizeValidationResult(data);
      if (!normalized.valid && normalized.errors.length > 0) {
        setError("Validation failed. Please check the errors below.");
      }
      setValidationResult(normalized);
    } catch (err) {
      try {
        await runLocalValidation();
      } catch (localErr) {
        setError(
          localErr?.message || err?.message || "Failed to validate file",
        );
      }
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    if (!validationResult?.valid) {
      setError("Please validate the file first and fix any errors");
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      if (usingLocalImport) {
        const rows =
          parsedRows.length > 0
            ? parsedRows
            : (await parseImportFile(file)).rows;
        const data =
          mode === MODE_CATALOG
            ? await importCatalogLocal(rows, departmentId)
            : await importLotsLocal(rows);

        if (data.success) {
          setImportResult(data);
        } else {
          setError(data.errors?.join("; ") || "Import failed");
        }
        return;
      }

      const response = await fetch(config.serverBaseUrl + importEndpoint, {
        credentials: "include",
        method: "POST",
        headers: {
          "X-CSRF-Token": localStorage.getItem("CSRF"),
        },
        body: buildFormData(),
      });

      if (isImportApiUnavailable(response)) {
        const rows =
          parsedRows.length > 0
            ? parsedRows
            : (await parseImportFile(file)).rows;
        const data =
          mode === MODE_CATALOG
            ? await importCatalogLocal(rows, departmentId)
            : await importLotsLocal(rows);

        if (data.success) {
          setImportResult(data);
        } else {
          setError(data.errors?.join("; ") || "Import failed");
        }
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        setError(
          data?.error || data?.message || `Import failed (${response.status})`,
        );
        return;
      }

      if (data?.success) {
        setImportResult(data);
      } else {
        setError(data?.error || data?.errors?.join("; ") || "Import failed");
      }
    } catch (err) {
      setError(err?.message || "Failed to import file");
    } finally {
      setImporting(false);
    }
  };

  const errorHeaders = [
    { key: "rowNumber", header: "Row" },
    { key: "field", header: "Field" },
    { key: "message", header: "Error Message" },
  ];

  const catalogPreviewHeaders = [
    { key: "rowNumber", header: "Row" },
    { key: "name", header: "Name" },
    { key: "itemType", header: "Type" },
    { key: "category", header: "Category" },
    { key: "manufacturer", header: "Manufacturer" },
    { key: "units", header: "Units" },
  ];

  const lotsPreviewHeaders = [
    { key: "rowNumber", header: "Row" },
    { key: "name", header: "Item Name" },
    { key: "lotNumber", header: "Lot Number" },
    { key: "quantity", header: "Quantity" },
    { key: "expirationDate", header: "Expiration" },
  ];

  const previewHeaders =
    mode === MODE_CATALOG ? catalogPreviewHeaders : lotsPreviewHeaders;

  const descriptionId =
    mode === MODE_CATALOG
      ? "inventory.bulkImport.catalog.description"
      : "inventory.bulkImport.lots.description";

  const catalogNeedsDepartment =
    mode === MODE_CATALOG && assignableDepartments.length > 0 && !departmentId;

  return (
    <Section>
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4}>
          <Heading>
            <FormattedMessage
              id="inventory.bulkImport.title"
              defaultMessage="Bulk Import"
            />
          </Heading>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <ContentSwitcher
            onChange={handleModeChange}
            selectedIndex={mode}
            style={{ marginTop: "1rem", marginBottom: "1rem" }}
          >
            <Switch name="catalog">
              <Upload size={16} style={{ marginRight: "0.5rem" }} />
              <FormattedMessage
                id="inventory.bulkImport.catalog.title"
                defaultMessage="Import Catalog Items"
              />
            </Switch>
            <Switch name="lots">
              <Upload size={16} style={{ marginRight: "0.5rem" }} />
              <FormattedMessage
                id="inventory.bulkImport.lots.title"
                defaultMessage="Import Stock Lots"
              />
            </Switch>
          </ContentSwitcher>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <p style={{ marginBottom: "1rem" }}>
            <FormattedMessage id={descriptionId} />
          </p>
        </Column>

        {mode === MODE_CATALOG && (
          <Column lg={8} md={4} sm={4}>
            {departmentsLoading ? (
              <InlineLoading
                description={intl.formatMessage({
                  id: "inventory.bulkImport.department.loading",
                  defaultMessage: "Loading departments…",
                })}
              />
            ) : assignableDepartments.length > 0 ? (
              <Dropdown
                id="inventory-bulk-import-department"
                titleText={intl.formatMessage({
                  id: "inventory.bulkImport.department.label",
                  defaultMessage: "Department (lab unit)",
                })}
                label={intl.formatMessage({
                  id: "inventory.bulkImport.department.placeholder",
                  defaultMessage: "Select department",
                })}
                items={assignableDepartments}
                itemToString={(item) =>
                  item ? item.text || item.value || String(item.id) : ""
                }
                selectedItem={
                  assignableDepartments.find(
                    (d) => String(d.id) === String(departmentId),
                  ) || null
                }
                onChange={({ selectedItem }) => {
                  setDepartmentId(selectedItem ? String(selectedItem.id) : "");
                  setValidationResult(null);
                  setImportResult(null);
                }}
              />
            ) : (
              <InlineNotification
                kind="warning"
                title={intl.formatMessage({
                  id: "inventory.bulkImport.department.none.title",
                  defaultMessage: "No departments available",
                })}
                subtitle={intl.formatMessage({
                  id: "inventory.bulkImport.department.none.subtitle",
                  defaultMessage:
                    "Your account has no assignable lab unit. Contact an administrator to assign a department.",
                })}
                lowContrast
              />
            )}
          </Column>
        )}

        <Column lg={16} md={8} sm={4}>
          <Button
            kind="tertiary"
            renderIcon={Download}
            onClick={handleDownloadTemplate}
            style={{ marginBottom: "1rem", marginTop: "1rem" }}
          >
            <FormattedMessage
              id="inventory.bulkImport.downloadTemplate"
              defaultMessage="Download Template"
            />
          </Button>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <FileUploader
            labelTitle={intl.formatMessage({
              id: "inventory.bulkImport.uploadLabel",
              defaultMessage: "Upload File",
            })}
            labelDescription={`CSV or Excel (${ACCEPTED_FILE_TYPES.join(", ")})`}
            buttonLabel={intl.formatMessage({
              id: "inventory.bulkImport.selectFile",
              defaultMessage: "Select file",
            })}
            filenameStatus="edit"
            accept={ACCEPTED_FILE_TYPES}
            multiple={false}
            onChange={handleFileUpload}
          />
        </Column>

        <Column lg={16} md={8} sm={4} style={{ marginTop: "1rem" }}>
          <Button
            kind="primary"
            onClick={handleValidate}
            disabled={!file || validating || catalogNeedsDepartment}
          >
            {validating ? (
              <InlineLoading description="Validating..." />
            ) : (
              <FormattedMessage id="label.button.validate" />
            )}
          </Button>
          <Button
            kind="primary"
            onClick={handleImport}
            disabled={
              !file ||
              !validationResult?.valid ||
              importing ||
              catalogNeedsDepartment
            }
            style={{ marginLeft: "1rem" }}
          >
            {importing ? (
              <InlineLoading description="Importing..." />
            ) : (
              <FormattedMessage id="label.button.import" />
            )}
          </Button>
        </Column>

        {error && (
          <Column lg={16} md={8} sm={4} style={{ marginTop: "1rem" }}>
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={error}
              lowContrast
            />
          </Column>
        )}

        {importResult?.success && (
          <Column lg={16} md={8} sm={4} style={{ marginTop: "1rem" }}>
            <InlineNotification
              kind="success"
              title="Success"
              subtitle={intl.formatMessage(
                {
                  id: "inventory.bulkImport.success",
                  defaultMessage: "Successfully imported {count} row(s).",
                },
                { count: importResult.createdCount || 0 },
              )}
              lowContrast
            />
          </Column>
        )}

        {validationResult && (
          <Column lg={16} md={8} sm={4} style={{ marginTop: "2rem" }}>
            <Heading>
              <FormattedMessage id="label.validation.results" />
            </Heading>
            <div style={{ marginTop: "1rem" }}>
              <p>
                <strong>Total Rows:</strong> {validationResult.totalRows}
              </p>
              <p>
                <strong>Valid Rows:</strong> {validationResult.validRows}
              </p>
              <p>
                <strong>Invalid Rows:</strong> {validationResult.invalidRows}
              </p>
              <p>
                <strong>Validation Status:</strong>{" "}
                {validationResult.valid ? (
                  <span style={{ color: "green" }}>Valid</span>
                ) : (
                  <span style={{ color: "red" }}>Invalid</span>
                )}
              </p>
            </div>

            {validationResult.errors?.length > 0 && (
              <div style={{ marginTop: "2rem" }}>
                <Heading>
                  <FormattedMessage id="label.validation.errors" />
                </Heading>
                <DataTable
                  rows={validationResult.errors.map((rowError, index) => ({
                    id: String(index),
                    rowNumber: rowError.rowNumber,
                    field: rowError.field,
                    message: rowError.message,
                  }))}
                  headers={errorHeaders}
                >
                  {({ rows, headers, getHeaderProps, getTableProps }) => (
                    <table {...getTableProps()}>
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
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  )}
                </DataTable>
              </div>
            )}

            {validationResult.previewRows?.length > 0 && (
              <div style={{ marginTop: "2rem" }}>
                <Heading>
                  <FormattedMessage id="label.preview.data" />
                </Heading>
                <DataTable
                  rows={validationResult.previewRows.map((row, index) => ({
                    id: String(index),
                    rowNumber: row.rowNumber,
                    name: row.name || "-",
                    itemType: row.itemType || "-",
                    category: row.category || "-",
                    manufacturer: row.manufacturer || "-",
                    units: row.units || "-",
                    lotNumber: row.lotNumber || "-",
                    quantity: row.quantity || "-",
                    expirationDate: row.expirationDate || "-",
                  }))}
                  headers={previewHeaders}
                >
                  {({ rows, headers, getHeaderProps, getTableProps }) => (
                    <table {...getTableProps()}>
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
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  )}
                </DataTable>
              </div>
            )}
          </Column>
        )}
      </Grid>
    </Section>
  );
};

export default InventoryBulkImport;
