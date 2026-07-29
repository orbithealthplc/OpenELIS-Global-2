/**
 * Helpers for MNTD sample storage propagation and archiving retention modes.
 */

/**
 * Coerce API/JSON values to a safe string for React rendering.
 */
export function coerceDisplayValue(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const extracted =
      value.value ??
      value.name ??
      value.description ??
      value.text ??
      value.label ??
      value.id;
    if (
      extracted !== null &&
      extracted !== undefined &&
      extracted !== "" &&
      typeof extracted !== "object"
    ) {
      return String(extracted);
    }
    return fallback;
  }
  return String(value);
}

export function hasExistingStorage(sample) {
  if (!sample) {
    return false;
  }
  return Boolean(
    sample.storagePath ||
      sample.storageWell ||
      sample.data?.storagePath ||
      sample.data?.storageWell,
  );
}

export function formatCurrentStorage(sample) {
  if (!sample) {
    return "-";
  }
  const path = coerceDisplayValue(
    sample.storagePath || sample.data?.storagePath,
    "",
  );
  const well = coerceDisplayValue(
    sample.storageWell ||
      sample.data?.storageWell ||
      sample.data?.archiveStorageWell,
    "",
  );
  if (path && path !== "-" && well && well !== "-") {
    return `${path} > ${well}`;
  }
  if (path && path !== "-") {
    return path;
  }
  if (well && well !== "-") {
    return well;
  }
  return "-";
}

export function allSelectedHaveExistingStorage(samples, selectedIds) {
  if (!selectedIds?.length) {
    return false;
  }
  const selected = (samples || []).filter((s) => selectedIds.includes(s.id));
  return selected.length > 0 && selected.every(hasExistingStorage);
}

export function getExistingStorageLocation(sample) {
  return {
    storagePath: sample.storagePath || sample.data?.storagePath || "",
    storageWell: sample.storageWell || sample.data?.storageWell || "",
  };
}

export function enrichSampleForBiorepositoryTransfer(sample) {
  const collectionDate =
    sample.collectionDate ||
    sample.data?.collectionDate ||
    new Date().toISOString().split("T")[0];
  const quantity =
    sample.quantity ??
    sample.volume ??
    sample.data?.sampleVolume ??
    sample.data?.volume ??
    1;

  return {
    ...sample,
    collectionDate,
    quantity,
    sampleCondition:
      sample.sampleCondition || sample.data?.sampleCondition || "Good",
    preservationMedium:
      sample.preservative ||
      sample.preservationMedium ||
      sample.data?.preservative ||
      sample.data?.preservationMedium ||
      "None",
    unitOfMeasure: sample.unitOfMeasure || sample.data?.unitOfMeasure || "mL",
  };
}

export function mapMntdSamplesForBiorepositoryTransfer(
  samples,
  selectedSampleIds,
) {
  const selectedSet = new Set((selectedSampleIds || []).map(String));
  return (samples || [])
    .filter((sample) => selectedSet.has(String(sample.id)))
    .map((sample) => enrichSampleForBiorepositoryTransfer(sample))
    .map((sample) => ({
      sampleItemId: sample.id,
      id: sample.id,
      externalId: sample.externalId,
      accessionNumber: sample.accessionNumber,
      sampleType: sample.sampleType,
      collectionDate: sample.collectionDate,
      quantity: sample.quantity,
      unitOfMeasure: sample.unitOfMeasure,
      sampleCondition: sample.sampleCondition,
      preservationMedium: sample.preservationMedium,
      data: sample.data,
    }));
}

export function computeInStorageCount(storedCount, completedCount) {
  return Math.max(0, (storedCount || 0) - (completedCount || 0));
}

/**
 * After biorepository transfer: apply archive metadata and mark samples COMPLETED
 * on the current page (does not advance workflow).
 */
export function applyMntdBiorepositoryTransferSuccess({
  pageId,
  selectedSampleIds,
  transferResponse,
  userName,
  postToOpenElisServerJsonResponse,
  onComplete,
  onError,
}) {
  if (!pageId || !transferResponse?.id || !selectedSampleIds?.length) {
    onError?.("Cannot update samples: page or transfer response missing.");
    return;
  }

  const numericIds = selectedSampleIds.map((id) => parseInt(id, 10));

  postToOpenElisServerJsonResponse(
    `/rest/notebook/bulk/page/${pageId}/samples/apply`,
    JSON.stringify({
      sampleIds: numericIds,
      data: {
        archiveType: "BIOREPOSITORY",
        disposalMethod: "BIOREPOSITORY",
        archiveDate: new Date().toISOString(),
        archivedBy: userName || "System",
        biorepositoryTransferId: transferResponse.id,
        biorepositoryTransferStatus: transferResponse.status || "PENDING",
      },
    }),
    (applyResponse) => {
      if (applyResponse && !applyResponse.error) {
        postToOpenElisServerJsonResponse(
          `/rest/notebook/bulk/page/${pageId}/samples/status`,
          JSON.stringify({
            sampleIds: numericIds,
            status: "COMPLETED",
          }),
          () => {
            onComplete?.({ transferResponse, count: numericIds.length });
          },
        );
      } else {
        onError?.(
          applyResponse?.error ||
            "Transfer created but failed to update notebook samples.",
        );
      }
    },
  );
}
