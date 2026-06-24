import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Loading,
  Grid,
  Column,
  Tag,
  Button,
  InlineNotification,
} from "@carbon/react";
import { Renew } from "@carbon/react/icons";
import { FormattedMessage, useIntl } from "react-intl";
import { usePageAccessControl } from "../../../hooks/usePageAccessControl";
import { useNotebookEntry } from "../../../hooks/useNotebookEntry";
import config from "../../../config.json";
import { NotificationContext } from "../../layout/Layout";
import PageNavigation from "./PageNavigation";
import {
  BacteriologySampleReceptionPage,
  BacteriologyReceptionVerificationPage,
  BacteriologyTemporaryStoragePage,
  BacteriologyIsolateCreationPage,
  BacteriologyProcessingQCPage,
  BacteriologyAssayTestExecutionPage,
  BacteriologyPostAnalysisPage,
  BacteriologySampleRetrievalDisposalPage,
  BacteriologyReportingDataExportPage,
} from "../pages/bacteriology";
import "./NotebookWorkflow.css";

/**
 * Default workflow pages for Bacteriology workflow.
 * Page 1: Sample Reception (Manifest Import)
 * Page 2: Laboratory Reception & Verification (QC Assessment)
 * Page 1: Sample Reception (Manifest Import)
 * Page 2: Laboratory Reception & Verification (QC Assessment)
 * Page 3: Temporary Storage Assignment
 * Page 4: Processing & Quality Control
 * Page 5: Assay/Test Execution
 * Page 6: Isolate Creation
 * Page 7: Post-Analysis Storage
 * Page 8: Sample Retrieval, Archival & Disposal
 * Page 9: Reporting & Data Export
 */
const DEFAULT_BACTERIOLOGY_WORKFLOW_PAGES = [
  { id: "default-1", order: 1, title: "Sample Reception" },
  { id: "default-2", order: 2, title: "Laboratory Reception & Verification" },
  { id: "default-3", order: 3, title: "Temporary Storage Assignment" },
  { id: "default-4", order: 4, title: "Processing & Quality Control" },
  { id: "default-5", order: 5, title: "Assay/Test Execution" },
  { id: "default-6", order: 6, title: "Isolate Creation" },
  { id: "default-7", order: 7, title: "Post-Analysis Storage" },
  { id: "default-8", order: 8, title: "Sample Retrieval, Archival & Disposal" },
  { id: "default-9", order: 9, title: "Reporting & Data Export" },
];

/**
 * BacteriologyWorkflowTab - Container component for Bacteriology workflow pages.
 * Displays the Bacteriology-specific workflow with progress indicators and navigation.
 *
 * Sample Categories Supported:
 * - Clinical Samples (Human): Blood, Urine, Stool, Body Fluids, etc.
 * - Environmental Samples: Wastewater, Tap Water, Soil, etc.
 * - Food/Beverage Samples: Vegetables, Dairy Products, Poultry, etc.
 * - Veterinary Samples: Animal Stool, Animal Tissue, etc.
 *
 * @param {Object} props
 * @param {number} props.notebookId - The notebook template ID (will auto-create entry if needed)
 * @param {number} props.entryId - The notebook entry ID (direct entry access)
 * @param {boolean} props.forceNewEntry - When true, create a new notebook_entry on load
 */
