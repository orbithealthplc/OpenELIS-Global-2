/**
 * Shared helpers for Biorepository storage assignment display and API response handling.
 */

import { formatBrf02SamplePath } from "./biorepositorySamplePathHelpers";
import {
  formatBiorepositoryUserText,
  normalizeBiorepositoryHierarchyPath,
} from "./biorepositoryDisplayHelpers";
import {
  getFromOpenElisServer,
  postToOpenElisServerJsonResponse,
  putToOpenElisServerJsonResponse,
} from "../../../utils/Utils";

const STORAGE_LOCATION_KEYS = [
  "storageWell",
  "storagePath",
  "storageRoom",
  "storageFreezer",
  "storageShelf",
  "storageRack",
  "storageBox",
];

const readField = (sample, key) => sample?.data?.[key] ?? sample?.[key] ?? null;

export const hasStorageLocation = (sample) =>
  STORAGE_LOCATION_KEYS.some((key) => {
    const value = readField(sample, key);
    return value !== null && value !== undefined && String(value).trim() !== "";
  });

export const deriveStoragePageStatus = (sample) => {
  const rawStatus = sample?.pageStatus || sample?.status || "PENDING";

  if (rawStatus === "COMPLETED" || rawStatus === "SKIPPED") {
    return rawStatus;
  }

  return hasStorageLocation(sample) ? "IN_PROGRESS" : rawStatus;
};

export const getStorageLocationLabel = (sample) => {
  const formattedPath = formatBrf02SamplePath(sample);
  if (formattedPath) {
    return formattedPath;
  }

  const well = readField(sample, "storageWell");
  const path = formatBiorepositoryUserText(
    normalizeBiorepositoryHierarchyPath(readField(sample, "storagePath")),
  );

  if (well && path) {
    return `${path} (${well})`;
  }
  return well || path || null;
};

