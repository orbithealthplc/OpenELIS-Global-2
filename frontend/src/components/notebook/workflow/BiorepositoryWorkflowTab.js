import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Loading, Grid, Column, Tag } from "@carbon/react";
import { FormattedMessage, useIntl } from "react-intl";
import { getFromOpenElisServer } from "../../utils/Utils";
import config from "../../../config.json";
import { NotificationContext } from "../../layout/Layout";
import PageNavigation from "./PageNavigation";
import { usePageAccessControl } from "../../../hooks/usePageAccessControl";
import {
  findRegistryStage,
  getRegistryStages,
  resolvePageKey,
} from "../../../constants/ahriWorkflowRegistry";
import { formatBiorepositoryPageInstructions } from "../pages/biorepository/biorepositoryDisplayHelpers";
import {
  BiorepositoryIntakePage,
  BiorepositoryStorageAssignmentPage,
  BiorepositoryEnvironmentalMonitoringPage,
  BiorepositorySampleRequestPage,
  BiorepositoryQCInspectionPage,
  BiorepositoryRetentionDisposalPage,
  BiorepositoryReportingPage,
} from "../pages/biorepository";
import "./NotebookWorkflow.css";

const BIOREPOSITORY_PAGE_KEY_BY_TITLE = {
  "Sample Intake & Registration": "intake",
  "Storage Assignment": "storage_assign",
  "Ongoing Storage and Monitoring": "monitoring",
  "Sample Request & Retrieval": "request",
  "QC Inspection": "qc",
  "Reporting & Audit": "reporting",
  "Retention & Disposal": "retention",
};

function resolveBiorepositoryPageKey(page) {
  if (!page) {
    return "";
  }
  if (page.pageKey && !String(page.pageKey).startsWith("stage-")) {
    return page.pageKey;
  }
  if (page.title && BIOREPOSITORY_PAGE_KEY_BY_TITLE[page.title]) {
    return BIOREPOSITORY_PAGE_KEY_BY_TITLE[page.title];
  }
  const stage = findRegistryStage("biorepository", page);
  return stage?.pageKey || resolvePageKey(page);
}

function normalizeBiorepositoryPages(sourcePages) {
  const stageByKey = Object.fromEntries(
    getRegistryStages("biorepository").map((stage) => [stage.pageKey, stage]),
  );

  return [...sourcePages]
    .map((page) => {
      const pageKey = resolveBiorepositoryPageKey(page);
      const stage = stageByKey[pageKey];
      const stageOrder = stage?.stageOrder ?? page.pageOrder ?? page.order;

      return {
        ...page,
        pageKey,
        title: stage?.stageTitle || page.title,
        order: stageOrder,
        pageOrder: stageOrder,
      };
    })
    .sort((a, b) => {
      const orderA = a.pageOrder ?? a.order ?? 0;
      const orderB = b.pageOrder ?? b.order ?? 0;
      return orderA - orderB;
    });
}

/**
 * Default workflow pages for Biorepository workflow.
 * Page 1: Sample Intake & Registration (4 sub-stages)
 * Page 2: Storage Assignment
 * Page 3: Ongoing Storage and Monitoring
 * Page 4: Sample Request & Retrieval
 * Page 5: QC Inspection
 * Page 6: Reporting & Audit
 * Page 7: Retention & Disposal (end of lifecycle)
 */
const DEFAULT_BIOREPOSITORY_WORKFLOW_PAGES = [
  {
    id: "default-1",
    order: 1,
    pageKey: "intake",
    title: "Sample Intake & Registration",
  },
  {
    id: "default-2",
    order: 2,
    pageKey: "storage_assign",
    title: "Storage Assignment",
  },
  {
    id: "default-3",
    order: 3,
    pageKey: "monitoring",
    title: "Ongoing Storage and Monitoring",
  },
  {
    id: "default-4",
    order: 4,
    pageKey: "request",
    title: "Sample Request & Retrieval",
  },
  { id: "default-5", order: 5, pageKey: "qc", title: "QC Inspection" },
  {
    id: "default-6",
    order: 6,
    pageKey: "reporting",
    title: "Reporting & Audit",
  },
  {
    id: "default-7",
    order: 7,
    pageKey: "retention",
    title: "Retention & Disposal",
  },
];

/**
 * BiorepositoryWorkflowTab - Container component for Biorepository Laboratory workflow pages.
 * Displays the Biorepository-specific workflow with progress indicators and navigation.
 * ISO 20387:2018 compliant sample lifecycle management.
 *
 * @param {Object} props
 * @param {number} props.notebookId - The notebook template ID (will auto-create entry if needed)
 * @param {number} props.entryId - The notebook entry ID (direct entry access)
 */