function BacteriologyWorkflowTab({
  notebookId,
  entryId: propEntryId,
  forceNewEntry = false,
}) {
  const componentMounted = useRef(false);
  const intl = useIntl();
  const { notificationVisible, setNotificationVisible } =
    useContext(NotificationContext);

  const {
    loading,
    notebook,
    entry,
    entryId,
    pages,
    samples,
    errorMessage,
    isCreatingEntry,
    refreshSamples,
    loadEntryData,
  } = useNotebookEntry(notebookId, propEntryId, componentMounted, {
    forceNewEntry,
  });

  const [pageProgress, setPageProgress] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const { effectivePages, activePage, setActivePage, handlePageChange } =
    usePageAccessControl(pages, DEFAULT_BACTERIOLOGY_WORKFLOW_PAGES, 0, {
      isCreating: isCreatingEntry,
      workflowType: "bacteriology",
    });

  useEffect(() => {
    componentMounted.current = true;
    return () => {
      componentMounted.current = false;
    };
  }, []);

  const loadPageProgress = useCallback(() => {
    if (!entryId || !effectivePages || effectivePages.length === 0) {
      return;
    }

    const realPages = effectivePages.filter(
      (p) => p?.id && !String(p.id).startsWith("default-"),
    );

    if (realPages.length === 0) {
      return;
    }

    Promise.all(
      realPages.map((p) =>
        fetch(
          `${config.serverBaseUrl}/rest/notebook/bulk/page/${p.id}/progress`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": localStorage.getItem("CSRF"),
            },
          },
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => ({ pageId: p.id, data }))
          .catch(() => ({ pageId: p.id, data: null })),
      ),
    ).then((results) => {
      if (!componentMounted.current) return;
      setPageProgress((prev) => {
        const next = { ...prev };
        results.forEach(({ pageId, data }) => {
          if (!data) return;
          const total = Number(data.total || 0);
          const completed =
            Number(data.completed || 0) + Number(data.skipped || 0);
          const inProgress = Number(data.inProgress || 0);
          const percentage =
            typeof data.percentage === "number"
              ? data.percentage
              : total > 0
                ? Math.round((completed / total) * 100)
                : 0;
          next[pageId] = { total, completed, inProgress, percentage };
        });
        return next;
      });
    });
  }, [entryId, effectivePages]);

  const getProgressForPage = (pageId) => {
    const progress = pageProgress[pageId];
    if (!progress) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    return progress;
  };

  const handleProgressUpdate = useCallback(() => {
    refreshSamples();
    loadPageProgress();
    if (entryId) {
      loadEntryData(entryId, { silent: true });
    }
  }, [refreshSamples, loadPageProgress, loadEntryData, entryId]);

  useEffect(() => {
    loadPageProgress();
  }, [loadPageProgress]);

  const goToNextAccessiblePage = useCallback(() => {
    if (!effectivePages || effectivePages.length === 0) return;
    for (let i = activePage + 1; i < effectivePages.length; i++) {
      if (effectivePages[i]?.hasAccess) {
        setActivePage(i);
        return;
      }
    }
  }, [activePage, effectivePages, setActivePage]);

  // Sync pages from template to instance (adds missing pages)
  const handleSyncPages = useCallback(() => {
    if (!entryId) return;

    setSyncing(true);
    setSyncMessage(null);

    fetch(`${config.serverBaseUrl}/rest/notebook-entry/${entryId}/sync-pages`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": localStorage.getItem("CSRF"),
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (componentMounted.current) {
          if (data.success) {
            if (data.pagesAdded > 0) {
              setSyncMessage({
                kind: "success",
                text: intl.formatMessage(
                  {
                    id: "notebook.workflow.syncSuccess",
                    defaultMessage:
                      "{count} new page(s) added from template. Refreshing...",
                  },
                  { count: data.pagesAdded },
                ),
              });
              // Reload the notebook data to get new pages
              setTimeout(() => {
                if (entryId) {
                  loadEntryData(entryId);
                }
                setSyncMessage(null);
              }, 1500);
            } else {
              setSyncMessage({
                kind: "info",
                text: intl.formatMessage({
                  id: "notebook.workflow.syncNoChanges",
                  defaultMessage:
                    "All pages are already in sync with the template.",
                }),
              });
              setTimeout(() => setSyncMessage(null), 3000);
            }
          } else {
            setSyncMessage({
              kind: "error",
              text: data.error || "Sync failed",
            });
          }
        }
      })
      .catch((error) => {
        console.error("Sync pages error:", error);
        if (componentMounted.current) {
          setSyncMessage({
            kind: "error",
            text: error.message || "Failed to sync pages",
          });
        }
      })
      .finally(() => {
        if (componentMounted.current) {
          setSyncing(false);
        }
      });
  }, [entryId, intl, loadEntryData]);

  // Render Bacteriology page-specific content based on page order
  const renderPageContent = (page) => {
    const pageOrder = page.order || page.pageOrder || 1;
    const progress = getProgressForPage(page.id);

    switch (pageOrder) {
      case 1:
        // Page 1: Sample Reception (Manifest Import)
        return (
          <BacteriologySampleReceptionPage
            key={`reception-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 2:
        // Page 2: Laboratory Reception & Verification (QC Assessment)
        return (
          <BacteriologyReceptionVerificationPage
            key={`verification-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 3:
        // Page 3: Temporary Storage Assignment
        return (
          <BacteriologyTemporaryStoragePage
            key={`storage-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 4:
        // Page 4: Processing & Quality Control
        return (
          <BacteriologyProcessingQCPage
            key={`processing-qc-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 5:
        // Page 5: Assay/Test Execution
        return (
          <BacteriologyAssayTestExecutionPage
            key={`assay-execution-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 6:
        // Page 6: Isolate Creation
        return (
          <BacteriologyIsolateCreationPage
            key={`isolate-creation-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 7:
        // Page 7: Post-Analysis Storage
        return (
          <BacteriologyPostAnalysisPage
            key={`post-analysis-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 8:
        // Page 8: Sample Retrieval, Archival & Disposal
        return (
          <BacteriologySampleRetrievalDisposalPage
            key={`retrieval-disposal-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      case 9:
        // Page 9: Reporting & Data Export
        return (
          <BacteriologyReportingDataExportPage
            key={`reporting-export-${page.id}`}
            entryId={entryId}
            pageData={page}
            progress={progress}
            onProgressUpdate={handleProgressUpdate}
            onNextPage={goToNextAccessiblePage}
            notebookId={notebook?.id}
          />
        );
      default:
        return (
          <div className="page-placeholder">
            <FormattedMessage
              id="notebook.workflow.pageDefault.description"
              defaultMessage="Page content for workflow step {step}"
              values={{ step: pageOrder }}
            />
          </div>
        );
    }
  };

  if (loading || isCreatingEntry) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <Loading
          withOverlay={false}
          description="Loading Bacteriology workflow..."
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
    <div className="notebook-workflow-container bacteriology-workflow">
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4}>
          <div className="workflow-header">
            <h2>{displayTitle}</h2>
            <div className="workflow-meta">
              <Tag type="green">Bacteriology</Tag>
              <Tag type="blue">{displayStatus}</Tag>
              <span className="sample-count">
                <FormattedMessage
                  id="notebook.workflow.sampleCount"
                  values={{ count: samples.length }}
                />
              </span>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Renew}
                onClick={handleSyncPages}
                disabled={syncing || !entryId}
                style={{ marginLeft: "1rem" }}
              >
                {syncing ? (
                  <FormattedMessage
                    id="notebook.workflow.syncing"
                    defaultMessage="Syncing..."
                  />
                ) : (
                  <FormattedMessage
                    id="notebook.workflow.syncPages"
                    defaultMessage="Sync Pages"
                  />
                )}
              </Button>
            </div>
          </div>
          {syncMessage && (
            <InlineNotification
              kind={syncMessage.kind}
              title=""
              subtitle={syncMessage.text}
              lowContrast
              onCloseButtonClick={() => setSyncMessage(null)}
              style={{ marginTop: "0.5rem" }}
            />
          )}
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
                        {effectivePages[activePage].instructions}
                      </div>
                    )}

                    <div key={`page-content-${effectivePages[activePage].id}`}>
                      {renderPageContent(effectivePages[activePage])}
                    </div>
                  </div>
                </div>
              )}
            {/* Show access denied message if current page is restricted */}
            {effectivePages.length > 0 &&
              effectivePages[activePage] &&
              !effectivePages[activePage].hasAccess && (
                <div className="page-panel access-denied">
                  <div className="page-header">
                    <h3>{effectivePages[activePage].title}</h3>
                    <Tag type="red">
                      <FormattedMessage
                        id="notebook.page.restricted"
                        defaultMessage="Restricted"
                      />
                    </Tag>
                  </div>
                  <div className="page-content">
                    <p>
                      <FormattedMessage
                        id="notebook.page.accessDeniedMessage"
                        defaultMessage="You do not have the required role to access this page."
                      />
                    </p>
                  </div>
                </div>
              )}
          </div>
        </Column>
      </Grid>
    </div>
  );
}

export default BacteriologyWorkflowTab;
