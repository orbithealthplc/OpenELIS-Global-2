import { useState, useEffect, useContext, useCallback } from "react";
import {
  Button,
  Grid,
  Column,
  Loading,
  InlineNotification,
} from "@carbon/react";
import { FormattedMessage, useIntl } from "react-intl";
import { NotificationContext } from "../layout/Layout";
import { AlertDialog, NotificationKinds } from "../common/CustomNotification";
import CustomDatePicker from "../common/CustomDatePicker";
import UserSessionDetailsContext from "../../UserSessionDetailsContext";
import CartridgeUsageAPI from "./EquipmentUsageService";
import ChooseEquipmentModal from "./modals/ChooseEquipment";
import "./EquipmentUsage.css";
import PermissionGate from "../security/PermissionGate";
import { equipmentMutationRoles } from "../../security/rbacActions";
import { usePermissions } from "../../hooks/usePermissions";
import { hasActiveDepartmentScope } from "../../security/departmentAccess";

const normalizePermanentEquipment = (items) =>
  (items || []).map((item) => {
    const itemId = item?.itemId ?? item?.id;
    return {
      ...item,
      id: itemId,
      itemId,
      serialNumber: item?.serialNumber || item?.catalogNumber || "",
    };
  });

const getEquipmentSerialLabel = (item) =>
  item?.serialNumber || item?.catalogNumber || "No serial";

/**
 * EquipmentUsageLog Component
 *
 * Form for recording equipment usage in the MNTD laboratory.
 * Features:
 * - Equipment selection (filtered to CARTRIDGE type from inventory)
 * - Equipment details display (name, serial number, department)
 * - Table for recording multiple usage entries with:
 *   - Date
 *   - Operator Name
 *   - Login Time
 *   - Activities
 *   - Equipment Status
 *   - Logout Time
 *   - Signature
 * - Submit button to record usage without reducing inventory
 * - Calls onSubmitSuccess callback with API response for display in dashboard
 */
