import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  Button,
  InlineNotification,
  Loading,
  Search,
} from "@carbon/react";
import { ArrowRight, Document } from "@carbon/icons-react";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";
import { getFromOpenElisServer } from "../../../utils/Utils";

const DEFAULT_LIMIT = 100;

function isDocumentationReady(status) {
  return status === "VERIFIED" || status === "QUARANTINE";
}

function normalizeShipmentList(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.shipments)) {
    return data.shipments;
  }
  return null;
}

function ShipmentListTable({
  onSelect,
  onVerify,
  selectedShipmentId,
  showDocStatus = false,
  showVerifyAction = false,
  selectButtonLabel,
  refreshKey = 0,
}) {
  const intl = useIntl();
  const [shipments, setShipments] = useState([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const continueLabelForStatus = useCallback(
    (documentationStatus) => {
      if (selectButtonLabel) {
        return selectButtonLabel;
      }
      if (isDocumentationReady(documentationStatus)) {
        return intl.formatMessage({
          id: "biorepository.shipment.button.continueToRegistration",
          defaultMessage: "Continue to Sample Registration",
        });
      }
      return intl.formatMessage({
        id: "biorepository.shipment.button.continueToDocumentation",
        defaultMessage: "Continue to Documentation",
      });
    },
    [intl, selectButtonLabel],
  );

  const loadShipments = useCallback(
    (query = "") => {
      setLoadingShipments(true);
      setLoadError(null);
      const trimmed = (query || "").trim();
      const endpoint = trimmed
        ? `/rest/biorepository/shipment/search?query=${encodeURIComponent(trimmed)}&limit=${DEFAULT_LIMIT}`
        : `/rest/biorepository/shipment?limit=${DEFAULT_LIMIT}`;

      getFromOpenElisServer(endpoint, (data, error) => {
        // getFromOpenElisServer passes errors as callback(undefined, error) —
        // the 3rd argument is AbortSignal, not an error callback.
        if (error || data === undefined || data === null) {
          setShipments([]);
          setLoadError(
            intl.formatMessage({
              id: "biorepository.shipment.list.error.message",
              defaultMessage:
                "Could not load shipments. Check your connection and try again.",
            }),
          );
          setLoadingShipments(false);
          return;
        }

        if (data.error) {
          setShipments([]);
          setLoadError(
            typeof data.error === "string"
              ? data.error
              : intl.formatMessage({
                  id: "biorepository.shipment.list.error.message",
                  defaultMessage:
                    "Could not load shipments. Check your connection and try again.",
                }),
          );
          setLoadingShipments(false);
          return;
        }

        const list = normalizeShipmentList(data);
        if (list === null) {
          setShipments([]);
          setLoadError(
            intl.formatMessage({
              id: "biorepository.shipment.list.error.invalidResponse",
              defaultMessage: "Unexpected response while loading shipments.",
            }),
          );
        } else {
          setShipments(list);
          setLoadError(null);
        }
        setLoadingShipments(false);
      });
    },
    [intl],
  );

  useEffect(() => {
    loadShipments(searchTerm);
  }, [loadShipments, refreshKey]);

  const handleSearchChange = useCallback((eventOrValue) => {
    const value =
      typeof eventOrValue === "string"
        ? eventOrValue
        : (eventOrValue?.target?.value ?? "");
    setSearchTerm(value);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    loadShipments(searchTerm);
  }, [loadShipments, searchTerm]);

  const handleSearchClear = useCallback(() => {
    setSearchTerm("");
    loadShipments("");
  }, [loadShipments]);

  const getStatusTag = (status) => {
    const statusColors = {
      RECEIVED: "blue",
      PROCESSING: "cyan",
      COMPLETED: "green",
      CANCELLED: "red",
    };
    return (
      <Tag type={statusColors[status] || "gray"} size="sm">
        {status}
      </Tag>
    );
  };

  const getDocStatusTag = (status) => {
    const docColors = {
      VERIFIED: "green",
      QUARANTINE: "red",
      PENDING: "gray",
    };
    const label =
      status === "VERIFIED"
        ? intl.formatMessage({
            id: "biorepository.shipment.docStatus.verified",
            defaultMessage: "Verified",
          })
        : status === "QUARANTINE"
          ? intl.formatMessage({
              id: "biorepository.shipment.docStatus.quarantine",
              defaultMessage: "Quarantine",
            })
          : intl.formatMessage({
              id: "biorepository.shipment.docStatus.pending",
              defaultMessage: "Pending",
            });
    return (
      <Tag type={docColors[status] || "gray"} size="sm">
        {label}
      </Tag>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const headers = useMemo(
    () => [
      {
        key: "deliveryReference",
        header: intl.formatMessage({
          id: "biorepository.shipment.table.deliveryRef",
          defaultMessage: "Delivery Ref",
        }),
      },
      {
        key: "senderName",
        header: intl.formatMessage({
          id: "biorepository.shipment.table.sender",
          defaultMessage: "Sender",
        }),
      },
      {
        key: "expectedSampleCount",
        header: intl.formatMessage({
          id: "biorepository.shipment.table.samples",
          defaultMessage: "Expected Samples",
        }),
      },
      {
        key: "receptionTimestamp",
        header: intl.formatMessage({
          id: "biorepository.shipment.table.received",
          defaultMessage: "Received",
        }),
      },
      ...(showDocStatus
        ? [
            {
              key: "documentationStatus",
              header: intl.formatMessage({
                id: "biorepository.shipment.table.docStatus",
                defaultMessage: "Doc Status",
              }),
            },
          ]
        : [
            {
              key: "status",
              header: intl.formatMessage({
                id: "biorepository.shipment.table.status",
                defaultMessage: "Status",
              }),
            },
          ]),
      {
        key: "actions",
        header: intl.formatMessage({
          id: "biorepository.shipment.table.actions",
          defaultMessage: "Actions",
        }),
      },
    ],
    [intl, showDocStatus],
  );

  const rows = shipments.map((shipment) => ({
    id: String(shipment.id),
    deliveryReference: shipment.deliveryReference,
    senderName: shipment.senderName,
    expectedSampleCount: shipment.expectedSampleCount ?? "-",
    status: shipment.status,
    documentationStatus: shipment.documentationStatus || "PENDING",
    receptionTimestamp: shipment.receptionTimestamp,
    _original: shipment,
  }));

  const searchControl = (
    <div style={{ marginBottom: "1rem", maxWidth: "28rem" }}>
      <Search
        id="shipment-list-search"
        labelText={intl.formatMessage({
          id: "biorepository.shipment.list.search",
          defaultMessage: "Search shipments",
        })}
        placeholder={intl.formatMessage({
          id: "biorepository.shipment.list.search.placeholder",
          defaultMessage: "Delivery ref, sender, or organization",
        })}
        value={searchTerm}
        onChange={handleSearchChange}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSearchSubmit();
          }
        }}
        onClear={handleSearchClear}
        size="md"
      />
      <div style={{ marginTop: "0.5rem" }}>
        <Button kind="tertiary" size="sm" onClick={handleSearchSubmit}>
          <FormattedMessage id="label.button.search" defaultMessage="Search" />
        </Button>
      </div>
    </div>
  );

  if (loadingShipments) {
    return (
      <div>
        {searchControl}
        <Loading withOverlay description="Loading shipments..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        {searchControl}
        <InlineNotification
          kind="error"
          title={intl.formatMessage({
            id: "biorepository.shipment.list.error.title",
            defaultMessage: "Failed to load shipments",
          })}
          subtitle={loadError}
          lowContrast
          hideCloseButton
        />
        <Button
          kind="ghost"
          size="sm"
          style={{ marginTop: "0.5rem" }}
          onClick={() => loadShipments(searchTerm)}
        >
          <FormattedMessage id="label.button.retry" defaultMessage="Retry" />
        </Button>
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <div>
        {searchControl}
        <InlineNotification
          kind="info"
          title={intl.formatMessage({
            id: "biorepository.shipment.list.empty.title",
            defaultMessage: "No Shipments",
          })}
          subtitle={intl.formatMessage({
            id: searchTerm.trim()
              ? "biorepository.shipment.list.empty.search"
              : "biorepository.shipment.list.empty.message",
            defaultMessage: searchTerm.trim()
              ? "No shipments match your search."
              : "No shipments have been received yet. Click 'Receive New Shipment' to get started.",
          })}
          lowContrast
          hideCloseButton
        />
      </div>
    );
  }

  return (
    <div>
      {searchControl}
      <DataTable rows={rows} headers={headers} isSortable>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const originalShipment = shipments.find(
                  (s) => String(s.id) === row.id,
                );
                const isSelected =
                  selectedShipmentId != null &&
                  String(selectedShipmentId) === row.id;
                const docStatus =
                  originalShipment?.documentationStatus || "PENDING";

                return (
                  <TableRow
                    key={row.id}
                    {...getRowProps({ row })}
                    style={{
                      cursor: "pointer",
                      ...(isSelected
                        ? { backgroundColor: "var(--cds-layer-selected)" }
                        : {}),
                    }}
                    onClick={() => onSelect?.(originalShipment)}
                  >
                    {row.cells.map((cell) => {
                      if (cell.info.header === "status") {
                        return (
                          <TableCell key={cell.id}>
                            {getStatusTag(cell.value)}
                          </TableCell>
                        );
                      }
                      if (cell.info.header === "documentationStatus") {
                        return (
                          <TableCell key={cell.id}>
                            {getDocStatusTag(cell.value)}
                          </TableCell>
                        );
                      }
                      if (cell.info.header === "receptionTimestamp") {
                        return (
                          <TableCell key={cell.id}>
                            {formatDate(cell.value)}
                          </TableCell>
                        );
                      }
                      if (cell.info.header === "actions") {
                        return (
                          <TableCell
                            key={cell.id}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <Button
                                kind="ghost"
                                size="sm"
                                renderIcon={ArrowRight}
                                onClick={() => onSelect?.(originalShipment)}
                              >
                                {continueLabelForStatus(docStatus)}
                              </Button>
                              {showVerifyAction && onVerify && (
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  renderIcon={Document}
                                  onClick={() => onVerify(originalShipment)}
                                >
                                  <FormattedMessage
                                    id="biorepository.shipment.button.verifyDocs"
                                    defaultMessage="Verify docs"
                                  />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        );
                      }
                      return <TableCell key={cell.id}>{cell.value}</TableCell>;
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </div>
  );
}

ShipmentListTable.propTypes = {
  onSelect: PropTypes.func,
  onVerify: PropTypes.func,
  selectedShipmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  showDocStatus: PropTypes.bool,
  showVerifyAction: PropTypes.bool,
  selectButtonLabel: PropTypes.string,
  refreshKey: PropTypes.number,
};

export default ShipmentListTable;
export { isDocumentationReady };
