import React, { useState, useCallback, useEffect } from "react";
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  Button,
  Modal,
  TextArea,
  Tag,
  InlineNotification,
  Loading,
  ExpandableSearch,
  Pagination,
} from "@carbon/react";
import { Checkmark, Close, View, Renew } from "@carbon/icons-react";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";
import { formatQuantityWithUnit } from "./biorepositoryQuantityHelpers";
import { formatRequestedReferenceSummary } from "../common/biorepoRequestReferenceHelpers";
import {
  getRequestDisplayStatus,
  getRequestLineCount,
} from "./biorepoRetrievalStatusHelpers";
import {
  getFromOpenElisServer,
  postToOpenElisServerJsonResponse,
} from "../../../utils/Utils";

/**
 * IncomingRequestsTab - Queue of incoming sample retrieval requests from other departments.
 * Accept generates a work order; Reject requires a reason.
 */
function IncomingRequestsTab({ onActionComplete, onAccepted }) {
  const intl = useIntl();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [acceptNotes, setAcceptNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadRequestDetails = useCallback((requestId, onLoaded) => {
    setDetailsLoading(true);
    getFromOpenElisServer(
      `/rest/biorepository/retrieval/requests/${requestId}`,
      (data) => {
        setDetailsLoading(false);
        if (data && !data.error) {
          onLoaded(data);
        } else {
          setError(
            data?.error || "Failed to load request details. Please try again.",
          );
        }
      },
    );
  }, []);

  const loadRequests = useCallback(() => {
    setLoading(true);
    setError(null);

    getFromOpenElisServer(
      "/rest/biorepository/retrieval/requests/pending?limit=100",
      (data) => {
        setLoading(false);
        if (data && data.error) {
          setError(data.error);
          return;
        }
        if (data && Array.isArray(data)) {
          setRequests(data);
        } else {
          setRequests([]);
        }
      },
    );
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = requests.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.requestNumber && r.requestNumber.toLowerCase().includes(term)) ||
      (r.requestPurpose && r.requestPurpose.toLowerCase().includes(term)) ||
      (r.requestedByName && r.requestedByName.toLowerCase().includes(term)) ||
      (r.requesterLabUnit && r.requesterLabUnit.toLowerCase().includes(term)) ||
      (r.requestorName && r.requestorName.toLowerCase().includes(term))
    );
  });

  const paginatedRequests = filteredRequests.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const handleAccept = useCallback(() => {
    if (!selectedRequest) return;

    setActionLoading(true);
    postToOpenElisServerJsonResponse(
      `/rest/biorepository/retrieval/requests/${selectedRequest.id}/approve`,
      JSON.stringify({ approvalNotes: acceptNotes || null }),
      (data) => {
        setActionLoading(false);
        if (data && data.error) {
          setError(data.error);
          return;
        }
        setAcceptModalOpen(false);
        setSelectedRequest(null);
        setAcceptNotes("");
        loadRequests();
        if (onActionComplete) {
          onActionComplete();
        }
        if (onAccepted) {
          onAccepted();
        }
      },
    );
  }, [
    selectedRequest,
    acceptNotes,
    loadRequests,
    onActionComplete,
    onAccepted,
  ]);

  const handleReject = useCallback(() => {
    if (!selectedRequest || !rejectionReason.trim()) return;

    setActionLoading(true);
    postToOpenElisServerJsonResponse(
      `/rest/biorepository/retrieval/requests/${selectedRequest.id}/reject`,
      JSON.stringify({ reason: rejectionReason }),
      (data) => {
        setActionLoading(false);
        if (data && data.error) {
          setError(data.error);
          return;
        }
        setRejectModalOpen(false);
        setSelectedRequest(null);
        setRejectionReason("");
        loadRequests();
        if (onActionComplete) {
          onActionComplete();
        }
      },
    );
  }, [selectedRequest, rejectionReason, loadRequests, onActionComplete]);

  const getPriorityTagType = (priority) => {
    switch (priority) {
      case "CRITICAL":
        return "red";
      case "URGENT":
        return "orange";
      default:
        return "gray";
    }
  };

  const headers = [
    {
      key: "requestNumber",
      header: intl.formatMessage({
        id: "biorepository.retrieval.requestNumber",
        defaultMessage: "Request #",
      }),
    },
    {
      key: "requestedBy",
      header: intl.formatMessage({
        id: "biorepository.retrieval.requestedBy",
        defaultMessage: "Requested By",
      }),
    },
    {
      key: "requesterLab",
      header: intl.formatMessage({
        id: "biorepository.retrieval.requesterLab",
        defaultMessage: "Requester Lab",
      }),
    },
    {
      key: "sampleCount",
      header: intl.formatMessage({
        id: "biorepository.retrieval.sampleCount",
        defaultMessage: "Samples",
      }),
    },
    {
      key: "priority",
      header: intl.formatMessage({
        id: "biorepository.retrieval.priority",
        defaultMessage: "Priority",
      }),
    },
    {
      key: "requestedAt",
      header: intl.formatMessage({
        id: "biorepository.retrieval.requestedAt",
        defaultMessage: "Requested",
      }),
    },
    {
      key: "actions",
      header: intl.formatMessage({
        id: "label.actions",
        defaultMessage: "Actions",
      }),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <Loading withOverlay={false} />
      </div>
    );
  }

  return (
    <div className="incoming-requests-tab" style={{ padding: "1rem 0" }}>
      {error && (
        <InlineNotification
          kind="error"
          title={intl.formatMessage({
            id: "error.title",
            defaultMessage: "Error",
          })}
          subtitle={error}
          lowContrast
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}

      <DataTable
        rows={paginatedRequests.map((r) => ({
          id: r.id.toString(),
          requestNumber: r.requestNumber || `REQ-${r.id}`,
          requestedBy: r.requestorName || r.requestedByName || "Unknown",
          requesterLab: r.requesterLabUnit || "—",
          sampleCount: getRequestLineCount(r),
          priority: r.priorityLevel || "NORMAL",
          requestedAt: r.requestedTimestamp
            ? new Date(r.requestedTimestamp).toLocaleDateString()
            : "N/A",
          _raw: r,
        }))}
        headers={headers}
        size="md"
      >
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <ExpandableSearch
                  labelText={intl.formatMessage({
                    id: "label.search",
                    defaultMessage: "Search",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.retrieval.search.incoming",
                    defaultMessage:
                      "Search by request number, requester, or lab unit...",
                  })}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Renew}
                  iconDescription={intl.formatMessage({
                    id: "label.refresh",
                    defaultMessage: "Refresh",
                  })}
                  hasIconOnly
                  onClick={loadRequests}
                />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader
                      {...getHeaderProps({ header })}
                      key={header.key}
                    >
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length}>
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem",
                          color: "#525252",
                        }}
                      >
                        <FormattedMessage
                          id="biorepository.retrieval.noIncomingRequests"
                          defaultMessage="No incoming sample requests from other departments"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const rawData = paginatedRequests.find(
                      (r) => r.id.toString() === row.id,
                    );
                    return (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>
                            {cell.info.header === "priority" ? (
                              <Tag
                                type={getPriorityTagType(cell.value)}
                                size="sm"
                              >
                                {cell.value}
                              </Tag>
                            ) : cell.info.header === "actions" ? (
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
                                  renderIcon={View}
                                  onClick={() => {
                                    loadRequestDetails(rawData.id, (data) => {
                                      setSelectedRequest(data);
                                      setDetailsModalOpen(true);
                                    });
                                  }}
                                >
                                  <FormattedMessage
                                    id="label.viewDetails"
                                    defaultMessage="View Details"
                                  />
                                </Button>
                                <Button
                                  kind="primary"
                                  size="sm"
                                  renderIcon={Checkmark}
                                  onClick={() => {
                                    loadRequestDetails(rawData.id, (data) => {
                                      setSelectedRequest(data);
                                      setAcceptModalOpen(true);
                                    });
                                  }}
                                >
                                  <FormattedMessage
                                    id="label.accept"
                                    defaultMessage="Accept"
                                  />
                                </Button>
                                <Button
                                  kind="danger--tertiary"
                                  size="sm"
                                  renderIcon={Close}
                                  onClick={() => {
                                    loadRequestDetails(rawData.id, (data) => {
                                      setSelectedRequest(data);
                                      setRejectModalOpen(true);
                                    });
                                  }}
                                >
                                  <FormattedMessage
                                    id="label.reject"
                                    defaultMessage="Reject"
                                  />
                                </Button>
                              </div>
                            ) : (
                              cell.value
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {filteredRequests.length > pageSize && (
        <Pagination
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 50]}
          totalItems={filteredRequests.length}
          onChange={({ page: newPage, pageSize: newPageSize }) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }}
        />
      )}

      <Modal
        open={detailsModalOpen}
        modalHeading={intl.formatMessage({
          id: "biorepository.retrieval.requestDetails",
          defaultMessage: "Request Details",
        })}
        passiveModal
        onRequestClose={() => {
          setDetailsModalOpen(false);
          setSelectedRequest(null);
        }}
        size="lg"
      >
        {detailsLoading ? (
          <Loading withOverlay={false} />
        ) : selectedRequest ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <div>
                <strong>
                  <FormattedMessage
                    id="biorepository.retrieval.requestNumber"
                    defaultMessage="Request #"
                  />
                  :
                </strong>{" "}
                {selectedRequest.requestNumber || `REQ-${selectedRequest.id}`}
              </div>
              <div>
                <strong>
                  <FormattedMessage
                    id="biorepository.retrieval.status"
                    defaultMessage="Status"
                  />
                  :
                </strong>{" "}
                <Tag type="blue">
                  {getRequestDisplayStatus(selectedRequest, intl).label}
                </Tag>
              </div>
              <div>
                <strong>
                  <FormattedMessage
                    id="biorepository.retrieval.requestedBy"
                    defaultMessage="Requested By"
                  />
                  :
                </strong>{" "}
                {selectedRequest.requestorName ||
                  selectedRequest.requestedByName ||
                  "Unknown"}
              </div>
              {selectedRequest.requesterLabUnit && (
                <div>
                  <strong>
                    <FormattedMessage
                      id="biorepository.retrieval.requesterLab"
                      defaultMessage="Requester Lab"
                    />
                    :
                  </strong>{" "}
                  {selectedRequest.requesterLabUnit}
                </div>
              )}
              <div>
                <strong>
                  <FormattedMessage
                    id="biorepository.retrieval.requestedAt"
                    defaultMessage="Requested"
                  />
                  :
                </strong>{" "}
                {selectedRequest.requestedTimestamp
                  ? new Date(
                      selectedRequest.requestedTimestamp,
                    ).toLocaleString()
                  : "N/A"}
              </div>
              <div>
                <strong>
                  <FormattedMessage
                    id="biorepository.retrieval.priority"
                    defaultMessage="Priority"
                  />
                  :
                </strong>{" "}
                <Tag
                  type={getPriorityTagType(selectedRequest.priorityLevel)}
                  size="sm"
                >
                  {selectedRequest.priorityLevel || "NORMAL"}
                </Tag>
              </div>
            </div>

            <div>
              <strong>
                <FormattedMessage
                  id="biorepository.retrieval.purpose"
                  defaultMessage="Purpose"
                />
                :
              </strong>
              <p style={{ marginTop: "0.25rem", color: "#525252" }}>
                {selectedRequest.requestPurpose || "Not specified"}
              </p>
            </div>

            {selectedRequest.items && selectedRequest.items.length > 0 && (
              <div>
                <strong>
                  <FormattedMessage
                    id="biorepository.retrieval.requestedSamples"
                    defaultMessage="Requested Samples"
                  />
                  :
                </strong>
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                  {selectedRequest.items.map((item, idx) => (
                    <li key={idx}>
                      {formatRequestedReferenceSummary(item)}
                      {item.quantityRequested != null &&
                        ` — requested: ${formatQuantityWithUnit(
                          item.quantityRequested,
                          item.unitOfMeasure,
                        )}`}
                      {item.remark && ` — ${item.remark}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={acceptModalOpen}
        modalHeading={intl.formatMessage({
          id: "biorepository.retrieval.acceptRequest",
          defaultMessage: "Accept Request",
        })}
        primaryButtonText={
          actionLoading
            ? intl.formatMessage({
                id: "label.processing",
                defaultMessage: "Processing...",
              })
            : intl.formatMessage({
                id: "label.accept",
                defaultMessage: "Accept",
              })
        }
        secondaryButtonText={intl.formatMessage({
          id: "label.cancel",
          defaultMessage: "Cancel",
        })}
        onRequestClose={() => {
          setAcceptModalOpen(false);
          setSelectedRequest(null);
          setAcceptNotes("");
        }}
        onRequestSubmit={handleAccept}
        primaryButtonDisabled={actionLoading}
      >
        {selectedRequest && (
          <div>
            <p style={{ marginBottom: "1rem" }}>
              <FormattedMessage
                id="biorepository.retrieval.accept.confirmation"
                defaultMessage="Accept request {requestNumber}? A work order will be generated for sample retrieval."
                values={{
                  requestNumber:
                    selectedRequest.requestNumber ||
                    `REQ-${selectedRequest.id}`,
                }}
              />
            </p>
            <TextArea
              id="acceptNotes"
              labelText={intl.formatMessage({
                id: "biorepository.retrieval.acceptNotes",
                defaultMessage: "Notes (Optional)",
              })}
              value={acceptNotes}
              onChange={(e) => setAcceptNotes(e.target.value)}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={rejectModalOpen}
        modalHeading={intl.formatMessage({
          id: "biorepository.retrieval.rejectRequest",
          defaultMessage: "Reject Request",
        })}
        primaryButtonText={
          actionLoading
            ? intl.formatMessage({
                id: "label.processing",
                defaultMessage: "Processing...",
              })
            : intl.formatMessage({
                id: "label.reject",
                defaultMessage: "Reject",
              })
        }
        secondaryButtonText={intl.formatMessage({
          id: "label.cancel",
          defaultMessage: "Cancel",
        })}
        onRequestClose={() => {
          setRejectModalOpen(false);
          setSelectedRequest(null);
          setRejectionReason("");
        }}
        onRequestSubmit={handleReject}
        primaryButtonDisabled={actionLoading || !rejectionReason.trim()}
        danger
      >
        {selectedRequest && (
          <div>
            <p style={{ marginBottom: "1rem" }}>
              <FormattedMessage
                id="biorepository.retrieval.reject.confirmation"
                defaultMessage="Are you sure you want to reject request {requestNumber}?"
                values={{
                  requestNumber:
                    selectedRequest.requestNumber ||
                    `REQ-${selectedRequest.id}`,
                }}
              />
            </p>
            <TextArea
              id="rejectionReason"
              labelText={intl.formatMessage({
                id: "biorepository.retrieval.rejectionReason",
                defaultMessage: "Rejection Reason (Required)",
              })}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

IncomingRequestsTab.propTypes = {
  onActionComplete: PropTypes.func,
  onAccepted: PropTypes.func,
};

export default IncomingRequestsTab;