const EquipmentUsageLog = ({ onSubmitSuccess }) => {
  const intl = useIntl();
  const { userSessionDetails } = useContext(UserSessionDetailsContext);
  const { isGlobalAdmin } = usePermissions();
  const { setNotificationVisible, addNotification } =
    useContext(NotificationContext);

  const loginLabUnitId = userSessionDetails?.loginLabUnitId;
  const needsActiveDepartment =
    !isGlobalAdmin && !hasActiveDepartmentScope(userSessionDetails);

  const notify = useCallback(
    ({ kind = NotificationKinds.info, title, subtitle, message }) => {
      setNotificationVisible(true);
      addNotification({
        kind,
        title,
        subtitle,
        message,
      });
    },
    [addNotification, setNotificationVisible],
  );

  // Helper functions for date/time formatting
  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getCurrentTime = () => formatTime(new Date());

  // Equipment Selection State
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [equipmentError, setEquipmentError] = useState(null);
  const [departmentById, setDepartmentById] = useState({});

  // Modal State
  const [showChooseEquipmentModal, setShowChooseEquipmentModal] =
    useState(false);

  // Usage Log Table State
  const [usageRows, setUsageRows] = useState([]);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load department-scoped permanent equipment when session department changes
  useEffect(() => {
    if (needsActiveDepartment) {
      setEquipment([]);
      setSelectedEquipment(null);
      setLoadingEquipment(false);
      setEquipmentError(null);
      return undefined;
    }

    const controller = new AbortController();
    setLoadingEquipment(true);
    setEquipmentError(null);

    CartridgeUsageAPI.getDepartmentPermanentEquipment(
      loginLabUnitId || null,
      (data, error) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error) {
          setEquipmentError(
            intl.formatMessage({
              id: "equipment.error.loadFailed",
              defaultMessage: "Failed to load equipment",
            }),
          );
          notify({
            kind: NotificationKinds.error,
            title: intl.formatMessage({ id: "notification.error" }),
            message: intl.formatMessage({
              id: "equipment.error.loadFailed",
              defaultMessage: "Failed to load equipment",
            }),
          });
          setLoadingEquipment(false);
        } else if (data && Array.isArray(data)) {
          setEquipment(normalizePermanentEquipment(data));
          setLoadingEquipment(false);
        } else {
          setEquipmentError(
            intl.formatMessage({
              id: "equipment.error.loadFailed",
              defaultMessage: "Failed to load equipment",
            }),
          );
          setLoadingEquipment(false);
        }
      },
      controller.signal,
    );

    return () => controller.abort();
  }, [intl, loginLabUnitId, needsActiveDepartment, notify]);

  useEffect(() => {
    CartridgeUsageAPI.getAssignableDepartments((data) => {
      if (!Array.isArray(data)) {
        return;
      }
      setDepartmentById(
        data.reduce((departments, department) => {
          departments[String(department.id)] =
            department.name || department.text || department.value || "";
          return departments;
        }, {}),
      );
    });
  }, []);

  const getEquipmentDepartmentName = (item) => {
    if (!item) {
      return "";
    }
    return (
      item.departmentName ||
      item.departmentTestSectionName ||
      departmentById[String(item.departmentTestSectionId || "")] ||
      item.projectName ||
      ""
    );
  };

  // Handle Equipment Selection
  const handleSelectEquipment = (equipment) => {
    setSelectedEquipment(equipment);
    setShowChooseEquipmentModal(false);
  };

  // Add new row to usage log with auto-filled values
  const handleAddRow = () => {
    const newRow = {
      id: Math.max(...usageRows.map((r) => r.id), 0) + 1,
      date: "",
      operatorName: userSessionDetails?.firstName || "",
      loginTime: getCurrentTime(),
      activities: "",
      equipmentStatus: "Functional",
      logoutTime: getCurrentTime(),
      approvedBy: "",
      approvalDate: "",
      signature: userSessionDetails?.firstName || "",
    };
    setUsageRows([...usageRows, newRow]);
  };

  // Remove row from usage log
  const handleRemoveRow = (rowId) => {
    if (usageRows.length > 1) {
      setUsageRows(usageRows.filter((row) => row.id !== rowId));
    }
  };

  // Update row field
  const handleRowChange = (rowId, field, value) => {
    setUsageRows(
      usageRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    );
  };

  // Submit to Server (Record Equipment Usage - without inventory deduction)
  const handleSubmit = () => {
    if (!selectedEquipment) {
      notify({
        kind: NotificationKinds.error,
        title: intl.formatMessage({ id: "notification.error" }),
        message: intl.formatMessage({
          id: "equipment.usage.error.selectEquipment",
        }),
      });
      return;
    }

    if (usageRows.length === 0) {
      notify({
        kind: NotificationKinds.error,
        title: intl.formatMessage({ id: "notification.error" }),
        message: intl.formatMessage({
          id: "equipment.usage.error.noRows",
          defaultMessage: "Please add at least one usage entry",
        }),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const catalogItemId = selectedEquipment.itemId ?? selectedEquipment.id;

      const submitWithLot = (lot) => {
        if (!lot?.id) {
          notify({
            kind: NotificationKinds.error,
            title: intl.formatMessage({ id: "notification.error" }),
            message: intl.formatMessage({
              id: "equipment.usage.error.noLotsAvailable",
            }),
          });
          setIsSubmitting(false);
          return;
        }

        let lastResponse = null;

        const submitNextRow = (rowIndex) => {
          if (rowIndex >= usageRows.length) {
            notify({
              kind: NotificationKinds.success,
              title: intl.formatMessage({ id: "notification.success" }),
              message: intl.formatMessage({
                id: "equipment.usage.message.recordedSuccess",
              }),
            });

            setSelectedEquipment(null);
            setUsageRows([]);

            if (onSubmitSuccess && lastResponse) {
              onSubmitSuccess(lastResponse);
            }

            setIsSubmitting(false);
            return;
          }

          const row = usageRows[rowIndex];

          const entryRequest = {
            itemId: catalogItemId,
            lotId: lot.id,
            quantity: 1,
            labUnitId: userSessionDetails?.labUnit || "",
            operatorName: row.operatorName,
            date: row.date,
            loginTime: row.loginTime,
            activities: row.activities,
            equipmentStatus: row.equipmentStatus,
            logoutTime: row.logoutTime,
            approvedBy: row.approvedBy,
            approvalDate: row.approvalDate,
          };

          CartridgeUsageAPI.submitEquipmentUsageEntry(
            entryRequest,
            (response) => {
              if (response.ok) {
                response
                  .json()
                  .then((data) => {
                    lastResponse = data;
                    submitNextRow(rowIndex + 1);
                  })
                  .catch(() => {
                    submitNextRow(rowIndex + 1);
                  });
              } else {
                notify({
                  kind: NotificationKinds.error,
                  title: intl.formatMessage({ id: "notification.error" }),
                  message: intl.formatMessage({
                    id: "equipment.usage.error.submitFailed",
                  }),
                });
                setIsSubmitting(false);
              }
            },
            () => {
              notify({
                kind: NotificationKinds.error,
                title: intl.formatMessage({ id: "notification.error" }),
                message: intl.formatMessage({
                  id: "equipment.usage.error.submitFailed",
                }),
              });
              setIsSubmitting(false);
            },
          );
        };

        submitNextRow(0);
      };

      if (selectedEquipment.lotId) {
        submitWithLot({ id: selectedEquipment.lotId });
        return;
      }

      CartridgeUsageAPI.getAvailableLots(catalogItemId, (lots) => {
        if (!lots || lots.length === 0) {
          notify({
            kind: NotificationKinds.error,
            title: intl.formatMessage({ id: "notification.error" }),
            message: intl.formatMessage({
              id: "equipment.usage.error.noLotsAvailable",
            }),
          });
          setIsSubmitting(false);
          return;
        }
        submitWithLot(lots[0]);
      });
    } catch (error) {
      console.error("Error submitting usage:", error);
      notify({
        kind: NotificationKinds.error,
        title: intl.formatMessage({ id: "notification.error" }),
        message: intl.formatMessage({
          id: "equipment.usage.error.submitFailed",
        }),
      });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AlertDialog />
      <Grid fullWidth={true}>
        <Column lg={16} md={8} sm={4}>
          <div className="equipmentUsageContainer">
            {needsActiveDepartment && (
              <InlineNotification
                kind="warning"
                lowContrast
                hideCloseButton
                title={intl.formatMessage({
                  id: "equipment.usage.departmentRequired.title",
                  defaultMessage: "Department required",
                })}
                subtitle={intl.formatMessage({
                  id: "equipment.usage.departmentRequired.subtitle",
                  defaultMessage:
                    "Select your laboratory department in the header before choosing equipment.",
                })}
              />
            )}
            {/* Equipment Selection Section */}
            {loadingEquipment ? (
              <Loading description="Loading equipment..." />
            ) : (
              <div className="equipmentSelectionSection">
                <h3>
                  <FormattedMessage
                    id="equipment.usage.selectedEquipment"
                    defaultMessage="Selected equipment"
                  />
                </h3>
                {selectedEquipment ? (
                  <div className="equipmentListSection">
                    <div className="equipmentItem">
                      <div className="equipmentItemContent">
                        <span className="equipmentName">
                          {selectedEquipment.name}
                        </span>
                        <span className="equipmentSerial">
                          {getEquipmentSerialLabel(selectedEquipment)}
                        </span>
                        <Button
                          kind="ghost"
                          size="sm"
                          className="removeEquipmentBtn"
                          onClick={() => handleSelectEquipment(null)}
                        >
                          <FormattedMessage
                            id="common.remove"
                            defaultMessage="Remove"
                          />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    kind="primary"
                    size="sm"
                    onClick={() => setShowChooseEquipmentModal(true)}
                    disabled={needsActiveDepartment}
                  >
                    <FormattedMessage
                      id="equipment.usage.chooseEquipment"
                      defaultMessage="Choose Equipment"
                    />
                  </Button>
                )}
              </div>
            )}

            {/* Equipment Details Section */}
            {selectedEquipment && (
              <div className="equipmentDetailsSection">
                <div className="detailsRow">
                  <div className="detailField">
                    <label>
                      <FormattedMessage
                        id="equipment.name"
                        defaultMessage="Equipment name"
                      />
                    </label>
                    <input
                      type="text"
                      value={selectedEquipment.name}
                      readOnly
                      className="detailsInput"
                    />
                  </div>
                  <div className="detailField">
                    <label>
                      <FormattedMessage
                        id="equipment.serialNumber"
                        defaultMessage="Serial number"
                      />
                    </label>
                    <input
                      type="text"
                      value={getEquipmentSerialLabel(selectedEquipment)}
                      readOnly
                      className="detailsInput"
                    />
                  </div>
                  <div className="detailField">
                    <label>
                      <FormattedMessage
                        id="equipment.department"
                        defaultMessage="Department"
                      />
                    </label>
                    <input
                      type="text"
                      value={getEquipmentDepartmentName(selectedEquipment)}
                      readOnly
                      className="detailsInput"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Usage Log Table */}
            <div className="usageLogSection">
              <h3>
                <FormattedMessage
                  id="equipment.usage.logTable"
                  defaultMessage="Usage Log"
                />
              </h3>
              {usageRows.length === 0 ? (
                <div className="emptyStateSection">
                  <p>
                    <FormattedMessage
                      id="equipment.usage.emptyTable"
                      defaultMessage="No usage records yet. Click 'Add Row' below to start recording equipment usage."
                    />
                  </p>
                </div>
              ) : (
                <div className="tableWrapper">
                  <table className="usageLogTable">
                    <thead>
                      <tr>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.date"
                            defaultMessage="Date"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.operatorName"
                            defaultMessage="Operator Name"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.loginTime"
                            defaultMessage="Login Time"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.activities"
                            defaultMessage="Activities"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.equipmentStatus"
                            defaultMessage="Equipment Status"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.logoutTime"
                            defaultMessage="Logout Time"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.approvedBy"
                            defaultMessage="Approved By"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.approvalDate"
                            defaultMessage="Approval Date"
                          />
                        </th>
                        <th>
                          <FormattedMessage
                            id="equipment.usage.table.signature"
                            defaultMessage="Signature"
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <CustomDatePicker
                              id={`date-picker-${row.id}`}
                              key={`date-${row.id}`}
                              labelText=""
                              value={row.date}
                              updateStateValue={true}
                              className="tableDatePicker"
                              onChange={(date) =>
                                handleRowChange(row.id, "date", date)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={row.operatorName}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "operatorName",
                                  e.target.value,
                                )
                              }
                              placeholder="Operator name"
                              className="tableInput"
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              value={row.loginTime}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "loginTime",
                                  e.target.value,
                                )
                              }
                              placeholder="HH:MM"
                              className="tableInput"
                            />
                          </td>
                          <td>
                            <textarea
                              value={row.activities}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "activities",
                                  e.target.value,
                                )
                              }
                              placeholder="Activities"
                              className="tableTextarea"
                            />
                          </td>
                          <td>
                            <select
                              value={row.equipmentStatus}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "equipmentStatus",
                                  e.target.value,
                                )
                              }
                              className="tableSelect"
                            >
                              <option value="Functional">Functional</option>
                              <option value="Non-functional">
                                Non-functional
                              </option>
                              <option value="Maintenance">Maintenance</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="time"
                              value={row.logoutTime}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "logoutTime",
                                  e.target.value,
                                )
                              }
                              placeholder="HH:MM"
                              className="tableInput"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={row.approvedBy}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "approvedBy",
                                  e.target.value,
                                )
                              }
                              placeholder="Approved by"
                              className="tableInput"
                            />
                          </td>
                          <td>
                            <CustomDatePicker
                              id={`approval-date-picker-${row.id}`}
                              key={`approval-date-${row.id}`}
                              labelText=""
                              value={row.approvalDate}
                              updateStateValue={true}
                              className="tableDatePicker"
                              onChange={(date) =>
                                handleRowChange(row.id, "approvalDate", date)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={row.signature}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  "signature",
                                  e.target.value,
                                )
                              }
                              placeholder="Type name or upload"
                              className="tableInput signatureInput"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add/Remove Row Buttons */}
            <div className="equipmentUsageActionsBottom">
              <Button kind="secondary" onClick={handleAddRow}>
                <FormattedMessage
                  id="equipment.usage.addRow"
                  defaultMessage="Add Row"
                />
              </Button>
              {usageRows.length > 1 && (
                <Button
                  kind="danger"
                  onClick={() =>
                    handleRemoveRow(usageRows[usageRows.length - 1].id)
                  }
                >
                  <FormattedMessage
                    id="equipment.usage.removeRow"
                    defaultMessage="Remove Row"
                  />
                </Button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="equipmentUsageActionsBottom">
              <PermissionGate
                roles={equipmentMutationRoles}
                requireActiveDepartment
                disabledTooltip="You do not have permission to record equipment usage"
              >
                <Button
                  kind="primary"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!selectedEquipment || isSubmitting}
                >
                  {isSubmitting ? (
                    <FormattedMessage
                      id="common.submitting"
                      defaultMessage="Submitting..."
                    />
                  ) : (
                    <FormattedMessage
                      id="equipment.usage.submit"
                      defaultMessage="Submit"
                    />
                  )}
                </Button>
              </PermissionGate>
            </div>
          </div>
        </Column>
      </Grid>

      {/* Choose Equipment Modal */}
      <ChooseEquipmentModal
        open={showChooseEquipmentModal}
        onClose={() => setShowChooseEquipmentModal(false)}
        equipment={equipment}
        onSelectEquipment={handleSelectEquipment}
      />
    </>
  );
};

export default EquipmentUsageLog;
