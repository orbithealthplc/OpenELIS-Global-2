import React, { useState, useCallback, useEffect, useContext } from "react";
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Dropdown,
  TimePicker,
  Button,
  InlineNotification,
  Loading,
  Grid,
  Column,
  ContentSwitcher,
  Switch,
  NumberInput,
} from "@carbon/react";
import { Add, Upload, Renew } from "@carbon/icons-react";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";
import { format, parse } from "date-fns";
import {
  postToOpenElisServerJsonResponse,
  getFromOpenElisServer,
} from "../../../utils/Utils";
import UserSessionDetailsContext from "../../../../UserSessionDetailsContext";
import { ConfigurationContext } from "../../../layout/Layout";
import CustomDatePicker from "../../../common/CustomDatePicker";
import { hasUnrestrictedDepartmentAccess } from "../../../../security/departmentAccess";
import {
  filterOwningDepartments,
  loadNotebookDepartmentIds,
} from "../../utils/notebookInventoryScope";
import { buildSingleEntrySpecialHandling } from "./manifestImportHelpers";

/**
 * SampleIntakeForm - Form for registering samples
 * Sub-stage 1b of the Biorepository Intake workflow
 *
 * Aligns with SRS requirements:
 * Required Fields:
 * - Originating laboratory/source
 * - Sample ID (unique, immutable barcode)
 * - Sample type and category
 * - Date/time of receipt
 * - Storage temperature requirement
 * - Chain of custody: receiver name, external/donor ID, sample code
 *
 * Conditional/Optional Fields:
 * - Ethical approval reference (required if human samples)
 * - Project/study association (optional free text)
 * - Material transfer agreement (required if external)
 *
 * @param {Object} props
 * @param {Object} props.shipment - The current shipment (optional)
 * @param {number} props.notebookId - The notebook ID (for department auto-select)
 * @param {Function} props.onSamplesRegistered - Callback when samples are registered
 * @param {Function} props.onBulkImport - Callback to open bulk import modal
 * @param {Function} props.onCancel - Callback to cancel the form
 */
