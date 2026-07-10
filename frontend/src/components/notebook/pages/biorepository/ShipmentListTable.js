import React, { useState, useCallback, useEffect } from "react";
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

const isDocsComplete = (status) =>
  status === "VERIFIED" || status === "QUARANTINE";

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

  const loadShipments = useCallback(() => {
    setLoadingShipments(true);
    setLoadError(null);
    getFromOpenElisServer("/rest/biorepository/shipment?limit=200", (data) => {
      if (data && Array.isArray(data)) {
        setShipments(data);
        setLoadError(null);
      } else if (data && Array.isArray(data.shipments)) {
        setShipments(data.shipments);
        setLoadError(null);
      } else if (data === undefined) {
        setShipments([]);
        setLoadError(
          intl.formatMessage({
            id: "biorepository.shipment.list.loadError",
            defaultMessage:
              "Could not load shipments. Check your connection and try again.",
          }),
        );
      } else {
        setShipments([]);
        setLoadError(null);
      }
      setLoadingShipments(false);
    });
  }, [intl]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments, refreshKey]);

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

  const getContinueLabel = (shipment) => {
    if (selectButtonLabel) {
      return selectButtonLabel;
    }
    if (isDocsComplete(shipment?.documentationStatus)) {
      return intl.formatMessage({
        id: "biorepository.shipment.button.continueToRegistration",
        defaultMessage: "Continue to Sample Registration",
      });
    }
    return intl.formatMessage({
      id: "biorepository.shipment.button.continueToDocumentation",
      defaultMessage: "Continue to Documentation",
    });
  };

  const headers = [
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
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredShipments = normalizedSearch
    ? shipments.filter((shipment) => {
        const haystack = [
          shipment.deliveryReference,
          shipment.senderName,
          shipment.senderOrganization,
          shipment.documentationStatus,
          shipment.status,
          shipment.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : shipments;

  const rows = filteredShipments.map((shipment) => ({
    id: String(shipment.id),
    deliveryReference: shipment.deliveryReference || "-",
    senderName: shipment.senderName || "-",
    expectedSampleCount: shipment.expectedSampleCount ?? "-",
    status: shipment.status,
    documentationStatus: shipment.documentationStatus || "PENDING",
    receptionTimestamp: shipment.receptionTimestamp,
    actions: "",
  }));

  if (loadingShipments) {
    return <Loading withOverlay description="Loading shipments..." />;
  }

  if (loadError) {
    return (
      <div>
        <InlineNotification
          kind="error"
          title={intl.formatMessage({
            id: "biorepository.shipment.list.loadError.title",
            defaultMessage: "Failed to load shipments",
          })}
          subtitle={loadError}
          lowContrast
          hideCloseButton
        />
        <Button
          kind="tertiary"
          size="sm"
          onClick={loadShipments}
          style={{ marginTop: "0.75rem" }}
        >
          <FormattedMessage
            id="biorepository.shipment.list.retry"
            defaultMessage="Retry"
          />
        </Button>
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <InlineNotification
        kind="info"
        title={intl.formatMessage({
          id: "biorepository.shipment.list.empty.title",
          defaultMessage: "No Shipments",
        })}
        subtitle={intl.formatMessage({
          id: "biorepository.shipment.list.empty.message",
          defaultMessage:
            "No shipments have been received yet. Click 'Receive New Shipment' to get started.",
        })}
        lowContrast
        hideCloseButton
      />
    );
  }

  return (
    <div>
      <Search
        id="shipment-list-search"
        size="md"
        labelText={intl.formatMessage({
          id: "biorepository.shipment.list.search",
          defaultMessage: "Search shipments",
        })}
        placeholder={intl.formatMessage({
          id: "biorepository.shipment.list.search.placeholder",
          defaultMessage: "Search by delivery ref, sender, or status...",
        })}
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target?.value || "")}
        onClear={() => setSearchTerm("")}
        style={{ marginBottom: "1rem", maxWidth: "28rem" }}
      />

      {filteredShipments.length === 0 ? (
        <InlineNotification
          kind="info"
          title={intl.formatMessage({
            id: "biorepository.shipment.list.noMatches.title",
            defaultMessage: "No matching shipments",
          })}
          subtitle={intl.formatMessage({
            id: "biorepository.shipment.list.noMatches.message",
            defaultMessage: "Try a different search term.",
          })}
          lowContrast
          hideCloseButton
        />
      ) : (
        <DataTable rows={rows} headers={headers} isSortable>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
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
                {rows.map((row) => {
                  const originalShipment = filteredShipments.find(
                    (s) => String(s.id) === row.id,
                  );
                  const isSelected =
                    selectedShipmentId != null &&
                    String(selectedShipmentId) === row.id;

                  return (
                    <TableRow
                      key={row.id}
                      {...getRowProps({ row })}
                      style={{
                        cursor: onSelect ? "pointer" : undefined,
                        ...(isSelected
                          ? {
                              backgroundColor: "var(--cds-layer-selected)",
                            }
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
                                  {getContinueLabel(originalShipment)}
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
                        return (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTable>
      )}
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
