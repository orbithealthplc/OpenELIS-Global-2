import { useState, useEffect, useRef, useCallback } from "react";
import {
  Grid,
  Column,
  Button,
  Tile,
  InlineNotification,
  NumberInput,
  TextInput,
  Tag,
  Select,
  SelectItem,
} from "@carbon/react";
import { Add, Renew, Checkmark } from "@carbon/react/icons";
import { FormattedMessage, useIntl } from "react-intl";
import {
  getFromOpenElisServer,
  postToOpenElisServer,
  postToOpenElisServerJsonResponse,
} from "../../../utils/Utils";
import SampleGrid from "../../workflow/SampleGrid";
import "../../workflow/NotebookWorkflow.css";

const OTHER_ISOLATE_TYPE = "__OTHER__";

/**
 * BacteriologyIsolateCreationPage - Stage 6: Isolate Creation
 */
function BacteriologyIsolateCreationPage({
  entryId,
  notebookId,
  pageData,
  onProgressUpdate,
  onNextPage,
}) {
  const intl = useIntl();
  const componentMounted = useRef(false);
  const formRestoredRef = useRef(false);
  const samplesLoadedRef = useRef(false);

  const [samples, setSamples] = useState([]);
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sampleTypes, setSampleTypes] = useState([]);
  const [creating, setCreating] = useState(false);

  const [isolateData, setIsolateData] = useState({
    numberOfIsolates: 1,
    externalIdPrefix: "BACT-ISO",
    isolateType: "",
    customIsolateType: "",
    isolateTypeFreeText: "",
  });

  const hasRealPageId =
    pageData?.id && !String(pageData.id).startsWith("default-");

  const parsePageFormState = useCallback(() => {
    if (!pageData?.content) return null;
    try {
      const parsed =
        typeof pageData.content === "string"
          ? JSON.parse(pageData.content)
          : pageData.content;
      return parsed?.isolateWizard?.isolateData || parsed?.isolateForm || null;
    } catch {
      return null;
    }
  }, [pageData?.content]);

  const saveFormState = useCallback(() => {
    if (!hasRealPageId) return;
    postToOpenElisServer(
      `/rest/notebook/bulk/page/${pageData.id}/content`,
      JSON.stringify({
        content: JSON.stringify({ isolateForm: isolateData }),
      }),
      () => {},
    );
  }, [isolateData, hasRealPageId, pageData?.id]);

  useEffect(() => {
    if (formRestoredRef.current) return;
    formRestoredRef.current = true;
    const saved = parsePageFormState();
    if (saved) {
      setIsolateData((prev) => ({ ...prev, ...saved }));
    }
  }, [parsePageFormState]);

  useEffect(() => {
    if (!hasRealPageId || !formRestoredRef.current) return;
    const timeoutId = setTimeout(saveFormState, 1200);
    return () => clearTimeout(timeoutId);
  }, [isolateData, saveFormState, hasRealPageId]);

  const loadPageSamples = useCallback(
    (options = {}) => {
      const { silent = false, initial = false } = options;
      if (!pageData?.id || String(pageData.id).startsWith("default-")) {
        setLoading(false);
        return;
      }

      if (!silent && initial) {
        setLoading(true);
      }
      setError(null);

      getFromOpenElisServer(
        `/rest/notebook/page/${pageData.id}/samples`,
        (response) => {
          if (!componentMounted.current) return;
          if (response && Array.isArray(response)) {
            setSamples(
              response.map((sample) => ({
                id: String(sample.id || sample.sampleItemId),
                externalId: sample.externalId,
                accessionNumber: sample.accessionNumber,
                sampleType:
                  sample.sampleType || sample.typeOfSample?.description,
                collectionDate: sample.collectionDate,
                status: sample.pageStatus || "PENDING",
                hasChildren: sample.hasChildren || false,
                childAliquotCount: sample.childAliquotCount || 0,
                isAliquot: sample.isAliquot || false,
                nestingLevel: sample.nestingLevel || 0,
                parentSampleItemId: sample.parentSampleItemId,
                parentExternalId: sample.parentExternalId,
                isolateTypeFreeText: (() => {
                  try {
                    const metadata = sample.data?.notes
                      ? JSON.parse(sample.data.notes)
                      : null;
                    return metadata?.isolateTypeFreeText || "";
                  } catch {
                    return "";
                  }
                })(),
              })),
            );
            samplesLoadedRef.current = true;
          } else {
            setSamples([]);
          }
          setLoading(false);
        },
      );
    },
    [pageData?.id],
  );

  useEffect(() => {
    componentMounted.current = true;
    loadPageSamples({ initial: !samplesLoadedRef.current });
    return () => {
      componentMounted.current = false;
    };
  }, [entryId, pageData?.id, loadPageSamples]);

  useEffect(() => {
    getFromOpenElisServer(
      "/rest/notebook/bacteriology/sample-types",
      (response) => {
        if (componentMounted.current && response?.sampleTypes) {
          setSampleTypes(response.sampleTypes);
        }
      },
    );
  }, []);

  const getParentSampleType = useCallback(() => {
    if (selectedParentIds.length === 0) return "";
    const first = samples.find((s) => s.id === selectedParentIds[0]);
    return first?.sampleType || "";
  }, [selectedParentIds, samples]);

  const getEffectiveIsolateType = useCallback(() => {
    if (isolateData.isolateType === OTHER_ISOLATE_TYPE) {
      return isolateData.customIsolateType || "";
    }
    return isolateData.isolateType || getParentSampleType();
  }, [
    isolateData.isolateType,
    isolateData.customIsolateType,
    getParentSampleType,
  ]);

  // Default isolate type to parent sample type when parents are selected
  useEffect(() => {
    if (selectedParentIds.length === 0) return;
    const parentType = getParentSampleType();
    if (!parentType) return;
    setIsolateData((prev) => {
      if (prev.isolateType === OTHER_ISOLATE_TYPE) return prev;
      if (!prev.isolateType) {
        return { ...prev, isolateType: parentType };
      }
      return prev;
    });
  }, [selectedParentIds, getParentSampleType]);

  const canCreateIsolates =
    selectedParentIds.length > 0 &&
    Boolean(getEffectiveIsolateType()) &&
    isolateData.numberOfIsolates >= 1 &&
    Boolean(isolateData.externalIdPrefix);

  const handleCreateIsolates = useCallback(() => {
    if (!canCreateIsolates || !hasRealPageId) return;

    if (!notebookId) {
      setError(
        intl.formatMessage({
          id: "notebook.bacteriology.isolate.error.noNotebook",
          defaultMessage: "Notebook ID is required to create isolates.",
        }),
      );
      return;
    }

    setCreating(true);
    setError(null);

    const effectiveIsolateType = getEffectiveIsolateType();
    const isolateMetadata = {
      isolateType: effectiveIsolateType,
      isolateTypeFreeText: isolateData.isolateTypeFreeText,
      parentSampleType: getParentSampleType(),
      createdDate: new Date().toISOString(),
    };

    postToOpenElisServerJsonResponse(
      `/rest/notebook/${notebookId}/samples/create-children`,
      JSON.stringify({
        parentSampleIds: selectedParentIds.map((id) => parseInt(id, 10)),
        childCountPerParent: isolateData.numberOfIsolates,
        externalIdPrefix: isolateData.externalIdPrefix,
        pageId: pageData?.id,
        aliquotData: {
          aliquotType: effectiveIsolateType,
          notes: JSON.stringify(isolateMetadata),
        },
      }),
      (response) => {
        setCreating(false);
        if (response?.success) {
          setSuccess(
            intl.formatMessage(
              {
                id: "notebook.bacteriology.isolate.success.created",
                defaultMessage:
                  "Successfully created {count} isolate(s). Parent-child links established.",
              },
              { count: response.createdCount },
            ),
          );
          setSelectedParentIds([]);
          loadPageSamples({ silent: true });
          onProgressUpdate?.();
        } else {
          setError(
            response?.error ||
              intl.formatMessage({
                id: "notebook.bacteriology.isolate.error.create",
                defaultMessage: "Failed to create isolates.",
              }),
          );
        }
      },
    );
  }, [
    canCreateIsolates,
    hasRealPageId,
    notebookId,
    isolateData,
    pageData?.id,
    intl,
    selectedParentIds,
    getEffectiveIsolateType,
    getParentSampleType,
    loadPageSamples,
    onProgressUpdate,
  ]);

  const handleBulkMarkCompleted = useCallback(() => {
    if (selectedParentIds.length === 0 || !hasRealPageId) return;

    const selectedParentSet = new Set(selectedParentIds.map(String));
    const sampleIds = [
      ...new Set(
        samples
          .filter((s) => {
            const id = String(s.id);
            if (selectedParentSet.has(id)) return true;
            return (
              s.parentSampleItemId != null &&
              selectedParentSet.has(String(s.parentSampleItemId))
            );
          })
          .map((s) => parseInt(s.id, 10))
          .filter((id) => !Number.isNaN(id)),
      ),
    ];

    if (sampleIds.length === 0) return;

    postToOpenElisServer(
      `/rest/notebook/bulk/page/${pageData.id}/samples/status`,
      JSON.stringify({ sampleIds, status: "COMPLETED" }),
      (status) => {
        if (status === 200) {
          setSuccess(
            intl.formatMessage(
              {
                id: "notebook.bacteriology.isolate.success.completed",
                defaultMessage:
                  "Marked {count} sample(s) as processing complete.",
              },
              { count: sampleIds.length },
            ),
          );
          loadPageSamples({ silent: true });
          setSelectedParentIds([]);
          onProgressUpdate?.();
        } else {
          setError(
            intl.formatMessage({
              id: "notebook.bacteriology.isolate.error.status",
              defaultMessage: "Failed to update sample status.",
            }),
          );
        }
      },
    );
  }, [
    selectedParentIds,
    samples,
    pageData?.id,
    hasRealPageId,
    intl,
    loadPageSamples,
    onProgressUpdate,
  ]);

  const parentSamples = samples.filter(
    (s) => !s.isAliquot && s.nestingLevel === 0,
  );
  const completedCount = parentSamples.filter(
    (s) => s.status === "COMPLETED",
  ).length;
  const pendingCount = parentSamples.filter(
    (s) => s.status === "PENDING" || s.status === "IN_PROGRESS",
  ).length;
  const withIsolatesCount = parentSamples.filter(
    (s) => s.hasChildren || s.childAliquotCount > 0,
  ).length;
  const totalIsolatesCreated = parentSamples.reduce(
    (acc, s) => acc + (s.childAliquotCount || 0),
    0,
  );

  const parentType = getParentSampleType();
  const typeSelectValue =
    isolateData.isolateType === OTHER_ISOLATE_TYPE
      ? OTHER_ISOLATE_TYPE
      : isolateData.isolateType || parentType || "";

  return (
    <div className="bacteriology-isolate-creation-page">
      <div className="page-section-header">
        <h4>
          <FormattedMessage
            id="notebook.page.bacteriology.isolateCreation.title"
            defaultMessage="Isolate Creation"
          />
        </h4>
        <p className="page-description">
          <FormattedMessage
            id="notebook.page.bacteriology.isolateCreation.description"
            defaultMessage="Select parent samples, configure isolate details, and create isolates in one place."
          />
        </p>
      </div>

      <Grid fullWidth className="progress-section">
        <Column lg={16} md={8} sm={4}>
          <div className="progress-tiles">
            <Tile className="progress-tile">
              <span className="progress-label">
                <FormattedMessage
                  id="notebook.page.bacteriology.isolateCreation.parentSamples"
                  defaultMessage="Parent Samples"
                />
              </span>
              <span className="progress-value">{parentSamples.length}</span>
            </Tile>
            <Tile className="progress-tile">
              <span className="progress-label">
                <FormattedMessage
                  id="notebook.page.bacteriology.isolateCreation.withIsolates"
                  defaultMessage="With Isolates"
                />
              </span>
              <span className="progress-value">{withIsolatesCount}</span>
            </Tile>
            <Tile className="progress-tile success">
              <span className="progress-label">
                <FormattedMessage
                  id="notebook.page.bacteriology.isolateCreation.totalIsolates"
                  defaultMessage="Total Isolates Created"
                />
              </span>
              <span className="progress-value">{totalIsolatesCreated}</span>
            </Tile>
            <Tile className="progress-tile verified">
              <span className="progress-label">
                <FormattedMessage
                  id="notebook.page.bacteriology.isolateCreation.completed"
                  defaultMessage="Completed"
                />
              </span>
              <span className="progress-value">{completedCount}</span>
            </Tile>
            <Tile className="progress-tile pending">
              <span className="progress-label">
                <FormattedMessage
                  id="notebook.page.bacteriology.isolateCreation.pending"
                  defaultMessage="Pending"
                />
              </span>
              <span className="progress-value">{pendingCount}</span>
            </Tile>
          </div>
        </Column>
      </Grid>

      {error && (
        <InlineNotification
          kind="error"
          title={error}
          lowContrast
          onClose={() => setError(null)}
        />
      )}
      {success && (
        <InlineNotification
          kind="success"
          title={success}
          lowContrast
          onClose={() => setSuccess(null)}
        />
      )}

      {/* Single configuration panel */}
      <Tile style={{ marginBottom: "1rem", padding: "1rem" }}>
        <h5 style={{ marginBottom: "1rem" }}>
          <FormattedMessage
            id="notebook.bacteriology.isolate.configPanel"
            defaultMessage="Isolate Configuration"
          />
        </h5>
        <Grid narrow>
          <Column lg={4} md={4} sm={4}>
            <Select
              id="isolate-type"
              labelText={intl.formatMessage({
                id: "notebook.bacteriology.isolate.type",
                defaultMessage: "Isolate Type",
              })}
              value={typeSelectValue}
              onChange={(e) => {
                const value = e.target.value;
                setIsolateData((prev) => ({
                  ...prev,
                  isolateType: value,
                  ...(value !== OTHER_ISOLATE_TYPE
                    ? { customIsolateType: "" }
                    : {}),
                }));
              }}
            >
              {parentType ? (
                <SelectItem
                  value={parentType}
                  text={intl.formatMessage(
                    {
                      id: "notebook.bacteriology.isolate.type.sameAsParent",
                      defaultMessage: "Same as parent ({type})",
                    },
                    { type: parentType },
                  )}
                />
              ) : (
                <SelectItem
                  value=""
                  text={intl.formatMessage({
                    id: "notebook.bacteriology.isolate.type.selectParentFirst",
                    defaultMessage: "Select a parent sample first",
                  })}
                />
              )}
              <SelectItem
                value={OTHER_ISOLATE_TYPE}
                text={intl.formatMessage({
                  id: "notebook.bacteriology.isolate.type.other",
                  defaultMessage: "Other",
                })}
              />
            </Select>
          </Column>

          {isolateData.isolateType === OTHER_ISOLATE_TYPE && (
            <Column lg={4} md={4} sm={4}>
              <Select
                id="isolate-custom-type"
                labelText={intl.formatMessage({
                  id: "notebook.bacteriology.isolate.customType",
                  defaultMessage: "Sample Type",
                })}
                value={isolateData.customIsolateType || ""}
                onChange={(e) =>
                  setIsolateData((prev) => ({
                    ...prev,
                    customIsolateType: e.target.value,
                  }))
                }
              >
                <SelectItem
                  value=""
                  text={intl.formatMessage({
                    id: "notebook.bacteriology.isolate.customType.placeholder",
                    defaultMessage: "Select sample type...",
                  })}
                />
                {sampleTypes.map((st) => (
                  <SelectItem
                    key={st.id || st.description}
                    value={st.description}
                    text={st.description}
                  />
                ))}
              </Select>
            </Column>
          )}

          <Column lg={4} md={4} sm={4}>
            <TextInput
              id="isolate-description"
              labelText={intl.formatMessage({
                id: "notebook.bacteriology.isolate.typeFreeText",
                defaultMessage: "Description (optional)",
              })}
              placeholder={intl.formatMessage({
                id: "notebook.bacteriology.isolate.typeFreeText.placeholder",
                defaultMessage: "e.g., E. coli Colony 1",
              })}
              value={isolateData.isolateTypeFreeText}
              onChange={(e) =>
                setIsolateData((prev) => ({
                  ...prev,
                  isolateTypeFreeText: e.target.value,
                }))
              }
            />
          </Column>

          <Column lg={4} md={4} sm={4}>
            <NumberInput
              id="isolate-count"
              label={intl.formatMessage({
                id: "notebook.bacteriology.isolate.number",
                defaultMessage: "Number of Isolates",
              })}
              value={isolateData.numberOfIsolates}
              onChange={(e, { value }) =>
                setIsolateData((prev) => ({
                  ...prev,
                  numberOfIsolates: value,
                }))
              }
              min={1}
              max={20}
            />
          </Column>

          <Column lg={4} md={4} sm={4}>
            <TextInput
              id="isolate-prefix"
              labelText={intl.formatMessage({
                id: "notebook.bacteriology.isolate.prefix",
                defaultMessage: "External ID Prefix",
              })}
              value={isolateData.externalIdPrefix}
              onChange={(e) =>
                setIsolateData((prev) => ({
                  ...prev,
                  externalIdPrefix: e.target.value,
                }))
              }
            />
          </Column>
        </Grid>

        <div className="page-actions-bar" style={{ marginTop: "1rem" }}>
          <Button
            kind="primary"
            size="sm"
            renderIcon={Add}
            onClick={handleCreateIsolates}
            disabled={!canCreateIsolates || creating}
          >
            {creating ? (
              <FormattedMessage
                id="notebook.creating"
                defaultMessage="Creating..."
              />
            ) : (
              <FormattedMessage
                id="notebook.page.bacteriology.isolateCreation.createIsolates"
                defaultMessage="Create Isolates ({count} selected)"
                values={{ count: selectedParentIds.length }}
              />
            )}
          </Button>

          {selectedParentIds.length > 0 && (
            <Button
              kind="secondary"
              size="sm"
              renderIcon={Checkmark}
              onClick={handleBulkMarkCompleted}
            >
              <FormattedMessage
                id="notebook.page.bacteriology.isolateCreation.markComplete"
                defaultMessage="Mark Processing Complete ({count})"
                values={{ count: selectedParentIds.length }}
              />
            </Button>
          )}

          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Renew}
            onClick={() => loadPageSamples({ silent: true })}
          >
            <FormattedMessage
              id="notebook.page.bacteriology.isolateCreation.refresh"
              defaultMessage="Refresh"
            />
          </Button>
        </div>
      </Tile>

      <div className="sample-table-section">
        <div className="table-section-header">
          <h5>
            <FormattedMessage
              id="notebook.page.bacteriology.isolateCreation.parentTable.title"
              defaultMessage="Parent Samples"
            />
            <Tag type="gray" className="count-tag">
              {samples.length}
            </Tag>
          </h5>
          <p className="table-section-description">
            <FormattedMessage
              id="notebook.page.bacteriology.isolateCreation.parentTable.description"
              defaultMessage="Select parent samples to create bacterial isolates."
            />
          </p>
        </div>
        <div className="sample-grid-container">
          <SampleGrid
            gridId="bacteriology-isolate-creation"
            samples={samples}
            selectedIds={selectedParentIds}
            onSelectionChange={setSelectedParentIds}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showSelection={true}
            showHierarchy={true}
            loading={loading}
            columns={[
              {
                key: "hierarchy",
                header: intl.formatMessage({
                  id: "notebook.sample.hierarchy",
                  defaultMessage: "Hierarchy",
                }),
                render: (value, sample) => {
                  const nestingLevel = sample.nestingLevel || 0;
                  const hasChildren =
                    sample.hasChildren || sample.childAliquotCount > 0;
                  return (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {nestingLevel > 0 && (
                        <span style={{ marginLeft: `${nestingLevel * 16}px` }}>
                          └─
                        </span>
                      )}
                      <span style={{ marginRight: "4px" }}>
                        {hasChildren ? "📁" : "📄"}
                      </span>
                      {hasChildren && (
                        <span style={{ fontSize: "12px", color: "#525252" }}>
                          ({sample.childAliquotCount || 0})
                        </span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: "externalId",
                header: intl.formatMessage({
                  id: "notebook.grid.externalId",
                  defaultMessage: "External ID",
                }),
              },
              {
                key: "accessionNumber",
                header: intl.formatMessage({
                  id: "notebook.grid.accessionNumber",
                  defaultMessage: "Accession #",
                }),
              },
              {
                key: "sampleType",
                header: intl.formatMessage({
                  id: "notebook.grid.sampleType",
                  defaultMessage: "Sample Type",
                }),
              },
              {
                key: "isolateTypeFreeText",
                header: intl.formatMessage({
                  id: "notebook.bacteriology.grid.isolateType",
                  defaultMessage: "Isolate Type",
                }),
                render: (value) => value || "-",
              },
              {
                key: "status",
                header: intl.formatMessage({
                  id: "notebook.grid.status",
                  defaultMessage: "Status",
                }),
                render: (value) => {
                  const status = value || "PENDING";
                  const tagType =
                    status === "COMPLETED"
                      ? "green"
                      : status === "IN_PROGRESS"
                        ? "blue"
                        : "gray";
                  return <Tag type={tagType}>{status}</Tag>;
                },
              },
            ]}
          />
        </div>
      </div>

      {!loading && samples.length === 0 && (
        <div className="empty-state">
          <p>
            <FormattedMessage
              id="notebook.page.bacteriology.isolateCreation.empty"
              defaultMessage="No samples available for isolate creation. Please complete the previous workflow steps first."
            />
          </p>
        </div>
      )}

      {typeof onNextPage === "function" && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "1rem",
          }}
        >
          <Button kind="primary" onClick={onNextPage}>
            <FormattedMessage id="label.next" defaultMessage="Next" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default BacteriologyIsolateCreationPage;