function SampleIntakeForm({
  shipment,
  notebookId,
  onSamplesRegistered,
  onBulkImport,
  onCancel,
}) {
  const intl = useIntl();
  const { userSessionDetails } = useContext(UserSessionDetailsContext);
  const { configurationProperties } = useContext(ConfigurationContext);
  const requiresDepartmentSelection =
    hasUnrestrictedDepartmentAccess(userSessionDetails);

  // Mode: 0 = single entry, 1 = bulk import
  const [mode, setMode] = useState(0);

  // Helper: locale-aware date-fns parse pattern (matches CustomDatePicker output)
  const getDateParsePattern = () =>
    configurationProperties.DEFAULT_DATE_LOCALE === "fr-FR"
      ? "dd/MM/yyyy"
      : "MM/dd/yyyy";

  // Helper function to get current time in HH:MM format (24-hour)
  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  // Form state for single entry - aligned with SRS requirements
  const [formData, setFormData] = useState({
    // Required fields
    originLab: shipment?.senderOrganization || "", // Originating laboratory/source
    barcode: "", // Sample ID (unique barcode)
    sampleTypeId: null, // Sample type and category
    receiptDate: format(new Date(), "MM/dd/yyyy"), // Date of receipt (default to today, locale-formatted)
    receiptTime: getCurrentTime(), // Time of receipt (default to now in 24-hour format)
    storageTemperature: "AMBIENT", // Storage temperature requirement
    requiredTempMin: null, // Min temp for custom range
    requiredTempMax: null, // Max temp for custom range
    biosafetyLevel: "BSL_2", // Biosafety level (manifest field)
    receiverName: "", // Chain of custody: receiving personnel

    // Conditional/Optional fields
    externalId: "", // External/Donor ID (chain of custody)
    approvalSign: "", // Approval/sign (chain of custody)
    projectName: "", // Project/study association (optional)
    ethicsApprovalRef: "", // Ethical approval reference
    mtaReference: "", // Material transfer agreement
    specialHandling: "", // Special handling instructions
    collectionDate: null, // Original collection date (optional)
    arrivalCondition: "", // Sample condition at receipt
    volume: "", // Volume assessment
    preservationMedium: "", // Preservation medium
    principalInvestigator: "", // Principal investigator
    consentId: "", // Consent ID
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [registeredSamples, setRegisteredSamples] = useState([]);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  // Dropdown options
  const [sampleTypes, setSampleTypes] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // Storage temperature presets
  const storageTemperatures = [
    {
      id: "AMBIENT",
      text: intl.formatMessage({
        id: "biorepository.temp.ambient",
        defaultMessage: "Ambient Temperature (15-25°C)",
      }),
    },
    {
      id: "REFRIGERATED",
      text: intl.formatMessage({
        id: "biorepository.temp.refrigerated",
        defaultMessage: "Refrigerated (2-8°C)",
      }),
    },
    {
      id: "FROZEN_20",
      text: intl.formatMessage({
        id: "biorepository.temp.frozen20",
        defaultMessage: "Frozen (-20°C)",
      }),
    },
    {
      id: "FROZEN_80",
      text: intl.formatMessage({
        id: "biorepository.temp.frozen80",
        defaultMessage: "Ultra-low (-80°C)",
      }),
    },
    {
      id: "FROZEN_150",
      text: intl.formatMessage({
        id: "biorepository.temp.frozen150",
        defaultMessage: "Vapor Phase (-150°C)",
      }),
    },
    {
      id: "LIQUID_N2",
      text: intl.formatMessage({
        id: "biorepository.temp.liquidN2",
        defaultMessage: "Liquid Nitrogen (-196°C)",
      }),
    },
    {
      id: "CUSTOM",
      text: intl.formatMessage({
        id: "biorepository.temp.custom",
        defaultMessage: "Custom Range",
      }),
    },
  ];

  const biosafetyLevels = [
    {
      id: "BSL_1",
      text: intl.formatMessage({
        id: "biorepository.bsl.1",
        defaultMessage: "BSL-1",
      }),
    },
    {
      id: "BSL_2",
      text: intl.formatMessage({
        id: "biorepository.bsl.2",
        defaultMessage: "BSL-2",
      }),
    },
    {
      id: "BSL_3",
      text: intl.formatMessage({
        id: "biorepository.bsl.3",
        defaultMessage: "BSL-3",
      }),
    },
    {
      id: "BSL_4",
      text: intl.formatMessage({
        id: "biorepository.bsl.4",
        defaultMessage: "BSL-4",
      }),
    },
  ];

  // Validation state
  const [errors, setErrors] = useState({});

  // Load dropdown options
  useEffect(() => {
    // Load sample types
    getFromOpenElisServer("/rest/displayList/SAMPLE_TYPE_ACTIVE", (data) => {
      if (data) {
        setSampleTypes(data.map((item) => ({ id: item.id, text: item.value })));
      }
    });

    // Load organizations for origin lab dropdown
    getFromOpenElisServer("/rest/displayList/REFERRING_CLINIC", (data) => {
      if (data) {
        setOrganizations(
          data.map((item) => ({ id: item.id, text: item.value })),
        );
      }
    });
  }, []);

  useEffect(() => {
    const first = userSessionDetails?.firstName?.trim() || "";
    const last = userSessionDetails?.lastName?.trim() || "";
    const name = `${first} ${last}`.trim();
    if (!name) {
      return;
    }
    setFormData((prev) =>
      prev.receiverName ? prev : { ...prev, receiverName: name },
    );
  }, [userSessionDetails]);

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
    if (!requiresDepartmentSelection) {
      return;
    }

    let cancelled = false;
    setDepartmentsLoading(true);

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
    requiresDepartmentSelection,
    notebookId,
    applyDefaultDepartmentSelection,
  ]);

  // Auto-generate barcode on mount
  useEffect(() => {
    generateNewBarcode();
  }, []);

  const generateNewBarcode = useCallback(() => {
    setGeneratingBarcode(true);
    getFromOpenElisServer(
      "/rest/biorepository/sample/generate-barcode",
      (data) => {
        setGeneratingBarcode(false);
        if (data && data.barcode) {
          setFormData((prev) => ({ ...prev, barcode: data.barcode }));
        }
      },
    );
  }, []);

  // Get temperature range based on preset
  const getTemperatureRange = useCallback((preset) => {
    switch (preset) {
      case "AMBIENT":
        return { min: 15, max: 25 };
      case "REFRIGERATED":
        return { min: 2, max: 8 };
      case "FROZEN_20":
        return { min: -25, max: -15 };
      case "FROZEN_80":
        return { min: -86, max: -76 };
      case "FROZEN_150":
        return { min: -196, max: -150 };
      case "LIQUID_N2":
        return { min: -200, max: -190 };
      default:
        return { min: null, max: null };
    }
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};

    // Required: Originating laboratory/source
    if (!formData.originLab.trim()) {
      newErrors.originLab = intl.formatMessage({
        id: "biorepository.sample.error.originLab.required",
        defaultMessage: "Originating laboratory/source is required",
      });
    }

    // Required: Sample ID (barcode)
    if (!formData.barcode.trim()) {
      newErrors.barcode = intl.formatMessage({
        id: "biorepository.sample.error.barcode.required",
        defaultMessage: "Sample ID (barcode) is required",
      });
    }

    if (!formData.receiverName.trim()) {
      newErrors.receiverName = intl.formatMessage({
        id: "biorepository.sample.error.receiverName.required",
        defaultMessage: "Receiver name is required",
      });
    }

    if (!formData.externalId.trim()) {
      newErrors.externalId = intl.formatMessage({
        id: "biorepository.sample.error.externalId.required",
        defaultMessage: "External/Donor ID is required",
      });
    }

    // Required: Sample type
    if (!formData.sampleTypeId) {
      newErrors.sampleTypeId = intl.formatMessage({
        id: "biorepository.sample.error.sampleType.required",
        defaultMessage: "Sample type is required",
      });
    }

    // Required: Receipt date
    if (!formData.receiptDate) {
      newErrors.receiptDate = intl.formatMessage({
        id: "biorepository.sample.error.receiptDate.required",
        defaultMessage: "Receipt date is required",
      });
    }

    // Required: Storage temperature
    if (!formData.storageTemperature) {
      newErrors.storageTemperature = intl.formatMessage({
        id: "biorepository.sample.error.storageTemp.required",
        defaultMessage: "Storage temperature requirement is required",
      });
    }

    if (
      formData.biosafetyLevel &&
      !["BSL_1", "BSL_2", "BSL_3", "BSL_4"].includes(formData.biosafetyLevel)
    ) {
      newErrors.biosafetyLevel = intl.formatMessage({
        id: "biorepository.sample.error.biosafetyLevel.invalid",
        defaultMessage:
          "Invalid biosafety level. Must be BSL_1, BSL_2, BSL_3, or BSL_4",
      });
    }

    // Custom temperature range validation
    if (formData.storageTemperature === "CUSTOM") {
      if (
        formData.requiredTempMin === null ||
        formData.requiredTempMax === null
      ) {
        newErrors.customTemp = intl.formatMessage({
          id: "biorepository.sample.error.customTemp.required",
          defaultMessage:
            "Both min and max temperatures are required for custom range",
        });
      } else if (formData.requiredTempMin >= formData.requiredTempMax) {
        newErrors.customTemp = intl.formatMessage({
          id: "biorepository.sample.error.customTemp.invalid",
          defaultMessage: "Min temperature must be less than max temperature",
        });
      }
    }

    if (requiresDepartmentSelection) {
      if (departmentsLoading) {
        newErrors.department = intl.formatMessage({
          id: "storage.room.department.loading",
          defaultMessage: "Loading departments…",
        });
      } else if (departments.length === 0) {
        newErrors.department = intl.formatMessage({
          id: "storage.room.department.none",
          defaultMessage:
            "No lab unit / department is assigned to your account. Contact an administrator.",
        });
      } else if (!departmentId) {
        newErrors.department = intl.formatMessage({
          id: "biorepository.sample.error.department.required",
          defaultMessage: "Select a department (lab unit) for this sample",
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    formData,
    intl,
    requiresDepartmentSelection,
    departmentsLoading,
    departments.length,
    departmentId,
  ]);

  const handleInputChange = useCallback(
    (field, value) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors],
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setLoading(true);
      setError(null);

      // Calculate temperature range
      let tempRange;
      if (formData.storageTemperature === "CUSTOM") {
        tempRange = {
          min: formData.requiredTempMin,
          max: formData.requiredTempMax,
        };
      } else {
        tempRange = getTemperatureRange(formData.storageTemperature);
      }

      // Parse locale-formatted date and combine with time for backend (yyyy-MM-dd HH:mm:ss)
      const parsePattern = getDateParsePattern();
      let receiptDateTime;
      if (formData.receiptDate && formData.receiptTime) {
        const parsedDate = parse(
          formData.receiptDate,
          parsePattern,
          new Date(),
        );
        receiptDateTime = `${format(parsedDate, "yyyy-MM-dd")} ${formData.receiptTime}:00`;
      } else {
        receiptDateTime = format(new Date(), "yyyy-MM-dd HH:mm:ss");
      }

      // Parse collection date if provided
      let collectionDateFormatted = null;
      if (formData.collectionDate) {
        const parsedCollDate = parse(
          formData.collectionDate,
          parsePattern,
          new Date(),
        );
        collectionDateFormatted = `${format(parsedCollDate, "yyyy-MM-dd")} 00:00:00`;
      }

      const composedSpecialHandling = buildSingleEntrySpecialHandling({
        specialHandling: formData.specialHandling,
        volume: formData.volume,
        receiverName: formData.receiverName,
        approvalSign: formData.approvalSign,
      });

      const sampleData = {
        barcode: formData.barcode.trim(),
        externalId: formData.externalId.trim(),
        originLab: formData.originLab.trim(),
        sampleTypeId: formData.sampleTypeId,
        receiptDate: receiptDateTime,
        collectionDate: collectionDateFormatted,
        requiredTempMin: tempRange.min,
        requiredTempMax: tempRange.max,
        biosafetyLevel: formData.biosafetyLevel,
        projectId: formData.projectName.trim() || null,
        principalInvestigator: formData.principalInvestigator.trim() || null,
        consentId: formData.consentId.trim() || null,
        ethicsApprovalRef: formData.ethicsApprovalRef.trim() || null,
        mtaReference: formData.mtaReference.trim() || null,
        preservationMedium: formData.preservationMedium.trim() || null,
        arrivalCondition: formData.arrivalCondition.trim() || null,
        specialHandling: composedSpecialHandling || null,
        shipmentId: shipment?.id || null,
      };

      if (requiresDepartmentSelection && departmentId) {
        const deptNum = parseInt(departmentId, 10);
        if (!Number.isNaN(deptNum)) {
          sampleData.departmentTestSectionId = deptNum;
        }
      }

      postToOpenElisServerJsonResponse(
        "/rest/biorepository/sample/register",
        JSON.stringify(sampleData),
        (response) => {
          setLoading(false);
          if (response?.error) {
            setError(response.error);
          } else if (response) {
            setSuccess(true);
            setRegisteredSamples((prev) => [...prev, response]);
            if (onSamplesRegistered) {
              onSamplesRegistered([response]);
            }
            // Reset form for next entry but keep shipment-related defaults
            setFormData((prev) => ({
              ...prev,
              barcode: "",
              externalId: "",
              approvalSign: "",
              collectionDate: null,
              specialHandling: "",
              arrivalCondition: "",
              volume: "",
              preservationMedium: "",
              principalInvestigator: "",
              consentId: "",
            }));
            // Generate new barcode for next sample
            generateNewBarcode();
          }
        },
      );
    },
    [
      formData,
      shipment,
      validateForm,
      onSamplesRegistered,
      intl,
      getTemperatureRange,
      generateNewBarcode,
      requiresDepartmentSelection,
      departmentId,
    ],
  );

  return (
    <div className="sample-intake-form">
      {loading && <Loading withOverlay description="Processing..." />}

      {error && (
        <InlineNotification
          kind="error"
          title={intl.formatMessage({
            id: "biorepository.sample.error.title",
            defaultMessage: "Error",
          })}
          subtitle={error}
          lowContrast
          onClose={() => setError(null)}
        />
      )}

      {success && registeredSamples.length > 0 && (
        <InlineNotification
          kind="success"
          title={intl.formatMessage({
            id: "biorepository.sample.success.title",
            defaultMessage: "Samples Registered",
          })}
          subtitle={intl.formatMessage(
            {
              id: "biorepository.sample.success.message",
              defaultMessage: "{count} sample(s) registered successfully.",
            },
            { count: registeredSamples.length },
          )}
          lowContrast
          onClose={() => setSuccess(false)}
        />
      )}

      <Grid>
        <Column lg={16} md={8} sm={4}>
          <ContentSwitcher
            onChange={({ index }) => setMode(index)}
            selectedIndex={mode}
            style={{ marginBottom: "1rem" }}
          >
            <Switch name="single">
              <Add size={16} style={{ marginRight: "0.5rem" }} />
              <FormattedMessage
                id="biorepository.sample.mode.single"
                defaultMessage="Single Entry"
              />
            </Switch>
            <Switch name="bulk">
              <Upload size={16} style={{ marginRight: "0.5rem" }} />
              <FormattedMessage
                id="biorepository.sample.mode.bulk"
                defaultMessage="Bulk Import"
              />
            </Switch>
          </ContentSwitcher>
        </Column>
      </Grid>

      {mode === 0 ? (
        <Form onSubmit={handleSubmit}>
          <Grid>
            {/* REQUIRED FIELDS SECTION */}
            <Column lg={16} md={8} sm={4}>
              <h4 style={{ marginBottom: "1rem", marginTop: "0.5rem" }}>
                <FormattedMessage
                  id="biorepository.sample.section.required"
                  defaultMessage="Required Information"
                />
              </h4>
            </Column>

            {/* Originating Laboratory/Source */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="originLab"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.originLab",
                    defaultMessage: "Originating Laboratory/Source *",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.originLab.placeholder",
                    defaultMessage: "Enter source laboratory or organization",
                  })}
                  value={formData.originLab}
                  onChange={(e) =>
                    handleInputChange("originLab", e.target.value)
                  }
                  invalid={!!errors.originLab}
                  invalidText={errors.originLab}
                />
              </FormGroup>
            </Column>

            {requiresDepartmentSelection && (
              <Column lg={8} md={4} sm={4}>
                <FormGroup legendText="">
                  {departmentsLoading ? (
                    <p>
                      {intl.formatMessage({
                        id: "storage.room.department.loading",
                        defaultMessage: "Loading departments…",
                      })}
                    </p>
                  ) : departments.length > 0 ? (
                    <Dropdown
                      id="department"
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
                          if (errors.department) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.department;
                              return next;
                            });
                          }
                        }
                      }}
                      invalid={!!errors.department}
                      invalidText={errors.department}
                    />
                  ) : (
                    <p style={{ color: "#da1e28" }}>
                      {intl.formatMessage({
                        id: "storage.room.department.none",
                        defaultMessage:
                          "No lab unit / department is assigned to your account. Contact an administrator.",
                      })}
                    </p>
                  )}
                </FormGroup>
              </Column>
            )}

            {/* Sample Type */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <Dropdown
                  id="sampleType"
                  titleText={intl.formatMessage({
                    id: "biorepository.sample.field.sampleType",
                    defaultMessage: "Sample Type *",
                  })}
                  label={intl.formatMessage({
                    id: "biorepository.sample.field.sampleType.placeholder",
                    defaultMessage: "Select sample type",
                  })}
                  items={sampleTypes}
                  itemToString={(item) => (item ? item.text : "")}
                  selectedItem={sampleTypes.find(
                    (t) => t.id === formData.sampleTypeId,
                  )}
                  onChange={({ selectedItem }) =>
                    handleInputChange("sampleTypeId", selectedItem?.id)
                  }
                  invalid={!!errors.sampleTypeId}
                  invalidText={errors.sampleTypeId}
                />
              </FormGroup>
            </Column>

            {/* Receipt Date */}
            <Column lg={4} md={2} sm={2}>
              <FormGroup legendText="">
                <CustomDatePicker
                  id="receiptDate"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.receiptDate",
                    defaultMessage: "Receipt Date *",
                  })}
                  value={formData.receiptDate}
                  onChange={(date) => handleInputChange("receiptDate", date)}
                  disallowFutureDate={true}
                  updateStateValue={true}
                  invalid={!!errors.receiptDate}
                  invalidText={errors.receiptDate}
                />
              </FormGroup>
            </Column>

            {/* Receipt Time */}
            <Column lg={4} md={2} sm={2}>
              <FormGroup legendText="">
                <TextInput
                  id="receiptTime"
                  type="time"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.receiptTime",
                    defaultMessage: "Receipt Time *",
                  })}
                  value={formData.receiptTime}
                  onChange={(e) =>
                    handleInputChange("receiptTime", e.target.value)
                  }
                  invalid={!!errors.receiptTime}
                  invalidText={errors.receiptTime}
                />
              </FormGroup>
            </Column>

            {/* Storage Temperature Requirement */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <Dropdown
                  id="storageTemperature"
                  titleText={intl.formatMessage({
                    id: "biorepository.sample.field.storageTemp",
                    defaultMessage: "Storage Temperature Requirement *",
                  })}
                  label={intl.formatMessage({
                    id: "biorepository.sample.field.storageTemp.placeholder",
                    defaultMessage: "Select storage temperature",
                  })}
                  items={storageTemperatures}
                  itemToString={(item) => (item ? item.text : "")}
                  selectedItem={storageTemperatures.find(
                    (t) => t.id === formData.storageTemperature,
                  )}
                  onChange={({ selectedItem }) =>
                    handleInputChange("storageTemperature", selectedItem?.id)
                  }
                  invalid={!!errors.storageTemperature}
                  invalidText={errors.storageTemperature}
                />
              </FormGroup>
            </Column>

            {/* Custom Temperature Range (conditional) */}
            {formData.storageTemperature === "CUSTOM" && (
              <>
                <Column lg={4} md={2} sm={2}>
                  <FormGroup legendText="">
                    <NumberInput
                      id="requiredTempMin"
                      label={intl.formatMessage({
                        id: "biorepository.sample.field.tempMin",
                        defaultMessage: "Min Temp (°C)",
                      })}
                      value={formData.requiredTempMin || ""}
                      onChange={(e, { value }) =>
                        handleInputChange("requiredTempMin", value)
                      }
                      min={-200}
                      max={50}
                      step={1}
                      invalid={!!errors.customTemp}
                    />
                  </FormGroup>
                </Column>
                <Column lg={4} md={2} sm={2}>
                  <FormGroup legendText="">
                    <NumberInput
                      id="requiredTempMax"
                      label={intl.formatMessage({
                        id: "biorepository.sample.field.tempMax",
                        defaultMessage: "Max Temp (°C)",
                      })}
                      value={formData.requiredTempMax || ""}
                      onChange={(e, { value }) =>
                        handleInputChange("requiredTempMax", value)
                      }
                      min={-200}
                      max={50}
                      step={1}
                      invalid={!!errors.customTemp}
                      invalidText={errors.customTemp}
                    />
                  </FormGroup>
                </Column>
              </>
            )}

            {/* Biosafety Level */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <Dropdown
                  id="biosafetyLevel"
                  titleText={intl.formatMessage({
                    id: "biorepository.sample.field.biosafetyLevel",
                    defaultMessage: "Biosafety Level *",
                  })}
                  label={intl.formatMessage({
                    id: "biorepository.sample.field.biosafetyLevel.placeholder",
                    defaultMessage: "Select biosafety level",
                  })}
                  items={biosafetyLevels}
                  itemToString={(item) => (item ? item.text : "")}
                  selectedItem={biosafetyLevels.find(
                    (level) => level.id === formData.biosafetyLevel,
                  )}
                  onChange={({ selectedItem }) =>
                    handleInputChange("biosafetyLevel", selectedItem?.id)
                  }
                  invalid={!!errors.biosafetyLevel}
                  invalidText={errors.biosafetyLevel}
                />
              </FormGroup>
            </Column>

            {/* CHAIN OF CUSTODY SECTION */}
            <Column lg={16} md={8} sm={4}>
              <h4 style={{ marginBottom: "1rem", marginTop: "1.5rem" }}>
                <FormattedMessage
                  id="biorepository.sample.section.chainOfCustody"
                  defaultMessage="Chain of Custody"
                />
              </h4>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="receiverName"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.receiverName",
                    defaultMessage: "Receiver Name *",
                  })}
                  helperText={intl.formatMessage({
                    id: "biorepository.sample.field.receiverName.helper",
                    defaultMessage:
                      "Person receiving the sample into biorepository custody",
                  })}
                  value={formData.receiverName}
                  onChange={(e) =>
                    handleInputChange("receiverName", e.target.value)
                  }
                  invalid={!!errors.receiverName}
                  invalidText={errors.receiverName}
                />
              </FormGroup>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="externalId"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.externalId",
                    defaultMessage: "External/Donor ID *",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.externalId.placeholder",
                    defaultMessage: "Enter external or donor identifier",
                  })}
                  value={formData.externalId}
                  onChange={(e) =>
                    handleInputChange("externalId", e.target.value)
                  }
                  invalid={!!errors.externalId}
                  invalidText={errors.externalId}
                />
              </FormGroup>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="approvalSign"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.approvalSign",
                    defaultMessage: "Approval/Sign",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.approvalSign.placeholder",
                    defaultMessage: "Enter approval or signature reference",
                  })}
                  value={formData.approvalSign}
                  onChange={(e) =>
                    handleInputChange("approvalSign", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "0.5rem",
                  }}
                >
                  <TextInput
                    id="barcode"
                    labelText={intl.formatMessage({
                      id: "biorepository.sample.field.sampleCode",
                      defaultMessage: "Sample Code *",
                    })}
                    placeholder={intl.formatMessage({
                      id: "biorepository.sample.field.barcode.placeholder",
                      defaultMessage: "Auto-generated or enter manually",
                    })}
                    value={formData.barcode}
                    onChange={(e) =>
                      handleInputChange("barcode", e.target.value)
                    }
                    invalid={!!errors.barcode}
                    invalidText={errors.barcode}
                    style={{ flexGrow: 1 }}
                  />
                  <Button
                    kind="ghost"
                    size="md"
                    hasIconOnly
                    renderIcon={Renew}
                    iconDescription={intl.formatMessage({
                      id: "biorepository.sample.button.generateBarcode",
                      defaultMessage: "Generate new barcode",
                    })}
                    onClick={generateNewBarcode}
                    disabled={generatingBarcode}
                  />
                </div>
              </FormGroup>
            </Column>

            {/* SAMPLE DETAILS SECTION */}
            <Column lg={16} md={8} sm={4}>
              <h4 style={{ marginBottom: "1rem", marginTop: "1.5rem" }}>
                <FormattedMessage
                  id="biorepository.sample.section.sampleDetails"
                  defaultMessage="Sample Details"
                />
              </h4>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="arrivalCondition"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.arrivalCondition",
                    defaultMessage: "Sample Condition",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.arrivalCondition.placeholder",
                    defaultMessage:
                      "e.g. thawed once, hemolyzed, good condition",
                  })}
                  value={formData.arrivalCondition}
                  onChange={(e) =>
                    handleInputChange("arrivalCondition", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="volume"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.volume",
                    defaultMessage: "Volume",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.volume.placeholder",
                    defaultMessage: "e.g. sufficient, insufficient volume",
                  })}
                  value={formData.volume}
                  onChange={(e) => handleInputChange("volume", e.target.value)}
                />
              </FormGroup>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="preservationMedium"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.preservationMedium",
                    defaultMessage: "Preservation Medium",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.preservationMedium.placeholder",
                    defaultMessage: "e.g. EDTA, Heparin, formalin",
                  })}
                  value={formData.preservationMedium}
                  onChange={(e) =>
                    handleInputChange("preservationMedium", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            {/* CONDITIONAL/OPTIONAL FIELDS SECTION */}
            <Column lg={16} md={8} sm={4}>
              <h4 style={{ marginBottom: "1rem", marginTop: "1.5rem" }}>
                <FormattedMessage
                  id="biorepository.sample.section.optional"
                  defaultMessage="Additional Information"
                />
              </h4>
            </Column>

            {/* Project */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="projectName"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.project",
                    defaultMessage: "Project/Study Association",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.project.placeholder",
                    defaultMessage: "Enter project or study name (optional)",
                  })}
                  value={formData.projectName}
                  onChange={(e) =>
                    handleInputChange("projectName", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            {/* Collection Date (original) */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <CustomDatePicker
                  id="collectionDate"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.collectionDate",
                    defaultMessage: "Original Collection Date",
                  })}
                  value={formData.collectionDate || ""}
                  onChange={(date) =>
                    handleInputChange("collectionDate", date || null)
                  }
                  disallowFutureDate={true}
                  updateStateValue={true}
                />
              </FormGroup>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="principalInvestigator"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.principalInvestigator",
                    defaultMessage: "Principal Investigator",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.principalInvestigator.placeholder",
                    defaultMessage: "Enter principal investigator name",
                  })}
                  value={formData.principalInvestigator}
                  onChange={(e) =>
                    handleInputChange("principalInvestigator", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="consentId"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.consentId",
                    defaultMessage: "Consent ID",
                  })}
                  helperText={intl.formatMessage({
                    id: "biorepository.sample.field.consentId.helper",
                    defaultMessage: "Required for human samples",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.consentId.placeholder",
                    defaultMessage: "Enter consent identifier",
                  })}
                  value={formData.consentId}
                  onChange={(e) =>
                    handleInputChange("consentId", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            {/* Ethics Approval Reference */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="ethicsApprovalRef"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.ethicsApproval",
                    defaultMessage: "Ethics Approval Reference",
                  })}
                  helperText={intl.formatMessage({
                    id: "biorepository.sample.field.ethicsApproval.helper",
                    defaultMessage: "Required for human samples",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.ethicsApproval.placeholder",
                    defaultMessage: "Enter ethics approval reference",
                  })}
                  value={formData.ethicsApprovalRef}
                  onChange={(e) =>
                    handleInputChange("ethicsApprovalRef", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            {/* MTA Reference */}
            <Column lg={8} md={4} sm={4}>
              <FormGroup legendText="">
                <TextInput
                  id="mtaReference"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.mtaReference",
                    defaultMessage: "MTA Reference",
                  })}
                  helperText={intl.formatMessage({
                    id: "biorepository.sample.field.mtaReference.helper",
                    defaultMessage: "Required for external samples",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.mtaReference.placeholder",
                    defaultMessage:
                      "Enter Material Transfer Agreement reference",
                  })}
                  value={formData.mtaReference}
                  onChange={(e) =>
                    handleInputChange("mtaReference", e.target.value)
                  }
                />
              </FormGroup>
            </Column>

            {/* Special Handling */}
            <Column lg={16} md={8} sm={4}>
              <FormGroup legendText="">
                <TextArea
                  id="specialHandling"
                  labelText={intl.formatMessage({
                    id: "biorepository.sample.field.specialHandling",
                    defaultMessage: "Special Handling Instructions",
                  })}
                  placeholder={intl.formatMessage({
                    id: "biorepository.sample.field.specialHandling.placeholder",
                    defaultMessage: "Enter any special handling requirements",
                  })}
                  value={formData.specialHandling}
                  onChange={(e) =>
                    handleInputChange("specialHandling", e.target.value)
                  }
                  rows={2}
                />
              </FormGroup>
            </Column>

            {/* Form Actions */}
            <Column lg={16} md={8} sm={4}>
              <div
                className="form-actions"
                style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}
              >
                <Button type="submit" disabled={loading}>
                  <FormattedMessage
                    id="biorepository.sample.button.register"
                    defaultMessage="Register Sample"
                  />
                </Button>
                {onCancel && (
                  <Button
                    kind="secondary"
                    onClick={onCancel}
                    disabled={loading}
                  >
                    <FormattedMessage
                      id="biorepository.button.cancel"
                      defaultMessage="Cancel"
                    />
                  </Button>
                )}
              </div>
            </Column>
          </Grid>
        </Form>
      ) : (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h5 style={{ marginBottom: "1rem" }}>
            <FormattedMessage
              id="biorepository.sample.bulkImport.title"
              defaultMessage="Bulk Sample Import"
            />
          </h5>
          <p style={{ marginBottom: "1.5rem", color: "#525252" }}>
            <FormattedMessage
              id="biorepository.sample.bulkImport.description"
              defaultMessage="Upload a CSV manifest file to register multiple samples at once."
            />
          </p>
          <Button
            kind="primary"
            renderIcon={Upload}
            onClick={onBulkImport}
            size="lg"
          >
            <FormattedMessage
              id="biorepository.sample.bulkImport.button"
              defaultMessage="Import Manifest"
            />
          </Button>
        </div>
      )}
    </div>
  );
}

SampleIntakeForm.propTypes = {
  shipment: PropTypes.object,
  notebookId: PropTypes.number,
  onSamplesRegistered: PropTypes.func,
  onBulkImport: PropTypes.func,
  onCancel: PropTypes.func,
};

export default SampleIntakeForm;
