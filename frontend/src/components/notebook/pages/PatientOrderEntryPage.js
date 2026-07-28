import React, {
  useState,
  useRef,
  useCallback,
  useContext,
  useEffect,
} from "react";
import {
  Grid,
  Column,
  Button,
  Tile,
  Loading,
  TextInput,
  RadioButton,
  RadioButtonGroup,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Checkbox,
  Tag,
} from "@carbon/react";
import { UserFollow, TrashCan, ShoppingCart } from "@carbon/react/icons";
import { FormattedMessage, useIntl } from "react-intl";
import {
  postToOpenElisServerJsonResponse,
  getFromOpenElisServer,
  deleteFromOpenElisServer,
} from "../../utils/Utils";
import { NotificationContext } from "../../layout/Layout";
import { NotificationKinds } from "../../common/CustomNotification";
import CustomDatePicker from "../../common/CustomDatePicker";
import BulkOrderModal from "../workflow/BulkOrderModal";
import {
  getPatientId,
  REGISTER_MODE,
  isRegistrationFormValid,
  buildPatientManagementPayload,
  buildRegisteredPatientSnapshot,
  formatPatientBirthDateDisplay,
  normalizeOrderableTestList,
  formatRegistrationError,
} from "./patientOrderHelpers";
import "../workflow/NotebookWorkflow.css";

/**
 * PatientOrderEntryPage - Page 1 of the MedLab workflow.
 * Patient registration AND lab order entry with test requirements display (FR-006, FR-007).
 *
 * @param {Object} props
 * @param {number} props.entryId - The notebook entry ID
 * @param {Object} props.pageData - The notebook page data
 * @param {Object} props.progress - Page progress
 * @param {function} props.onProgressUpdate - Callback when progress changes
 */