function BiorepositoryWorkflowTab({ notebookId, entryId: propEntryId }) {
  const componentMounted = useRef(false);
  const intl = useIntl();
  const { notificationVisible, setNotificationVisible } =
    useContext(NotificationContext);

  const [loading, setLoading] = useState(true);
  const [notebook, setNotebook] = useState(null);
  const [entry, setEntry] = useState(null);
  const [entryId, setEntryId] = useState(propEntryId);
  const [pages, setPages] = useState([]);
  const [pageProgress, setPageProgress] = useState({});
  const [samples, setSamples] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isCreatingEntry, setIsCreatingEntry] = useState(!propEntryId);

  const sortedPages = useMemo(() => {
    if (!pages || pages.length === 0) {
      return [];
    }
    return normalizeBiorepositoryPages(pages);
  }, [pages]);

  const { effectivePages, activePage, handlePageChange } = usePageAccessControl(
    sortedPages,
    DEFAULT_BIOREPOSITORY_WORKFLOW_PAGES,
    0,
    { isCreating: isCreatingEntry, workflowType: "biorepository" },
  );

  useEffect(() => {
    componentMounted.current = true;
    loadNotebookData();

    return () => {
      componentMounted.current = false;
    };
  }, [notebookId, propEntryId]);

  const loadNotebookData = () => {
    if (!notebookId && !propEntryId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (propEntryId) {
      loadEntryData(propEntryId);
    } else if (notebookId) {
      loadNotebookAndEntry(notebookId);
    }
  };

  const loadEntryData = (eId) => {
    let loadCount = 0;
    const checkDone = () => {
      loadCount++;
      if (loadCount >= 2) {
        setLoading(false);
      }
    };

    getFromOpenElisServer(`/rest/notebook-entry/${eId}`, (response) => {
      if (componentMounted.current && response) {
        setEntry(response);
        setEntryId(eId);
        if (response.notebook) {
          setNotebook(response.notebook);
          getFromOpenElisServer(
            `/rest/notebook/view/${response.notebook.id}`,
            (nbResponse) => {
              if (componentMounted.current && nbResponse) {
                setPages(nbResponse.pages || []);
              }
            },
          );
        }
      }
      checkDone();
    });

    getFromOpenElisServer(`/rest/notebook-entry/${eId}/samples`, (response) => {
      if (componentMounted.current && response) {
        setSamples(response || []);
      }
      checkDone();
    });
  };

  const loadNotebookAndEntry = (nbId) => {
    getFromOpenElisServer(`/rest/notebook/view/${nbId}`, (nbResponse) => {
      if (componentMounted.current && nbResponse) {
        setNotebook(nbResponse);
        setPages(nbResponse.pages || []);

        getFromOpenElisServer(
          `/rest/notebook-entry/by-notebook/${nbId}`,
          (entriesResponse) => {
            if (componentMounted.current) {
              if (
                entriesResponse &&
                Array.isArray(entriesResponse) &&
                entriesResponse.length > 0
              ) {
                const existingEntry = entriesResponse[0];
                setEntry(existingEntry);
                setEntryId(existingEntry.id);
                setIsCreatingEntry(false);

                getFromOpenElisServer(
                  `/rest/notebook-entry/${existingEntry.id}/samples`,
                  (samplesResponse) => {
                    if (componentMounted.current) {
                      setSamples(
                        Array.isArray(samplesResponse) ? samplesResponse : [],
                      );
                    }
                    setLoading(false);
                  },
                );
              } else {
                setIsCreatingEntry(true);
                createEntryForNotebook(nbId);
              }
            }
          },
        );
      } else {
        setLoading(false);
      }
    });
  };

  const createEntryForNotebook = (nbId) => {
    fetch(
      `${config.serverBaseUrl}/rest/notebook-entry/create?notebookId=${nbId}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": localStorage.getItem("CSRF"),
        },
      },
    )
      .then(async (response) => {
        const text = await response.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error("Failed to parse response as JSON:", e);
        }
        if (!response.ok) {
          const errorMsg =
            data.error || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMsg);
        }
        return data;
      })
      .then((data) => {
        if (componentMounted.current) {
          if (data && data.id) {
            setEntry(data);
            setEntryId(data.id);
            setSamples([]);
            setIsCreatingEntry(false);
          } else if (data && data.error) {
            console.error("Entry creation error:", data.error);
          }
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Failed to create notebook entry:", error.message);
        if (componentMounted.current) {
          setErrorMessage(error.message);
          setLoading(false);
        }
      });
  };

  const getProgressForPage = (pageId) => {
    const progress = pageProgress[pageId];
    if (!progress) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    return progress;
  };

  const handleProgressUpdate = useCallback(() => {
    if (entryId) {
      getFromOpenElisServer(
        `/rest/notebook-entry/${entryId}/samples`,
        (response) => {
          if (componentMounted.current && response) {
            setSamples(response || []);
          }
        },
      );
    }
  }, [entryId]);

  // Render Biorepository page-specific content based on stable page key/title
  const renderPageContent = (page) => {
    const pageKey = resolveBiorepositoryPageKey(page);
    const progress = getProgressForPage(page.id);

    switch (pageKey) {
      case "intake":
        return (
          <BiorepositoryIntakePage
            key={`intake-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            notebookId={notebook?.id}
          />
        );
      case "storage_assign":
        return (
          <BiorepositoryStorageAssignmentPage
            key={`storage-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            notebookId={notebook?.id}
          />
        );
      case "monitoring":
        return (
          <BiorepositoryEnvironmentalMonitoringPage
            key={`environmental-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            notebookId={notebook?.id}
          />
        );
      case "request":
        return (
          <BiorepositorySampleRequestPage
            key={`request-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            notebookId={notebook?.id}
          />
        );
      case "qc":
        return (
          <BiorepositoryQCInspectionPage
            key={`qc-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            notebookId={notebook?.id}
          />
        );
      case "reporting":
        return (
          <BiorepositoryReportingPage
            key={`reporting-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            notebookId={notebook?.id}
          />
        );
      case "retention":
        return (
          <BiorepositoryRetentionDisposalPage
            key={`disposal-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            notebookId={notebook?.id}
          />
        );
      default:
        return (
          <div className="page-placeholder">
            <FormattedMessage
              id="notebook.workflow.pageDefault.description"
              defaultMessage="Page content for workflow step {step}"
              values={{ step: page.title || pageKey || "unknown" }}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <Loading
          withOverlay={false}
          description={intl.formatMessage({
            id: "biorepository.workflow.loading",
            defaultMessage: "Loading Biorepository workflow...",
          })}
        />
      </div>
    );
  }

  if (!entry && !notebook) {
    return (
      <div
        className="workflow-error"
        style={{ padding: "2rem", color: "#525252" }}
      >
        <FormattedMessage
          id="notebook.workflow.notFound"
          defaultMessage="Notebook not found. Please select a valid notebook."
        />
      </div>
    );
  }

  if (notebook && !entryId) {
    return (
      <div
        className="workflow-error"
        style={{ padding: "2rem", color: "#525252" }}
      >
        <FormattedMessage
          id="notebook.workflow.entryCreationFailed"
          defaultMessage="Failed to create notebook entry. Please refresh and try again."
        />
        {errorMessage && (
          <div
            style={{
              marginTop: "1rem",
              fontSize: "0.875rem",
              color: "#da1e28",
            }}
          >
            Error: {errorMessage}
          </div>
        )}
      </div>
    );
  }

  const displayTitle = entry?.title || notebook?.title;
  const displayStatus = entry?.status || notebook?.status;

  return (
    <div className="notebook-workflow-container biorepository-workflow">
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4}>
          <div className="workflow-header">
            <h2>{displayTitle}</h2>
            <div className="workflow-meta">
              <Tag type="purple">
                <FormattedMessage
                  id="biorepository.workflow.tag"
                  defaultMessage="Biorepository"
                />
              </Tag>
              <Tag type="blue">{displayStatus}</Tag>
              <span className="sample-count">
                <FormattedMessage
                  id="notebook.workflow.sampleCount"
                  values={{ count: samples.length }}
                />
              </span>
            </div>
          </div>
        </Column>
      </Grid>

      <Grid fullWidth className="workflow-content">
        <Column lg={4} md={2} sm={4}>
          <PageNavigation
            pages={effectivePages}
            activePage={activePage}
            onPageChange={handlePageChange}
            pageProgress={pageProgress}
          />
        </Column>

        <Column lg={12} md={6} sm={4}>
          <div className="workflow-page-content">
            {effectivePages.length > 0 &&
              effectivePages[activePage] &&
              effectivePages[activePage].hasAccess && (
                <div className="page-panel">
                  <div className="page-header">
                    <h3>{effectivePages[activePage].title}</h3>
                    <div className="page-progress">
                      {(() => {
                        const progress = getProgressForPage(
                          effectivePages[activePage].id,
                        );
                        return (
                          <span>
                            {progress.completed}/{progress.total}{" "}
                            <FormattedMessage id="notebook.workflow.samplesCompleted" />
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="page-content">
                    {effectivePages[activePage].instructions && (
                      <div className="page-instructions">
                        {formatBiorepositoryPageInstructions(
                          effectivePages[activePage].instructions,
                          resolveBiorepositoryPageKey(
                            effectivePages[activePage],
                          ),
                        )}
                      </div>
                    )}

                    <div key={`page-content-${effectivePages[activePage].id}`}>
                      {renderPageContent(effectivePages[activePage])}
                    </div>
                  </div>
                </div>
              )}
            {effectivePages.length > 0 &&
              effectivePages[activePage] &&
              !effectivePages[activePage].hasAccess && (
                <div className="page-panel access-denied">
                  <h3>{effectivePages[activePage].title}</h3>
                  <p>
                    <FormattedMessage
                      id="notebook.page.restricted"
                      defaultMessage="Restricted"
                    />
                  </p>
                  <p>
                    <FormattedMessage
                      id="notebook.page.accessDenied"
                      defaultMessage="You don't have the required role to access this page"
                    />
                  </p>
                </div>
              )}
          </div>
        </Column>
      </Grid>
    </div>
  );
}

export default BiorepositoryWorkflowTab;
