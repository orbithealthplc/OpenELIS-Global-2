import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  FileUploaderDropContainer,
  FileUploaderItem,
  Button,
  InlineNotification,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Tag,
} from "@carbon/react";
import { Download } from "@carbon/react/icons";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";
import { postToOpenElisServerJsonResponse } from "../../../utils/Utils";
import {
  buildDeviceTemplateCsv,
  buildRoomTemplateCsv,
  downloadCsvTemplate,
  parseDeviceImportCsv,
  parseRoomImportCsv,
} from "./environmentalImportHelpers";

function EnvironmentalCsvImportModal({
  open,
  onClose,
  entryId,
  importType,
  scopeUnit,
  devices,
  rooms,
  onImportSuccess,
}) {
  const intl = useIntl();
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const isDeviceImport = importType === "device";
  const scopeLabel = isDeviceImport
    ? scopeUnit?.name || scopeUnit?.code || ""
    : scopeUnit?.name || scopeUnit?.code || "";

  const resetState = useCallback(() => {
    setFile(null);
    setParseResult(null);
    setImporting(false);
    setError(null);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    if (isDeviceImport) {
      downloadCsvTemplate(
        "biorepository_device_temperature_template.csv",
        buildDeviceTemplateCsv(),
      );
      return;
    }
    downloadCsvTemplate(
      "biorepository_zone_environment_template.csv",
      buildRoomTemplateCsv(),
    );
  };

  const handleFileAdd = (event, { addedFiles }) => {
    const nextFile = addedFiles?.[0];
    if (!nextFile) {
      return;
    }

    setError(null);
    setFile(nextFile);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result || "";
      const parsed = isDeviceImport
        ? parseDeviceImportCsv(text, devices, scopeUnit)
        : parseRoomImportCsv(text, rooms, scopeUnit);
      setParseResult(parsed);
    };
    reader.onerror = () => {
      setError(
        intl.formatMessage({
          id: "biorepository.environmental.import.readError",
          defaultMessage: "Failed to read the CSV file.",
        }),
      );
    };
    reader.readAsText(nextFile);
  };

  const handleFileRemove = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
  };

  const previewHeaders = useMemo(() => {
    if (isDeviceImport) {
      return [
        { key: "rowNumber", header: "Row" },
        { key: "device_code", header: "Device" },
        { key: "checked_date_time", header: "Date/Time" },
        { key: "temperature_value", header: "Temp" },
        { key: "status", header: "Status" },
      ];
    }
    return [
      { key: "rowNumber", header: "Row" },
      { key: "room_code", header: "Zone" },
      { key: "checked_date_time", header: "Date/Time" },
      { key: "oxygen_level", header: "O2 %" },
      { key: "humidity", header: "Humidity %" },
      { key: "status", header: "Status" },
    ];
  }, [isDeviceImport]);

  const previewRows = useMemo(() => {
    if (!parseResult?.previewRows) {
      return [];
    }
    return parseResult.previewRows.slice(0, 20).map((row) => ({
      id: String(row.rowNumber),
      ...row,
      status:
        row.status === "valid" ? (
          <Tag type="green">Valid</Tag>
        ) : (
          <Tag type="red">Error</Tag>
        ),
    }));
  }, [parseResult]);

  const validCount = parseResult?.validRows?.length || 0;
  const errorCount = parseResult?.errors?.length || 0;

  const handleImport = () => {
    if (!entryId || !parseResult?.validRows?.length) {
      return;
    }

    setImporting(true);
    setError(null);

    const rows = parseResult.validRows.map((row) => {
      if (isDeviceImport) {
        return {
          deviceCode: row.deviceCode,
          checkedDateTime: row.checkedDateTime,
          temperatureValue: row.temperatureValue,
          temperatureUnit: row.temperatureUnit,
          checkTime: row.checkTime,
          checkedBy: row.checkedBy,
          notes: row.notes,
        };
      }
      return {
        roomCode: row.roomCode,
        roomId: row.roomId,
        roomName: row.roomName,
        checkedDateTime: row.checkedDateTime,
        oxygenLevel: row.oxygenLevel,
        humidity: row.humidity,
        checkedBy: row.checkedBy,
        notes: row.notes,
      };
    });

    const scopeCode = isDeviceImport
      ? scopeUnit?.name || scopeUnit?.code
      : scopeUnit?.code || scopeUnit?.name;

    const queryParam = isDeviceImport
      ? scopeCode
        ? `?deviceCode=${encodeURIComponent(scopeCode)}`
        : ""
      : scopeCode
        ? `?roomCode=${encodeURIComponent(scopeCode)}`
        : "";

    const endpoint = isDeviceImport
      ? `/rest/notebook-entry/${entryId}/temperature-logs/import${queryParam}`
      : `/rest/notebook-entry/${entryId}/room-environment-logs/import${queryParam}`;

    const payload = isDeviceImport
      ? { deviceCode: scopeCode || null, rows }
      : { roomCode: scopeCode || null, rows };

    postToOpenElisServerJsonResponse(
      endpoint,
      JSON.stringify(payload),
      (response) => {
        setImporting(false);

        if (response && (response.importedCount > 0 || response.success)) {
          if (onImportSuccess) {
            onImportSuccess(response);
          }
          handleClose();
          return;
        }

        const responseErrors = response?.errors || [];
        if (responseErrors.length > 0) {
          setError(
            responseErrors
              .map((item) => `Row ${item.row}: ${item.message}`)
              .join("; "),
          );
          return;
        }

        setError(
          response?.error ||
            intl.formatMessage({
              id: "biorepository.environmental.import.failed",
              defaultMessage:
                "Import failed. Please review the file and try again.",
            }),
        );
      },
    );
  };

  return (
    <Modal
      open={open}
      onRequestClose={handleClose}
      modalHeading={intl.formatMessage(
        isDeviceImport
          ? {
              id: "biorepository.environmental.import.device.title",
              defaultMessage: "Import Device Temperature CSV",
            }
          : {
              id: "biorepository.environmental.import.room.title",
              defaultMessage: "Import Zone Environment CSV",
            },
      )}
      primaryButtonText={
        importing
          ? intl.formatMessage({
              id: "biorepository.environmental.import.importing",
              defaultMessage: "Importing...",
            })
          : intl.formatMessage({
              id: "biorepository.environmental.import.confirm",
              defaultMessage: "Import readings",
            })
      }
      secondaryButtonText={intl.formatMessage({
        id: "common.cancel",
        defaultMessage: "Cancel",
      })}
      onRequestSubmit={handleImport}
      primaryButtonDisabled={importing || validCount === 0}
      size="lg"
    >
      {scopeLabel && (
        <p style={{ marginBottom: "1rem", color: "#525252" }}>
          <FormattedMessage
            id="biorepository.environmental.import.scopedTo"
            defaultMessage="Importing readings for: {unit}"
            values={{ unit: scopeLabel }}
          />
        </p>
      )}

      <p style={{ marginBottom: "1rem", color: "#525252" }}>
        <FormattedMessage
          id="biorepository.environmental.import.description"
          defaultMessage="Upload a CSV export from your monitoring device. Review the preview, then import valid rows."
        />
      </p>

      <Button
        kind="ghost"
        size="sm"
        renderIcon={Download}
        onClick={handleDownloadTemplate}
        style={{ marginBottom: "1rem" }}
      >
        <FormattedMessage
          id="biorepository.environmental.import.downloadTemplate"
          defaultMessage="Download CSV template"
        />
      </Button>

      <FileUploaderDropContainer
        accept={[".csv"]}
        labelText={intl.formatMessage({
          id: "biorepository.environmental.import.dropLabel",
          defaultMessage: "Drag and drop a CSV file here or click to upload",
        })}
        onAddFiles={handleFileAdd}
      />

      {file && (
        <FileUploaderItem
          name={file.name}
          status="edit"
          onDelete={handleFileRemove}
          style={{ marginTop: "0.5rem", maxWidth: "100%" }}
        />
      )}

      {parseResult && (
        <div style={{ marginTop: "1rem" }}>
          <InlineNotification
            kind={errorCount > 0 ? "warning" : "success"}
            title={intl.formatMessage(
              {
                id: "biorepository.environmental.import.summary",
                defaultMessage: "{valid} valid row(s), {errors} error(s)",
              },
              { valid: validCount, errors: errorCount },
            )}
            lowContrast
            hideCloseButton
          />
        </div>
      )}

      {error && (
        <InlineNotification
          kind="error"
          title={intl.formatMessage({
            id: "biorepository.environmental.import.error",
            defaultMessage: "Import error",
          })}
          subtitle={error}
          lowContrast
          hideCloseButton
          style={{ marginTop: "1rem" }}
        />
      )}

      {previewRows.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h5 style={{ marginBottom: "0.5rem" }}>
            <FormattedMessage
              id="biorepository.environmental.import.preview"
              defaultMessage="Preview (first 20 rows)"
            />
          </h5>
          <DataTable rows={previewRows} headers={previewHeaders} size="sm">
            {({
              rows,
              headers,
              getTableProps,
              getHeaderProps,
              getRowProps,
            }) => (
              <TableContainer>
                <Table {...getTableProps()}>
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
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </div>
      )}
    </Modal>
  );
}

EnvironmentalCsvImportModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  entryId: PropTypes.number,
  importType: PropTypes.oneOf(["device", "room"]).isRequired,
  scopeUnit: PropTypes.object,
  devices: PropTypes.array,
  rooms: PropTypes.array,
  onImportSuccess: PropTypes.func,
};

export default EnvironmentalCsvImportModal;