function PatientOrderEntryPage({
  entryId,
  pageData,
  progress,
  onProgressUpdate,
  sampleCollectionPageData,
  onNavigateToPage,
  allowedTestIds,
}) {
  const intl = useIntl();
  const componentMounted = useRef(true);
  const { setNotificationVisible, addNotification } =
    useContext(NotificationContext);

  // Patient registration form state
  const [patientForm, setPatientForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    nationalId: "",
    fatherNameOrProtocolId: "",
  });

  // Full session list (includes patients who already have orders)
  const [allRegisteredPatients, setAllRegisteredPatients] = useState([]);
  // Patients awaiting an order (Tab 2 picker)
  const [pendingRegisteredPatients, setPendingRegisteredPatients] = useState(
    [],
  );

  // Bulk order selection state
  const [selectedPatientsForBulk, setSelectedPatientsForBulk] = useState([]);
  const [bulkOrderModalOpen, setBulkOrderModalOpen] = useState(false);

  // Loading state
  const [submitting, setSubmitting] = useState(false);

  // Tests available for bulk order (filtered by notebook template allowedTestIds)
  const [availableTests, setAvailableTests] = useState([]);
  const [createdOrders, setCreatedOrders] = useState([]);

  // Load existing orders for this notebook page (persisted across refresh)
  // Note: getOrdersForPage filters by pageId, so this only returns orders for THIS page (Stage 1),
  // NOT manifest-imported samples from other pages (Stage 2)
  const loadOrdersForPage = useCallback(() => {
    if (!pageData?.id) return;
    getFromOpenElisServer(
      `/rest/medlab/page/${pageData.id}/orders`,
      (response) => {
        if (componentMounted.current && response) {
          const orders = Array.isArray(response) ? response : [];
          const formattedOrders = orders.map((order) => ({
            id: order.id,
            labNo: order.labNo,
            patientId: order.patientId,
            patientName: order.patientName || "Unknown",
            testCount: order.testCount || 0,
            createdAt: order.receivedDate
              ? new Date(order.receivedDate).toLocaleTimeString()
              : "",
            status: order.status || "PENDING",
          }));
          setCreatedOrders(formattedOrders);
        }
      },
    );
  }, [pageData?.id]);

  const loadAllRegisteredPatientsForPage = useCallback(() => {
    if (!pageData?.id) return;
    getFromOpenElisServer(
      `/rest/medlab/page/${pageData.id}/registered-patients?all=true`,
      (response) => {
        if (componentMounted.current && response) {
          setAllRegisteredPatients(Array.isArray(response) ? response : []);
        }
      },
    );
  }, [pageData?.id]);

  const loadPendingRegisteredPatientsForPage = useCallback(() => {
    if (!pageData?.id) return;
    getFromOpenElisServer(
      `/rest/medlab/page/${pageData.id}/registered-patients`,
      (response) => {
        if (componentMounted.current && response) {
          setPendingRegisteredPatients(Array.isArray(response) ? response : []);
        }
      },
    );
  }, [pageData?.id]);

  const loadRegisteredPatientsForPage = useCallback(() => {
    loadAllRegisteredPatientsForPage();
    loadPendingRegisteredPatientsForPage();
  }, [loadAllRegisteredPatientsForPage, loadPendingRegisteredPatientsForPage]);

  // Load available tests from API, then optionally filter by allowedTestIds from the template
  const loadAvailableTests = useCallback(() => {
    const applyFilter = (tests) => {
      const ids = allowedTestIds;
      if (!ids || ids.length === 0) return tests;
      const idSet = new Set(ids.map((id) => Number(id)));
      return tests.filter((t) => idSet.has(Number(t.id || t.value)));
    };
    getFromOpenElisServer("/rest/medlab/orderable-tests", (response) => {
      if (!componentMounted.current) {
        return;
      }
      let tests = normalizeOrderableTestList(response);
      if (tests.length > 0) {
        setAvailableTests(applyFilter(tests));
        return;
      }
      getFromOpenElisServer("/rest/test-list", (fallback) => {
        if (componentMounted.current) {
          setAvailableTests(applyFilter(normalizeOrderableTestList(fallback)));
        }
      });
    });
  }, [allowedTestIds]);

  // Load available tests and existing orders on mount
  useEffect(() => {
    if (componentMounted.current) {
      loadAvailableTests();
      loadOrdersForPage();
      loadRegisteredPatientsForPage();
    }
    return () => {
      componentMounted.current = false;
    };
  }, [loadAvailableTests, loadOrdersForPage, loadRegisteredPatientsForPage]);

  const isFormValid = useCallback(
    (mode = REGISTER_MODE.PATIENT) =>
      isRegistrationFormValid(patientForm, mode),
    [patientForm],
  );

  // Clear form
  const handleClearForm = useCallback(() => {
    setPatientForm({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      nationalId: "",
      fatherNameOrProtocolId: "",
    });
  }, []);

  // Clear registered patients list
  const handleClearList = useCallback(() => {
    if (!pageData?.id) {
      setAllRegisteredPatients([]);
      setPendingRegisteredPatients([]);
      setSelectedPatientsForBulk([]);
      return;
    }
    deleteFromOpenElisServer(
      `/rest/medlab/page/${pageData.id}/registered-patients`,
      () => {
        if (componentMounted.current) {
          setAllRegisteredPatients([]);
          setPendingRegisteredPatients([]);
          setSelectedPatientsForBulk([]);
        }
      },
    );
  }, [pageData?.id]);

  // ========== Bulk Order Selection Handlers ==========
  const handleTogglePatientSelection = useCallback((patient) => {
    setSelectedPatientsForBulk((prev) => {
      const patientId = patient.id || patient.patientID;
      const isSelected = prev.some((p) => (p.id || p.patientID) === patientId);
      if (isSelected) {
        return prev.filter((p) => (p.id || p.patientID) !== patientId);
      } else {
        return [...prev, patient];
      }
    });
  }, []);

  const handleSelectAllPatients = useCallback(() => {
    if (selectedPatientsForBulk.length === pendingRegisteredPatients.length) {
      setSelectedPatientsForBulk([]);
    } else {
      setSelectedPatientsForBulk([...pendingRegisteredPatients]);
    }
  }, [pendingRegisteredPatients, selectedPatientsForBulk.length]);

  const isPatientSelected = useCallback(
    (patient) => {
      const patientId = patient.id || patient.patientID;
      return selectedPatientsForBulk.some(
        (p) => (p.id || p.patientID) === patientId,
      );
    },
    [selectedPatientsForBulk],
  );

  const handleBulkOrderSuccess = useCallback(
    (orders) => {
      // Add the newly created orders to the list with timestamps
      if (orders && orders.length > 0) {
        const currentTime = new Date().toLocaleTimeString();
        const ordersWithTimestamp = orders.map((order) => ({
          ...order,
          createdAt: order.createdAt || currentTime,
        }));
        setCreatedOrders((prev) => [...prev, ...ordersWithTimestamp]);
      }
      // Clear selection after successful bulk order
      setSelectedPatientsForBulk([]);
      // Reload orders from server to ensure consistency
      loadOrdersForPage();
      loadRegisteredPatientsForPage();
      if (onProgressUpdate) {
        onProgressUpdate();
      }
    },
    [loadOrdersForPage, loadRegisteredPatientsForPage, onProgressUpdate],
  );

  const persistRegisteredPatientOnPage = useCallback(
    (snapshot, onDone) => {
      if (!pageData?.id) {
        setAllRegisteredPatients((prev) => [...prev, snapshot]);
        setPendingRegisteredPatients((prev) => [...prev, snapshot]);
        onDone?.();
        return;
      }
      postToOpenElisServerJsonResponse(
        `/rest/medlab/page/${pageData.id}/registered-patients`,
        JSON.stringify(snapshot),
        (response) => {
          if (!componentMounted.current) return;
          const isHttpError = typeof response?.statusCode === "number";
          if (isHttpError || response?.success === false) {
            addNotification({
              title: intl.formatMessage({ id: "notification.title" }),
              message: intl.formatMessage({
                id: "medlab.patient.sessionPersist.error",
                defaultMessage:
                  "Patient saved in LIMS but could not add to this notebook session list. Refresh or redeploy the backend with medlab APIs.",
              }),
              kind: NotificationKinds.warning,
            });
            setNotificationVisible(true);
            setAllRegisteredPatients((prev) => {
              if (prev.some((p) => String(p.id) === String(snapshot.id))) {
                return prev;
              }
              return [...prev, snapshot];
            });
            setPendingRegisteredPatients((prev) => {
              if (prev.some((p) => String(p.id) === String(snapshot.id))) {
                return prev;
              }
              return [...prev, snapshot];
            });
          }
          loadRegisteredPatientsForPage();
          onDone?.();
        },
      );
    },
    [
      pageData?.id,
      intl,
      addNotification,
      setNotificationVisible,
      loadRegisteredPatientsForPage,
    ],
  );

  const handleRegisterPatient = useCallback(
    (mode = REGISTER_MODE.PATIENT) => {
      if (!isFormValid(mode)) {
        addNotification({
          title: intl.formatMessage({ id: "notification.title" }),
          message: intl.formatMessage({
            id: "medlab.patient.validation.error",
            defaultMessage: "Please fill in all required fields",
          }),
          kind: NotificationKinds.warning,
        });
        setNotificationVisible(true);
        return;
      }

      setSubmitting(true);

      const { payload, birthDateForDisplay } = buildPatientManagementPayload(
        patientForm,
        mode,
      );

      postToOpenElisServerJsonResponse(
        "/rest/PatientManagement",
        JSON.stringify(payload),
        (response) => {
          if (!componentMounted.current) return;

          setSubmitting(false);

          const patientPk = response?.patientPK ?? response?.patientPk;
          if (response?.success && patientPk != null && patientPk !== "") {
            const newPatient = buildRegisteredPatientSnapshot(
              patientPk,
              patientForm,
              birthDateForDisplay,
              mode,
            );

            setAllRegisteredPatients((prev) => {
              if (prev.some((p) => String(p.id) === String(newPatient.id))) {
                return prev;
              }
              return [...prev, newPatient];
            });
            setPendingRegisteredPatients((prev) => {
              if (prev.some((p) => String(p.id) === String(newPatient.id))) {
                return prev;
              }
              return [...prev, newPatient];
            });

            persistRegisteredPatientOnPage(newPatient, () => {
              handleClearForm();
              addNotification({
                title: intl.formatMessage({ id: "notification.title" }),
                message: intl.formatMessage({
                  id:
                    mode === REGISTER_MODE.PARTICIPANT
                      ? "medlab.participant.created.success"
                      : "medlab.patient.created.success",
                  defaultMessage:
                    mode === REGISTER_MODE.PARTICIPANT
                      ? "Participant registered successfully"
                      : "Patient registered successfully",
                }),
                kind: NotificationKinds.success,
              });
              setNotificationVisible(true);
              if (onProgressUpdate) {
                onProgressUpdate();
              }
            });
          } else {
            const errorMessage = formatRegistrationError(
              response,
              intl.formatMessage({
                id: "medlab.patient.created.error",
                defaultMessage: "Error registering patient",
              }),
            );
            addNotification({
              title: intl.formatMessage({ id: "notification.title" }),
              message: errorMessage,
              kind: NotificationKinds.error,
            });
            setNotificationVisible(true);
          }
        },
      );
    },
    [
      patientForm,
      isFormValid,
      handleClearForm,
      intl,
      addNotification,
      setNotificationVisible,
      onProgressUpdate,
      persistRegisteredPatientOnPage,
    ],
  );

  // Helper to get order count for a patient (matches by patient ID)
  const getPatientOrderCount = useCallback(
    (patient) => {
      const patientId = getPatientId(patient);
      if (!patientId) return 0;
      return createdOrders.filter(
        (order) => String(order.patientId) === String(patientId),
      ).length;
    },
    [createdOrders],
  );

  // Table headers for registered patients
  const patientHeaders = [
    {
      key: "lastName",
      header: intl.formatMessage({ id: "patient.last.name" }),
    },
    {
      key: "firstName",
      header: intl.formatMessage({
        id: "medlab.patient.firstNameDual",
        defaultMessage: "Patient Name / Participant ID",
      }),
    },
    {
      key: "subjectNumber",
      header: intl.formatMessage({
        id: "medlab.patient.fatherProtocol",
        defaultMessage: "Father Name / Protocol ID",
      }),
    },
    {
      key: "birthDateForDisplay",
      header: intl.formatMessage({
        id: "patient.dob",
        defaultMessage: "Date of Birth",
      }),
    },
    {
      key: "gender",
      header: intl.formatMessage({ id: "patient.gender" }),
    },
    {
      key: "nationalId",
      header: intl.formatMessage({
        id: "patient.natioanalid",
        defaultMessage: "National ID",
      }),
    },
    {
      key: "orders",
      header: intl.formatMessage({
        id: "medlab.patient.orders",
        defaultMessage: "Orders",
      }),
    },
  ];

  return (
    <div className="patient-order-entry-page">
      {/* Page Header */}
      <div className="page-section-header">
        <h4>
          <FormattedMessage
            id="medlab.page.patientOrderEntry.title"
            defaultMessage="Patient / Participant & Lab Order"
          />
        </h4>
        <p className="page-description">
          <FormattedMessage
            id="medlab.page.patientOrderEntry.description"
            defaultMessage="Register a patient or participant, then create lab orders. Step 2 handles sample collection for these orders."
          />
        </p>
      </div>

      {/* Progress Summary */}
      <Grid fullWidth className="progress-section">
        <Column lg={16} md={8} sm={4}>
          <div className="progress-tiles">
            <Tile className="progress-tile verified">
              <span className="progress-label">
                <FormattedMessage
                  id="medlab.patient.registeredTotal"
                  defaultMessage="Registered (session)"
                />
              </span>
              <span className="progress-value">
                {allRegisteredPatients.length}
              </span>
            </Tile>
            <Tile className="progress-tile verified">
              <span className="progress-label">
                <FormattedMessage
                  id="medlab.patient.awaitingOrder"
                  defaultMessage="Awaiting order"
                />
              </span>
              <span className="progress-value">
                {pendingRegisteredPatients.length}
              </span>
            </Tile>
            <Tile className="progress-tile pending">
              <span className="progress-label">
                <FormattedMessage
                  id="medlab.order.createdThisSession"
                  defaultMessage="Orders Created"
                />
              </span>
              <span className="progress-value">{createdOrders.length}</span>
            </Tile>
          </div>
        </Column>
      </Grid>

      {/* Patient Registration */}
      <div>
        {/* Patient Registration Form */}
        <div
          className="patient-registration-form"
          style={{ marginBottom: "1.5rem" }}
        >
          <Grid fullWidth>
            <Column lg={4} md={4} sm={4}>
              <TextInput
                id="patient-first-name"
                labelText={
                  <>
                    <FormattedMessage
                      id="medlab.patient.firstNameDual"
                      defaultMessage="Patient Name / Participant ID"
                    />{" "}
                    <span className="requiredlabel">*</span>
                  </>
                }
                value={patientForm.firstName}
                onChange={(e) =>
                  setPatientForm((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                placeholder={intl.formatMessage({
                  id: "medlab.patient.firstNameDual.placeholder",
                  defaultMessage: "Name or participant ID",
                })}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <TextInput
                id="patient-last-name"
                labelText={intl.formatMessage({
                  id: "medlab.patient.lastName",
                  defaultMessage: "Last name (required for patient)",
                })}
                value={patientForm.lastName}
                onChange={(e) =>
                  setPatientForm((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }))
                }
                placeholder={intl.formatMessage({
                  id: "patient.last.name.placeholder",
                  defaultMessage: "Enter last name (optional for participants)",
                })}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <TextInput
                id="patient-father-protocol"
                labelText={
                  <FormattedMessage
                    id="medlab.patient.fatherProtocol"
                    defaultMessage="Father Name / Protocol ID"
                  />
                }
                value={patientForm.fatherNameOrProtocolId}
                onChange={(e) =>
                  setPatientForm((prev) => ({
                    ...prev,
                    fatherNameOrProtocolId: e.target.value,
                  }))
                }
                placeholder={intl.formatMessage({
                  id: "medlab.patient.fatherProtocol.placeholder",
                  defaultMessage: "Protocol ID (optional)",
                })}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <CustomDatePicker
                id="patient-date-of-birth"
                labelText={intl.formatMessage({
                  id: "medlab.patient.dobOptional",
                  defaultMessage: "Date of Birth (optional)",
                })}
                value={patientForm.dateOfBirth}
                onChange={(date) =>
                  setPatientForm((prev) => ({
                    ...prev,
                    dateOfBirth: date || "",
                  }))
                }
                disallowFutureDate={true}
                updateStateValue={true}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <RadioButtonGroup
                legendText={
                  <>
                    {intl.formatMessage({ id: "patient.gender" })}{" "}
                    <span className="requiredlabel">*</span>
                  </>
                }
                name="patient-gender"
                valueSelected={patientForm.gender}
                onChange={(value) =>
                  setPatientForm((prev) => ({ ...prev, gender: value }))
                }
              >
                <RadioButton
                  labelText={intl.formatMessage({ id: "patient.male" })}
                  value="M"
                  id="gender-male"
                />
                <RadioButton
                  labelText={intl.formatMessage({ id: "patient.female" })}
                  value="F"
                  id="gender-female"
                />
              </RadioButtonGroup>
            </Column>
            <Column lg={4} md={4} sm={4}>
              <TextInput
                id="patient-national-id"
                labelText={
                  <>
                    {intl.formatMessage({
                      id: "patient.natioanalid",
                      defaultMessage: "National ID",
                    })}
                  </>
                }
                value={patientForm.nationalId}
                onChange={(e) =>
                  setPatientForm((prev) => ({
                    ...prev,
                    nationalId: e.target.value,
                  }))
                }
                placeholder={intl.formatMessage({
                  id: "patient.information.nationalid",
                  defaultMessage: "Enter national ID",
                })}
              />
            </Column>
          </Grid>
        </div>

        {/* Action Buttons */}
        <div className="page-actions-bar">
          <Button
            kind="primary"
            size="sm"
            renderIcon={UserFollow}
            onClick={() => handleRegisterPatient(REGISTER_MODE.PATIENT)}
            disabled={submitting || !isFormValid(REGISTER_MODE.PATIENT)}
          >
            {submitting ? (
              <Loading small withOverlay={false} />
            ) : (
              <FormattedMessage
                id="medlab.patient.register"
                defaultMessage="Register Patient"
              />
            )}
          </Button>

          <Button
            kind="primary"
            size="sm"
            renderIcon={UserFollow}
            onClick={() => handleRegisterPatient(REGISTER_MODE.PARTICIPANT)}
            disabled={submitting || !isFormValid(REGISTER_MODE.PARTICIPANT)}
          >
            <FormattedMessage
              id="medlab.patient.registerParticipant"
              defaultMessage="Register Participant"
            />
          </Button>

          <Button kind="tertiary" size="sm" onClick={handleClearForm}>
            <FormattedMessage
              id="medlab.patient.clearForm"
              defaultMessage="Clear Form"
            />
          </Button>

          {allRegisteredPatients.length > 0 && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={TrashCan}
              onClick={handleClearList}
            >
              <FormattedMessage
                id="medlab.patient.clearList"
                defaultMessage="Clear List"
              />
            </Button>
          )}
        </div>

        {/* Registered Patients Table */}
        {allRegisteredPatients.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            {/* Bulk Order Action Bar */}
            <div className="patient-selection-actions">
              <Checkbox
                id="select-all-patients"
                labelText={intl.formatMessage({
                  id: "medlab.patient.selectAll",
                  defaultMessage: "Select All",
                })}
                checked={
                  pendingRegisteredPatients.length > 0 &&
                  selectedPatientsForBulk.length ===
                    pendingRegisteredPatients.length
                }
                indeterminate={
                  selectedPatientsForBulk.length > 0 &&
                  selectedPatientsForBulk.length <
                    pendingRegisteredPatients.length
                }
                onChange={handleSelectAllPatients}
                disabled={pendingRegisteredPatients.length === 0}
              />
              <span className="patient-selection-count">
                {selectedPatientsForBulk.length > 0 && (
                  <FormattedMessage
                    id="medlab.patient.selectedCount"
                    defaultMessage="{count} selected"
                    values={{ count: selectedPatientsForBulk.length }}
                  />
                )}
              </span>
              <Button
                kind="primary"
                size="sm"
                renderIcon={ShoppingCart}
                disabled={selectedPatientsForBulk.length === 0}
                onClick={() => setBulkOrderModalOpen(true)}
              >
                <FormattedMessage
                  id="medlab.patient.createBulkOrders"
                  defaultMessage="Create Orders for Selected ({count})"
                  values={{ count: selectedPatientsForBulk.length }}
                />
              </Button>
              <p className="bulk-order-hint" style={{ marginTop: "0.5rem" }}>
                <FormattedMessage
                  id="medlab.patient.bulkOrderHint"
                  defaultMessage="Select patients awaiting an order, then create orders. Only tests configured on this project template will be available."
                />
              </p>
            </div>

            <DataTable
              rows={allRegisteredPatients}
              headers={patientHeaders}
              isSortable
            >
              {({ rows, headers, getHeaderProps, getTableProps }) => (
                <TableContainer
                  title={intl.formatMessage({
                    id: "medlab.patient.registeredTitle",
                    defaultMessage: "Registered Patients / Participants",
                  })}
                  description={intl.formatMessage(
                    {
                      id: "medlab.patient.registeredCount",
                      defaultMessage: "{count} registered this session",
                    },
                    { count: allRegisteredPatients.length },
                  )}
                >
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        <TableHeader style={{ width: "50px" }}>
                          {/* Checkbox column header - empty */}
                        </TableHeader>
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
                        const patient = allRegisteredPatients.find(
                          (p) => String(p.id) === String(row.id),
                        );
                        const canBulkOrder =
                          patient && getPatientOrderCount(patient) === 0;
                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Checkbox
                                id={`select-patient-${row.id}`}
                                labelText=""
                                hideLabel
                                checked={
                                  patient ? isPatientSelected(patient) : false
                                }
                                disabled={!canBulkOrder}
                                onChange={() =>
                                  patient &&
                                  canBulkOrder &&
                                  handleTogglePatientSelection(patient)
                                }
                              />
                            </TableCell>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>
                                {cell.info.header === "gender"
                                  ? cell.value === "M"
                                    ? intl.formatMessage({
                                        id: "patient.male",
                                      })
                                    : intl.formatMessage({
                                        id: "patient.female",
                                      })
                                  : cell.info.header === "birthDateForDisplay"
                                    ? formatPatientBirthDateDisplay(patient)
                                    : cell.info.header === "orders"
                                      ? (() => {
                                          const orderCount = patient
                                            ? getPatientOrderCount(patient)
                                            : 0;
                                          return orderCount > 0 ? (
                                            <Tag type="green" size="sm">
                                              {orderCount}
                                            </Tag>
                                          ) : (
                                            <Tag type="gray" size="sm">
                                              0
                                            </Tag>
                                          );
                                        })()
                                      : cell.value || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </div>
        )}

        {/* Empty state - show helpful message when no patients registered */}
        {allRegisteredPatients.length === 0 && (
          <div className="empty-state">
            <p>
              <FormattedMessage
                id="medlab.patient.empty"
                defaultMessage="No patients registered yet. Fill in the form above and click Register Patient or Register Participant."
              />
            </p>
          </div>
        )}
      </div>

      {/* Created Orders Table - Global section visible across all tabs */}
      {createdOrders.length > 0 && (
        <div className="created-orders-section" style={{ marginTop: "1.5rem" }}>
          <h5>
            <FormattedMessage
              id="medlab.order.createdOrders"
              defaultMessage="Created Orders This Session"
            />
          </h5>
          <DataTable
            rows={createdOrders}
            headers={[
              {
                key: "labNo",
                header: intl.formatMessage({
                  id: "medlab.order.labNumber",
                  defaultMessage: "Lab Number",
                }),
              },
              {
                key: "patientName",
                header: intl.formatMessage({
                  id: "patient.name",
                  defaultMessage: "Patient",
                }),
              },
              {
                key: "testCount",
                header: intl.formatMessage({
                  id: "medlab.order.testCount",
                  defaultMessage: "Tests",
                }),
              },
              {
                key: "createdAt",
                header: intl.formatMessage({
                  id: "medlab.order.createdAt",
                  defaultMessage: "Created",
                }),
              },
            ]}
          >
            {({ rows, headers, getHeaderProps, getTableProps }) => (
              <TableContainer>
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
                    {rows.map((row) => (
                      <TableRow key={row.id}>
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

      {/* Bulk Order Modal */}
      <BulkOrderModal
        open={bulkOrderModalOpen}
        onClose={() => setBulkOrderModalOpen(false)}
        selectedPatients={selectedPatientsForBulk}
        notebookEntryId={entryId}
        notebookPageId={pageData?.id}
        sampleCollectionPageId={sampleCollectionPageData?.id}
        tests={availableTests}
        allowedTestIds={allowedTestIds}
        onSuccess={handleBulkOrderSuccess}
      />
    </div>
  );
}

export default PatientOrderEntryPage;
