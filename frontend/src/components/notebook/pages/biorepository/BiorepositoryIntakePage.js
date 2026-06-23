import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Grid,
  Column,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  InlineNotification,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableSelectAll,
  TableSelectRow,
  TableToolbar,
  TableToolbarContent,
  TableBatchActions,
  TableBatchAction,
  Tag,
  Button,
  Modal,
} from "@carbon/react";
import {
  Checkmark,
  Renew,
  Barcode,
  ArrowRight,
  View,
} from "@carbon/icons-react";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";
import { getFromOpenElisServer } from "../../../utils/Utils";
import ShipmentReceptionForm from "./ShipmentReceptionForm";
import ShipmentListTable from "./ShipmentListTable";
import SampleIntakeForm from "./SampleIntakeForm";
import SampleDuplicationSection from "./SampleDuplicationSection";
import DocumentationVerificationModal from "./DocumentationVerificationModal";
import ManifestUploadModal from "./ManifestUploadModal";
import BioSampleDetailModal from "./BioSampleDetailModal";
import SampleTransferTab from "./SampleTransferTab";
import RetentionPolicySection from "./RetentionPolicySection";
import {
  buildReceptionTableColumns,
  mapBioSampleToReceptionRow,
  sortBioSamplesByManifestSno,
} from "./biorepositoryExcelColumns";
import {
  findStorageAssignmentPage,
  getJson,
  advanceSamplesToStorageBatched,
} from "./biorepositoryStorageHelpers";

const INVENTORY_SAMPLE_FETCH_LIMIT = 5000;
const SHIPMENT_SAMPLE_FETCH_LIMIT = 5000;

/**
 * BiorepositoryIntakePage - Sample Intake & Registration workflow page
 * Stage 1 of the Biorepository workflow with 5 sub-stages:
 *   1a: Shipment Reception
 *   1b: Documentation Verification (6-point checklist, linked to shipment)
 *   1c: Sample Registration (single entry or bulk manifest import)
 *   1d: Sample Transfer
 *   1e: Received Samples (includes barcode generation via batch action)
 *
 * Per SRS Section 4.2: Documentation must be verified BEFORE sample registration
 * to prevent entry of samples that cannot be properly tracked.
 *
 * @param {Object} props
 * @param {number} props.entryId - The notebook entry ID
 * @param {Object} props.pageData - Page configuration from notebook
 * @param {Object} props.progress - Progress tracking data
 * @param {Function} props.onProgressUpdate - Callback when progress changes
 * @param {number} props.notebookId - The notebook ID
 */