export function buildBiorepositoryStorageUrl(basePath, notebookId) {
  if (!notebookId) {
    return basePath;
  }
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}biorepositoryOnly=true&notebookId=${encodeURIComponent(notebookId)}`;
}

const normalizePageKey = (page) =>
  String(page?.pageKey || page?.pageId || "")
    .trim()
    .toLowerCase();

const normalizePageTitle = (page) =>
  String(page?.title || "")
    .trim()
    .toLowerCase();

const readPageOrder = (page) =>
  Number(page?.pageOrder ?? page?.order ?? Number.NaN);

/**
 * Resolve the Storage Assignment notebook page (matches backend SampleTransferRestController).
 */
export const findStorageAssignmentPage = (pages = []) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return null;
  }

  const byKey = pages.find(
    (page) => normalizePageKey(page) === "storage_assign",
  );
  if (byKey) {
    return byKey;
  }

  const byTitle = pages.find((page) =>
    normalizePageTitle(page).includes("storage assignment"),
  );
  if (byTitle) {
    return byTitle;
  }

  return pages.find((page) => readPageOrder(page) === 2) || null;
};

/**
 * Promise wrapper for JSON POST helpers used in advance-to-storage flow.
 */
export const postJsonResponse = (endpoint, payload) =>
  new Promise((resolve) => {
    postToOpenElisServerJsonResponse(
      endpoint,
      JSON.stringify(payload),
      (response) => resolve(response),
    );
  });

export const putJsonResponse = (endpoint, payload) =>
  new Promise((resolve) => {
    putToOpenElisServerJsonResponse(
      endpoint,
      JSON.stringify(payload),
      (response) => resolve(response),
    );
  });

export const getJson = (endpoint) =>
  new Promise((resolve) => {
    getFromOpenElisServer(endpoint, (response) => resolve(response));
  });

export const PAGE_SAMPLES_BATCH_SIZE = 500;
export const ADVANCE_TO_STORAGE_BATCH_SIZE = 250;

export const normalizePageSampleResponse = (response) => {
  if (response?.error && !Array.isArray(response?.samples)) {
    throw new Error(String(response.error));
  }

  if (Array.isArray(response)) {
    return {
      samples: response,
      totalCount: response.length,
      offset: 0,
      limit: response.length,
    };
  }

  if (response && Array.isArray(response.samples)) {
    return {
      samples: response.samples,
      totalCount: Number(response.totalCount ?? response.samples.length),
      offset: Number(response.offset ?? 0),
      limit: Number(response.limit ?? response.samples.length),
    };
  }

  return null;
};

export const fetchPageSamplesBatch = async (
  pageId,
  offset = 0,
  limit = PAGE_SAMPLES_BATCH_SIZE,
  status = null,
) => {
  let url = `/rest/notebook/page/${pageId}/samples?offset=${offset}&limit=${limit}`;
  if (status && status !== "ALL") {
    url += `&status=${encodeURIComponent(status)}`;
  }

  const response = await getJson(url);
  return normalizePageSampleResponse(response);
};

/**
 * Load all samples for a notebook page using the paginated API (500 per batch).
 */
export const fetchAllPageSamples = async (
  pageId,
  { status = null, onProgress } = {},
) => {
  const allSamples = [];
  let offset = 0;
  let totalCount = 0;

  do {
    const batch = await fetchPageSamplesBatch(
      pageId,
      offset,
      PAGE_SAMPLES_BATCH_SIZE,
      status,
    );
    if (!batch) {
      throw new Error("Failed to load page samples");
    }

    totalCount = batch.totalCount;
    allSamples.push(...batch.samples);

    if (onProgress) {
      onProgress({ loaded: allSamples.length, total: totalCount });
    }

    if (allSamples.length >= totalCount || batch.samples.length === 0) {
      break;
    }

    offset += batch.samples.length;
  } while (allSamples.length < totalCount);

  return { samples: allSamples, totalCount };
};

/**
 * Advance sample item IDs to Storage Assignment in batches (handles 1000+ samples).
 */
export const advanceSamplesToStorageBatched = async (
  storagePageId,
  sampleItemIds,
  { batchSize = ADVANCE_TO_STORAGE_BATCH_SIZE, onProgress } = {},
) => {
  const ids = [...sampleItemIds];
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalRetentionUpdated = 0;
  const errors = [];

  for (let index = 0; index < ids.length; index += batchSize) {
    const chunk = ids.slice(index, index + batchSize);

    const addResponse = await postJsonResponse(
      `/rest/notebook/bulk/page/${storagePageId}/samples/add`,
      { sampleIds: chunk },
    );

    if (!addResponse?.success) {
      errors.push(
        addResponse?.error || `Failed to add batch at offset ${index}`,
      );
      continue;
    }

    totalAdded += Number(addResponse.addedCount ?? 0);

    const statusResponse = await putJsonResponse(
      `/rest/biorepository/sample/workflow-status`,
      {
        sampleItemIds: chunk,
        workflowStatus: "PENDING_STORAGE",
      },
    );

    if (!statusResponse?.success) {
      errors.push(
        statusResponse?.error ||
          `Workflow status update failed for batch at offset ${index}`,
      );
      continue;
    }

    totalUpdated += Number(statusResponse.updatedCount ?? 0);

    const retentionResponse = await postJsonResponse(
      `/rest/biorepository/sample/calculate-retention`,
      { sampleItemIds: chunk },
    );
    totalRetentionUpdated += Number(retentionResponse?.updatedCount ?? 0);

    if (onProgress) {
      onProgress({
        processed: Math.min(index + chunk.length, ids.length),
        total: ids.length,
      });
    }
  }

  return {
    requestedCount: ids.length,
    addedCount: totalAdded,
    updatedCount: totalUpdated,
    retentionUpdated: totalRetentionUpdated,
    errors,
    success: errors.length === 0 && totalUpdated > 0,
  };
};

/**
 * Interpret bulk storage assignment API response without treating zero assignments as success.
 */
export const interpretStorageAssignmentResponse = (
  response,
  requestedCount = 0,
) => {
  const assignedCount = Number(response?.assignedCount ?? 0);
  const errors = Array.isArray(response?.errors) ? response.errors : [];
  const success = Boolean(response?.success) && assignedCount > 0;

  return {
    assignedCount,
    requestedCount: Number(response?.requestedCount ?? requestedCount),
    errors,
    success,
    errorMessage:
      response?.error ||
      (errors.length > 0 ? errors.join("; ") : null) ||
      (assignedCount === 0
        ? "No samples were assigned to storage. Verify the sample is on this page and the location is available."
        : null),
  };
};
