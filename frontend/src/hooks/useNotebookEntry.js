import { useState, useEffect, useCallback } from "react";
import { useIntl } from "react-intl";
import { getFromOpenElisServer } from "../components/utils/Utils";
import {
  buildAutoEntryTitle,
  createNotebookEntry,
  fetchEntriesByNotebook,
} from "../components/notebook/notebookEntryApi";

/**
 * Loads notebook + notebook_entry for workflow tabs.
 * When forceNewEntry is true, auto-creates an entry under the instance.
 */
export function useNotebookEntry(
  notebookId,
  propEntryId,
  componentMounted,
  options = {},
) {
  const { forceNewEntry = false } = options;
  const intl = useIntl();

  const [loading, setLoading] = useState(true);
  const [notebook, setNotebook] = useState(null);
  const [entry, setEntry] = useState(null);
  const [entryId, setEntryId] = useState(propEntryId || null);
  const [pages, setPages] = useState([]);
  const [samples, setSamples] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isCreatingEntry, setIsCreatingEntry] = useState(
    !propEntryId || forceNewEntry,
  );
  const [missingEntrySelection, setMissingEntrySelection] = useState(false);

  const loadEntryData = useCallback(
    (eId, options = {}) => {
      const { silent = false } = options;
      let loadCount = 0;
      const checkDone = () => {
        loadCount++;
        if (!silent && loadCount >= 2) {
          setLoading(false);
        }
      };

      setMissingEntrySelection(false);
      setErrorMessage(null);
      if (!silent) {
        setLoading(true);
      }
      setIsCreatingEntry(false);

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
        } else if (componentMounted.current) {
          setErrorMessage("Entry not found");
        }
        checkDone();
      });

      getFromOpenElisServer(
        `/rest/notebook-entry/${eId}/samples`,
        (response) => {
          if (componentMounted.current) {
            setSamples(Array.isArray(response) ? response : []);
          }
          checkDone();
        },
      );
    },
    [componentMounted],
  );

  const createEntryForNotebook = useCallback(
    async (nbId, existingCount) => {
      setIsCreatingEntry(true);
      setMissingEntrySelection(false);
      setErrorMessage(null);

      try {
        const title = buildAutoEntryTitle(existingCount, intl);
        const data = await createNotebookEntry(nbId, title);
        if (!componentMounted.current) {
          return;
        }
        if (data?.id) {
          setEntry(data);
          setEntryId(data.id);
          setSamples([]);
          setIsCreatingEntry(false);

          const url = new URL(window.location.href);
          url.searchParams.set("entryId", String(data.id));
          url.searchParams.delete("newEntry");
          window.history.replaceState({}, "", url.toString());
        } else {
          throw new Error(
            intl.formatMessage({ id: "notebook.createEntry.error.unknown" }),
          );
        }
      } catch (error) {
        if (componentMounted.current) {
          setErrorMessage(error.message);
          setIsCreatingEntry(false);
        }
      } finally {
        if (componentMounted.current) {
          setLoading(false);
        }
      }
    },
    [componentMounted, intl],
  );

  const loadNotebookAndEntry = useCallback(
    (nbId) => {
      setLoading(true);
      setErrorMessage(null);

      getFromOpenElisServer(`/rest/notebook/view/${nbId}`, (nbResponse) => {
        if (!componentMounted.current) {
          return;
        }
        if (!nbResponse) {
          setLoading(false);
          return;
        }

        setNotebook(nbResponse);
        setPages(nbResponse.pages || []);

        if (!forceNewEntry) {
          fetchEntriesByNotebook(nbId)
            .then((entries) => {
              if (!componentMounted.current) {
                return;
              }
              const list = Array.isArray(entries) ? entries : [];
              if (list.length > 0) {
                const chosen =
                  list.length === 1
                    ? list[0]
                    : [...list].sort((a, b) => (b?.id || 0) - (a?.id || 0))[0];
                const url = new URL(window.location.href);
                if (!url.searchParams.get("entryId")) {
                  url.searchParams.set("entryId", String(chosen.id));
                  window.history.replaceState({}, "", url.toString());
                }
                loadEntryData(chosen.id);
                return;
              }
              // No entry exists — auto-create (demo/ethiopia behavior)
              createEntryForNotebook(nbId, 0);
            })
            .catch((error) => {
              if (componentMounted.current) {
                setErrorMessage(error.message);
                setMissingEntrySelection(true);
                setIsCreatingEntry(false);
                setLoading(false);
              }
            });
          return;
        }

        fetchEntriesByNotebook(nbId)
          .then((entries) => {
            if (!componentMounted.current) {
              return;
            }
            createEntryForNotebook(nbId, entries.length);
          })
          .catch((error) => {
            if (componentMounted.current) {
              setErrorMessage(error.message);
              setIsCreatingEntry(false);
              setLoading(false);
            }
          });
      });
    },
    [componentMounted, forceNewEntry, createEntryForNotebook, loadEntryData],
  );

  useEffect(() => {
    if (!notebookId && !propEntryId) {
      setLoading(false);
      return;
    }

    if (propEntryId) {
      loadEntryData(propEntryId);
    } else if (notebookId) {
      loadNotebookAndEntry(notebookId);
    }
  }, [
    notebookId,
    propEntryId,
    forceNewEntry,
    loadEntryData,
    loadNotebookAndEntry,
  ]);

  const refreshSamples = useCallback(() => {
    if (!entryId) {
      return;
    }
    getFromOpenElisServer(
      `/rest/notebook-entry/${entryId}/samples`,
      (response) => {
        if (componentMounted.current) {
          setSamples(Array.isArray(response) ? response : []);
        }
      },
    );
  }, [entryId, componentMounted]);

  return {
    loading,
    notebook,
    entry,
    entryId,
    pages,
    setPages,
    samples,
    setSamples,
    errorMessage,
    isCreatingEntry,
    missingEntrySelection,
    refreshSamples,
    loadEntryData,
  };
}