function BiorepositoryIntakePage({
  entryId,
  pageData,
  progress,
  onProgressUpdate,
  notebookId,
}) {
  const intl = useIntl();
  const [activeSubStage, setActiveSubStage] = useState(0);

  // Workflow state
  const [currentShipment, setCurrentShipment] = useState(null);
  const [registeredSamples, setRegisteredSamples] = useState([]);
  const [allBioSamples, setAllBioSamples] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailSample, setSelectedDetailSample] = useState(null);
  const [shipmentListRefreshKey, setShipmentListRefreshKey] = useState(0);

  const shipmentStorageKey = entryId ? `biorepo-shipment-${entryId}` : null;

  // Barcode generation state
  const [barcodeSource, setBarcodeSource] = useState("about:blank");
  const [renderBarcode, setRenderBarcode] = useState(false);
  const [barcodeLabNo, setBarcodeLabNo] = useState("");

  // Advance to storage state
  const [advancingToStorage, setAdvancingToStorage] = useState(false);
  const [advanceNotification, setAdvanceNotification] = useState(null);

  // Track completion of each sub-stage
  const [subStageComplete, setSubStageComplete] = useState({
    shipment: false,
    registration: false,
    documentation: false,
  });

  const subStages = [
    {
      id: "1a",
      key: "shipment",
      label: intl.formatMessage({
        id: "biorepository.intake.substage.shipment",
        defaultMessage: "Shipment Reception",
      }),
    },
    {
      id: "1b",
      key: "documentation",
      label: intl.formatMessage({
        id: "biorepository.intake.substage.documentation",
        defaultMessage: "Documentation Verification",
      }),
    },
    {
      id: "1c",
      key: "registration",
      label: intl.formatMessage({
        id: "biorepository.intake.substage.registration",
        defaultMessage: "Sample Registration",
      }),
    },
    {
      id: "1d",
      key: "transfer",
      label: intl.formatMessage({
        id: "biorepository.intake.substage.transfer",
        defaultMessage: "Sample Transfer",
      }),
    },
    {
      id: "1e",
      key: "inventory",
      label: intl.formatMessage({
        id: "biorepository.intake.substage.inventory",
        defaultMessage: "Received Samples",
      }),
    },
  ];

  const applyShipmentSelection = useCallback(
    (shipment, { advanceTab = true } = {}) => {
      setCurrentShipment(shipment);
      setSubStageComplete((prev) => ({
        ...prev,
        shipment: true,
        documentation:
          shipment.documentationStatus === "VERIFIED" ||
          shipment.documentationStatus === "QUARANTINE",
      }));
      if (shipmentStorageKey) {
        sessionStorage.setItem(shipmentStorageKey, String(shipment.id));
      }
      if (!advanceTab) {
        return;
      }
      if (
        shipment.documentationStatus === "VERIFIED" ||
        shipment.documentationStatus === "QUARANTINE"
      ) {
        setActiveSubStage(2);
      } else {
        setActiveSubStage(1);
      }
    },
    [shipmentStorageKey],
  );

  const handleShipmentCreated = useCallback(
    (shipment) => {
      setShipmentListRefreshKey((k) => k + 1);
      applyShipmentSelection(shipment);
    },
    [applyShipmentSelection],
  );

  const handleShipmentSelected = useCallback(
    (shipment) => {
      applyShipmentSelection(shipment);
    },
    [applyShipmentSelection],
  );

  const handleClearShipment = useCallback(() => {
    setCurrentShipment(null);
    setSubStageComplete((prev) => ({
      ...prev,
      shipment: false,
      documentation: false,
    }));
    if (shipmentStorageKey) {
      sessionStorage.removeItem(shipmentStorageKey);
    }
    setActiveSubStage(0);
  }, [shipmentStorageKey]);

  const handleVerifyShipment = useCallback(
    (shipment) => {
      applyShipmentSelection(shipment, { advanceTab: false });
      setVerificationModalOpen(true);
    },
    [applyShipmentSelection],
  );

  const handleSamplesRegistered = useCallback((samples) => {
    setRegisteredSamples((prev) => [...prev, ...samples]);
    setSubStageComplete((prev) => ({ ...prev, registration: true }));
  }, []);

  const handleBulkImportComplete = useCallback(() => {
    setSubStageComplete((prev) => ({ ...prev, registration: true }));
    setManifestModalOpen(false);
  }, []);

  const handleOpenVerification = useCallback(() => {
    // Open verification modal for the current shipment
    setVerificationModalOpen(true);
  }, []);

  const handleVerificationComplete = useCallback((verification) => {
    // Update shipment with new documentation status
    setCurrentShipment((prev) => ({
      ...prev,
      documentationStatus: verification.status,
    }));

    // Mark documentation as complete (verified or quarantined)
    setSubStageComplete((prev) => ({ ...prev, documentation: true }));
    setVerificationModalOpen(false);

    // Auto-advance to sample registration
    setActiveSubStage(2);
  }, []);

  const receptionTableHeaders = useMemo(
    () => buildReceptionTableColumns(intl),
    [intl],
  );

  const openSampleDetails = useCallback((sample) => {
    setSelectedDetailSample(sample);
    setDetailModalOpen(true);
  }, []);

  // Load all biorepository samples (for inventory tab) - runs on mount
  // Filter by workflowStatus=REGISTERED to show only samples at Intake stage
  const loadAllBioSamples = useCallback(() => {
    setLoadingSamples(true);
    getFromOpenElisServer(
      `/rest/biorepository/sample?limit=${INVENTORY_SAMPLE_FETCH_LIMIT}&workflowStatus=REGISTERED`,
      (data) => {
        setLoadingSamples(false);
        if (data && Array.isArray(data)) {
          setAllBioSamples(sortBioSamplesByManifestSno(data));
        }
      },
    );
  }, []);

  // Load all samples on mount
  useEffect(() => {
    loadAllBioSamples();
  }, [loadAllBioSamples]);

  // Restore active shipment from session storage
  useEffect(() => {
    if (!shipmentStorageKey || currentShipment) {
      return;
    }
    const savedId = sessionStorage.getItem(shipmentStorageKey);
    if (!savedId) {
      return;
    }
    getFromOpenElisServer(`/rest/biorepository/shipment/${savedId}`, (data) => {
      if (data && !data.error) {
        applyShipmentSelection(data, { advanceTab: false });
      }
    });
  }, [shipmentStorageKey, currentShipment, applyShipmentSelection]);

  // Load samples for current shipment when shipment changes
  useEffect(() => {
    if (currentShipment?.id) {
      getFromOpenElisServer(
        `/rest/biorepository/sample?shipmentId=${currentShipment.id}&limit=${SHIPMENT_SAMPLE_FETCH_LIMIT}`,
        (data) => {
          if (data && Array.isArray(data)) {
            setRegisteredSamples(data);
            if (data.length > 0) {
              setSubStageComplete((prev) => ({ ...prev, registration: true }));
            }
          }
        },
      );
    }
  }, [currentShipment]);

  // Refresh inventory after bulk import
  const handleBulkImportCompleteWithRefresh = useCallback(() => {
    handleBulkImportComplete();
    // Refresh all samples list
    loadAllBioSamples();

    // Refresh shipment-specific registration count if this intake page is linked to a shipment
    if (currentShipment?.id) {
      getFromOpenElisServer(
        `/rest/biorepository/sample?shipmentId=${currentShipment.id}&limit=${SHIPMENT_SAMPLE_FETCH_LIMIT}`,
        (data) => {
          if (data && Array.isArray(data)) {
            setRegisteredSamples(data);
            if (data.length > 0) {
              setSubStageComplete((prev) => ({
                ...prev,
                registration: true,
              }));
            }
          }
        },
      );
    }
  }, [currentShipment?.id, handleBulkImportComplete, loadAllBioSamples]);

  // Advance selected samples to Storage Assignment page
  const handleAdvanceToStorage = useCallback(
    async (selectedRows) => {
      if (!selectedRows || selectedRows.length === 0) {
        setAdvanceNotification({
          kind: "warning",
          title: intl.formatMessage({
            id: "biorepository.inventory.advance.noSelection",
            defaultMessage: "No Samples Selected",
          }),
          subtitle: intl.formatMessage({
            id: "biorepository.inventory.advance.noSelection.message",
            defaultMessage: "Please select samples to advance to storage.",
          }),
        });
        return;
      }

      const sampleItemIds = selectedRows
        .map((row) => {
          const bioSample = allBioSamples.find(
            (s) => s.id.toString() === row.id,
          );
          return bioSample?.sampleItemId;
        })
        .filter((id) => id != null);

      if (sampleItemIds.length === 0) {
        setAdvanceNotification({
          kind: "error",
          title: intl.formatMessage({
            id: "biorepository.inventory.advance.noSampleItems",
            defaultMessage: "Cannot Advance",
          }),
          subtitle: intl.formatMessage({
            id: "biorepository.inventory.advance.noSampleItems.message",
            defaultMessage:
              "Selected samples do not have valid sample item links.",
          }),
        });
        return;
      }

      if (!notebookId) {
        setAdvanceNotification({
          kind: "error",
          title: intl.formatMessage({
            id: "biorepository.inventory.advance.noNotebook",
            defaultMessage: "Notebook Not Found",
          }),
          subtitle: intl.formatMessage({
            id: "biorepository.inventory.advance.noNotebookTemplate.message",
            defaultMessage:
              "Cannot advance samples — notebook template ID is missing.",
          }),
        });
        return;
      }

      setAdvancingToStorage(true);
      setAdvanceNotification(null);

      try {
        const nbResponse = await getJson(`/rest/notebook/view/${notebookId}`);
        const storageAssignmentPage = findStorageAssignmentPage(
          nbResponse?.pages,
        );

        if (!storageAssignmentPage?.id) {
          setAdvanceNotification({
            kind: "error",
            title: intl.formatMessage({
              id: "biorepository.inventory.advance.noStoragePage",
              defaultMessage: "Storage Page Not Found",
            }),
            subtitle: intl.formatMessage({
              id: "biorepository.inventory.advance.noStoragePage.message",
              defaultMessage: "Storage Assignment page not found in notebook.",
            }),
          });
          return;
        }

        const advanceResult = await advanceSamplesToStorageBatched(
          storageAssignmentPage.id,
          sampleItemIds,
          {
            onProgress: ({ processed, total }) => {
              setAdvanceNotification({
                kind: "info",
                title: intl.formatMessage({
                  id: "biorepository.inventory.advance.inProgress",
                  defaultMessage: "Advancing Samples",
                }),
                subtitle: intl.formatMessage(
                  {
                    id: "biorepository.inventory.advance.inProgress.message",
                    defaultMessage: "Processing {processed} of {total}...",
                  },
                  { processed, total },
                ),
              });
            },
          },
        );

        if (!advanceResult.success) {
          setAdvanceNotification({
            kind: advanceResult.updatedCount > 0 ? "warning" : "error",
            title: intl.formatMessage({
              id: "biorepository.inventory.advance.error",
              defaultMessage: "Failed to Advance",
            }),
            subtitle:
              advanceResult.errors.join("; ") ||
              intl.formatMessage({
                id: "biorepository.inventory.advance.error.message",
                defaultMessage:
                  "Could not add samples to Storage Assignment page.",
              }),
          });
          if (advanceResult.updatedCount > 0) {
            loadAllBioSamples();
          }
          return;
        }

        const {
          addedCount,
          updatedCount,
          requestedCount,
          retentionUpdated: retentionUpdated,
        } = advanceResult;
        const alreadyOnPage = Math.max(0, requestedCount - addedCount);

        let subtitle = intl.formatMessage(
          {
            id: "biorepository.inventory.advance.success.message",
            defaultMessage:
              "{updatedCount} of {requestedCount} sample(s) advanced to Storage Assignment ({addedCount} newly added). Open Workflow page 2 to assign locations.",
          },
          {
            updatedCount,
            requestedCount,
            addedCount,
          },
        );

        if (alreadyOnPage > 0) {
          subtitle += ` ${intl.formatMessage(
            {
              id: "biorepository.inventory.advance.alreadyOnPage",
              defaultMessage:
                "{count} were already on the Storage Assignment page.",
            },
            { count: alreadyOnPage },
          )}`;
        }

        if (retentionUpdated > 0) {
          subtitle += ` ${intl.formatMessage(
            {
              id: "biorepository.inventory.advance.retentionCalculated",
              defaultMessage:
                "Retention expiry calculated for {retentionCount} sample(s).",
            },
            { retentionCount: retentionUpdated },
          )}`;
        }

        setAdvanceNotification({
          kind: "success",
          title: intl.formatMessage({
            id: "biorepository.inventory.advance.success",
            defaultMessage: "Samples Advanced",
          }),
          subtitle,
        });

        loadAllBioSamples();
        if (onProgressUpdate) {
          onProgressUpdate();
        }
      } catch (advanceError) {
        setAdvanceNotification({
          kind: "error",
          title: intl.formatMessage({
            id: "biorepository.inventory.advance.notebookError",
            defaultMessage: "Notebook Error",
          }),
          subtitle:
            advanceError?.message ||
            intl.formatMessage({
              id: "biorepository.inventory.advance.notebookError.message",
              defaultMessage: "Could not load notebook pages.",
            }),
        });
      } finally {
        setAdvancingToStorage(false);
      }
    },
    [allBioSamples, notebookId, intl, loadAllBioSamples, onProgressUpdate],
  );

  const getDocStatusLabel = (status) => {
    if (status === "VERIFIED") {
      return intl.formatMessage({
        id: "biorepository.shipment.docStatus.verified",
        defaultMessage: "Verified",
      });
    }
    if (status === "QUARANTINE") {
      return intl.formatMessage({
        id: "biorepository.shipment.docStatus.quarantine",
        defaultMessage: "Quarantine",
      });
    }
    return intl.formatMessage({
      id: "biorepository.shipment.docStatus.pending",
      defaultMessage: "Pending",
    });
  };

  return (
    <div className="biorepository-intake-page">
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4}>
          {currentShipment && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                backgroundColor: "#e8f4fd",
                border: "1px solid #78a9ff",
                borderRadius: "4px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "0.875rem" }}>
                <strong>
                  <FormattedMessage
                    id="biorepository.intake.activeShipment.label"
                    defaultMessage="Active shipment:"
                  />
                </strong>{" "}
                {currentShipment.deliveryReference || currentShipment.id}
                {currentShipment.senderName && (
                  <span style={{ color: "#525252", marginLeft: "1rem" }}>
                    <FormattedMessage
                      id="biorepository.intake.activeShipment.sender"
                      defaultMessage="Sender:"
                    />{" "}
                    {currentShipment.senderName}
                  </span>
                )}
                <span style={{ color: "#525252", marginLeft: "1rem" }}>
                  <FormattedMessage
                    id="biorepository.intake.activeShipment.docs"
                    defaultMessage="Docs:"
                  />{" "}
                  {getDocStatusLabel(
                    currentShipment.documentationStatus || "PENDING",
                  )}
                </span>
              </div>
              <Button kind="ghost" size="sm" onClick={handleClearShipment}>
                <FormattedMessage
                  id="biorepository.intake.activeShipment.change"
                  defaultMessage="Change shipment"
                />
              </Button>
            </div>
          )}
          <Tabs
            selectedIndex={activeSubStage}
            onChange={({ selectedIndex }) => setActiveSubStage(selectedIndex)}
          >
            <TabList aria-label="Intake sub-stages">
              {subStages.map((stage) => (
                <Tab key={stage.id}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {subStageComplete[stage.key] && (
                      <Checkmark size={16} style={{ color: "green" }} />
                    )}
                    {stage.label}
                  </span>
                </Tab>
              ))}
            </TabList>
            <TabPanels>
              {/* Sub-stage 1a: Shipment Reception */}
              <TabPanel>
                <div className="substage-content" style={{ padding: "1rem 0" }}>
                  <h4 style={{ marginBottom: "1rem" }}>
                    <FormattedMessage
                      id="biorepository.intake.shipment.title"
                      defaultMessage="Shipment Reception"
                    />
                  </h4>

                  <ShipmentReceptionForm
                    onShipmentCreated={handleShipmentCreated}
                    onShipmentSelected={handleShipmentSelected}
                    onCancel={() => {}}
                    selectedShipmentId={currentShipment?.id}
                    refreshKey={shipmentListRefreshKey}
                  />
                </div>
              </TabPanel>

              {/* Sub-stage 1b: Documentation Verification (linked to shipment) */}
              <TabPanel>
                <div className="substage-content" style={{ padding: "1rem 0" }}>
                  <h4 style={{ marginBottom: "1rem" }}>
                    <FormattedMessage
                      id="biorepository.intake.documentation.title"
                      defaultMessage="Documentation Verification"
                    />
                  </h4>

                  {!currentShipment ? (
                    <div>
                      <p style={{ marginBottom: "1rem" }}>
                        <FormattedMessage
                          id="biorepository.intake.documentation.selectShipment"
                          defaultMessage="Select a shipment below to begin documentation verification."
                        />
                      </p>
                      <ShipmentListTable
                        onSelect={handleShipmentSelected}
                        onVerify={handleVerifyShipment}
                        showDocStatus
                        showVerifyAction
                        selectButtonLabel={intl.formatMessage({
                          id: "biorepository.shipment.button.select",
                          defaultMessage: "Select",
                        })}
                        refreshKey={shipmentListRefreshKey}
                      />
                    </div>
                  ) : subStageComplete.documentation ? (
                    <InlineNotification
                      kind={
                        currentShipment.documentationStatus === "VERIFIED"
                          ? "success"
                          : "warning"
                      }
                      title={intl.formatMessage({
                        id:
                          currentShipment.documentationStatus === "VERIFIED"
                            ? "biorepository.intake.documentation.verified"
                            : "biorepository.intake.documentation.quarantine",
                        defaultMessage:
                          currentShipment.documentationStatus === "VERIFIED"
                            ? "Documentation Verified"
                            : "Documentation Quarantined",
                      })}
                      subtitle={intl.formatMessage({
                        id: "biorepository.intake.documentation.proceedToRegistration",
                        defaultMessage: "Proceed to sample registration.",
                      })}
                      lowContrast
                      hideCloseButton
                    />
                  ) : (
                    <div>
                      <p style={{ marginBottom: "1rem" }}>
                        <FormattedMessage
                          id="biorepository.intake.documentation.shipmentInstructions"
                          defaultMessage="Verify the shipment documentation using the 6-point checklist before registering samples."
                        />
                      </p>
                      <div
                        onClick={handleOpenVerification}
                        style={{
                          padding: "1.5rem",
                          border: "1px solid #e0e0e0",
                          borderRadius: "4px",
                          cursor: "pointer",
                          backgroundColor: "#f4f4f4",
                          maxWidth: "400px",
                        }}
                      >
                        <strong>
                          <FormattedMessage
                            id="biorepository.intake.documentation.shipmentRef"
                            defaultMessage="Shipment: {ref}"
                            values={{
                              ref:
                                currentShipment.deliveryReference ||
                                currentShipment.id,
                            }}
                          />
                        </strong>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "#525252",
                            marginTop: "0.5rem",
                          }}
                        >
                          <FormattedMessage
                            id="biorepository.intake.documentation.clickToVerifyShipment"
                            defaultMessage="Click to complete documentation verification checklist"
                          />
                        </div>
                        <Tag type="gray" style={{ marginTop: "0.5rem" }}>
                          <FormattedMessage
                            id="biorepository.intake.documentation.pending"
                            defaultMessage="Pending Verification"
                          />
                        </Tag>
                      </div>
                    </div>
                  )}
                </div>
              </TabPanel>

              {/* Sub-stage 1c: Sample Registration */}
              <TabPanel>
                <div className="substage-content" style={{ padding: "1rem 0" }}>
                  <h4 style={{ marginBottom: "1rem" }}>
                    <FormattedMessage
                      id="biorepository.intake.registration.title"
                      defaultMessage="Sample Registration"
                    />
                  </h4>

                  {!subStageComplete.documentation ? (
                    <InlineNotification
                      kind="warning"
                      title={intl.formatMessage({
                        id: "biorepository.intake.registration.docsRequired",
                        defaultMessage: "Documentation Verification Required",
                      })}
                      subtitle={intl.formatMessage({
                        id: "biorepository.intake.registration.docsRequired.message",
                        defaultMessage:
                          "Complete documentation verification before registering samples.",
                      })}
                      lowContrast
                      hideCloseButton
                    />
                  ) : (
                    <>
                      {registeredSamples.length > 0 && (
                        <InlineNotification
                          kind="info"
                          title={intl.formatMessage(
                            {
                              id: "biorepository.intake.registration.count",
                              defaultMessage: "{count} sample(s) registered",
                            },
                            { count: registeredSamples.length },
                          )}
                          lowContrast
                          hideCloseButton
                          style={{ marginBottom: "1rem" }}
                        />
                      )}

                      <SampleIntakeForm
                        shipment={currentShipment}
                        notebookId={notebookId}
                        onSamplesRegistered={handleSamplesRegistered}
                        onBulkImport={() => setManifestModalOpen(true)}
                        onCancel={() => {}}
                      />
                      <SampleDuplicationSection
                        onSamplesCreated={handleSamplesRegistered}
                      />
                    </>
                  )}
                </div>
              </TabPanel>

              {/* Sub-stage 1d: Sample Transfer Queue */}
              <TabPanel>
                <div className="substage-content" style={{ padding: "1rem 0" }}>
                  <SampleTransferTab
                    notebookId={notebookId}
                    entryId={entryId}
                    onTransferAccepted={loadAllBioSamples}
                  />
                </div>
              </TabPanel>

              {/* Sub-stage 1e: Received Samples */}
              <TabPanel>
                <div className="substage-content" style={{ padding: "1rem 0" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <h4>
                      <FormattedMessage
                        id="biorepository.intake.inventory.title"
                        defaultMessage="Received Samples"
                      />
                    </h4>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Renew}
                      onClick={loadAllBioSamples}
                      disabled={loadingSamples}
                    >
                      <FormattedMessage
                        id="biorepository.intake.inventory.refresh"
                        defaultMessage="Refresh"
                      />
                    </Button>
                  </div>

                  <p style={{ marginBottom: "1rem", color: "#525252" }}>
                    <FormattedMessage
                      id="biorepository.intake.inventory.description"
                      defaultMessage="All samples registered in the biorepository from sample registration and transfers."
                    />
                  </p>

                  {/* Retention Policy Configuration Section */}
                  <RetentionPolicySection />

                  {loadingSamples ? (
                    <p>
                      <FormattedMessage
                        id="biorepository.intake.inventory.loading"
                        defaultMessage="Loading samples..."
                      />
                    </p>
                  ) : allBioSamples.length === 0 ? (
                    <InlineNotification
                      kind="info"
                      title={intl.formatMessage({
                        id: "biorepository.intake.inventory.empty",
                        defaultMessage: "No Samples",
                      })}
                      subtitle={intl.formatMessage({
                        id: "biorepository.intake.inventory.empty.message",
                        defaultMessage:
                          "No samples have been registered in the biorepository yet.",
                      })}
                      lowContrast
                      hideCloseButton
                    />
                  ) : (
                    <>
                      <InlineNotification
                        kind="info"
                        title={intl.formatMessage(
                          {
                            id: "biorepository.intake.inventory.count",
                            defaultMessage:
                              "{count} sample(s) in biorepository",
                          },
                          { count: allBioSamples.length },
                        )}
                        lowContrast
                        hideCloseButton
                        style={{ marginBottom: "1rem" }}
                      />
                      {advanceNotification && (
                        <InlineNotification
                          kind={advanceNotification.kind}
                          title={advanceNotification.title}
                          subtitle={advanceNotification.subtitle}
                          lowContrast
                          onCloseButtonClick={() =>
                            setAdvanceNotification(null)
                          }
                          style={{ marginBottom: "1rem" }}
                        />
                      )}
                      <DataTable
                        rows={allBioSamples.map((sample) =>
                          mapBioSampleToReceptionRow(sample),
                        )}
                        headers={receptionTableHeaders}
                      >
                        {({
                          rows,
                          headers,
                          getTableProps,
                          getHeaderProps,
                          getRowProps,
                          getSelectionProps,
                          getBatchActionProps,
                          selectedRows,
                        }) => {
                          const batchActionProps = getBatchActionProps();
                          return (
                            <TableContainer>
                              <TableToolbar>
                                <TableBatchActions {...batchActionProps}>
                                  <TableBatchAction
                                    tabIndex={
                                      batchActionProps.shouldShowBatchActions
                                        ? 0
                                        : -1
                                    }
                                    renderIcon={Barcode}
                                    onClick={() => {
                                      if (selectedRows.length === 0) return;
                                      const selectedSample = allBioSamples.find(
                                        (s) =>
                                          s.id.toString() ===
                                          selectedRows[0].id,
                                      );
                                      if (!selectedSample) return;
                                      // Use accessionNumber for LabelMakerServlet lookup
                                      const accessionNum =
                                        selectedSample.accessionNumber;
                                      const displayLabel =
                                        selectedSample.barcode ||
                                        selectedSample.id.toString();
                                      setBarcodeLabNo(displayLabel);
                                      setBarcodeSource(
                                        `/LabelMakerServlet?labNo=${accessionNum}&type=generic&sampleType=${encodeURIComponent(selectedSample.sampleType?.description || "")}&from=Biorepository`,
                                      );
                                      setRenderBarcode(true);
                                    }}
                                  >
                                    <FormattedMessage
                                      id="biorepository.inventory.generateBarcode"
                                      defaultMessage="Generate Barcode"
                                    />
                                  </TableBatchAction>
                                  <TableBatchAction
                                    tabIndex={
                                      batchActionProps.shouldShowBatchActions
                                        ? 0
                                        : -1
                                    }
                                    renderIcon={ArrowRight}
                                    onClick={() =>
                                      handleAdvanceToStorage(selectedRows)
                                    }
                                    disabled={advancingToStorage}
                                  >
                                    <FormattedMessage
                                      id="biorepository.inventory.advanceToStorage"
                                      defaultMessage="Advance to Storage"
                                    />
                                  </TableBatchAction>
                                </TableBatchActions>
                                <TableToolbarContent>
                                  <p
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#525252",
                                    }}
                                  >
                                    <FormattedMessage
                                      id="biorepository.inventory.selectHint"
                                      defaultMessage="Select samples for batch actions"
                                    />
                                  </p>
                                </TableToolbarContent>
                              </TableToolbar>
                              <Table {...getTableProps()}>
                                <TableHead>
                                  <TableRow>
                                    <TableSelectAll {...getSelectionProps()} />
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
                                  {rows.map((row) => {
                                    const sample = allBioSamples.find(
                                      (s) => s.id.toString() === row.id,
                                    );
                                    return (
                                      <TableRow
                                        {...getRowProps({ row })}
                                        key={row.id}
                                      >
                                        <TableSelectRow
                                          {...getSelectionProps({ row })}
                                        />
                                        {row.cells.map((cell) => {
                                          if (
                                            cell.info.header ===
                                            "workflowStatus"
                                          ) {
                                            let statusColor = "gray";
                                            const statusValue = cell.value;
                                            if (statusValue === "REGISTERED") {
                                              statusColor = "blue";
                                            } else if (
                                              statusValue === "STORED"
                                            ) {
                                              statusColor = "green";
                                            } else if (
                                              statusValue === "QUARANTINE"
                                            ) {
                                              statusColor = "red";
                                            }
                                            return (
                                              <TableCell key={cell.id}>
                                                <Tag type={statusColor}>
                                                  {cell.value}
                                                </Tag>
                                              </TableCell>
                                            );
                                          }
                                          if (cell.info.header === "actions") {
                                            return (
                                              <TableCell key={cell.id}>
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    gap: "0.25rem",
                                                  }}
                                                >
                                                  <Button
                                                    kind="ghost"
                                                    size="sm"
                                                    hasIconOnly
                                                    renderIcon={View}
                                                    iconDescription={intl.formatMessage(
                                                      {
                                                        id: "biorepository.sample.viewDetails",
                                                        defaultMessage:
                                                          "View details",
                                                      },
                                                    )}
                                                    onClick={() =>
                                                      openSampleDetails(sample)
                                                    }
                                                  />
                                                  <Button
                                                    kind="ghost"
                                                    size="sm"
                                                    hasIconOnly
                                                    renderIcon={Barcode}
                                                    iconDescription={intl.formatMessage(
                                                      {
                                                        id: "biorepository.inventory.generateBarcode",
                                                        defaultMessage:
                                                          "Generate Barcode",
                                                      },
                                                    )}
                                                    onClick={() => {
                                                      const accessionNum =
                                                        sample?.accessionNumber;
                                                      const displayLabel =
                                                        sample?.barcode ||
                                                        sample?.id?.toString();
                                                      if (accessionNum) {
                                                        setBarcodeLabNo(
                                                          displayLabel,
                                                        );
                                                        setBarcodeSource(
                                                          `/LabelMakerServlet?labNo=${accessionNum}&type=generic&sampleType=${encodeURIComponent(sample?.sampleType?.description || "")}&from=Biorepository`,
                                                        );
                                                        setRenderBarcode(true);
                                                      }
                                                    }}
                                                  />
                                                </div>
                                              </TableCell>
                                            );
                                          }
                                          return (
                                            <TableCell key={cell.id}>
                                              {cell.value}
                                            </TableCell>
                                          );
                                        })}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          );
                        }}
                      </DataTable>
                    </>
                  )}
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>

      {/* Documentation Verification Modal */}
      <DocumentationVerificationModal
        open={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        shipment={currentShipment}
        onVerificationComplete={handleVerificationComplete}
      />

      {/* Manifest Upload Modal */}
      <ManifestUploadModal
        open={manifestModalOpen}
        onClose={() => setManifestModalOpen(false)}
        shipmentId={currentShipment?.id}
        notebookId={notebookId}
        onImportComplete={handleBulkImportCompleteWithRefresh}
      />

      <BioSampleDetailModal
        open={detailModalOpen}
        sample={selectedDetailSample}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedDetailSample(null);
        }}
      />

      {/* Barcode Display Modal */}
      <Modal
        open={renderBarcode}
        onRequestClose={() => {
          setRenderBarcode(false);
          setBarcodeSource("about:blank");
          setBarcodeLabNo("");
        }}
        modalHeading={
          <FormattedMessage
            id="biorepository.barcode.modal.heading"
            defaultMessage="Barcode - {labNo}"
            values={{ labNo: barcodeLabNo }}
          />
        }
        passiveModal
        size="lg"
      >
        <div style={{ minHeight: "500px" }}>
          <iframe
            src={barcodeSource}
            width="100%"
            height="500px"
            title={intl.formatMessage({
              id: "biorepository.barcode.modal.iframeTitle",
              defaultMessage: "Barcode Preview",
            })}
            style={{ border: "1px solid #e0e0e0" }}
          />
        </div>
      </Modal>
    </div>
  );
}

BiorepositoryIntakePage.propTypes = {
  entryId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  pageData: PropTypes.object,
  progress: PropTypes.object,
  onProgressUpdate: PropTypes.func,
  notebookId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default BiorepositoryIntakePage;
