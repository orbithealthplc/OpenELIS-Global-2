/**
 * Resolve linked equipment for workflow pages.
 * Parent form state takes precedence over notebook view API data.
 */
export function resolveNotebookInstruments(
  linkedInstruments,
  notebookAnalyzers,
) {
  if (linkedInstruments !== undefined && linkedInstruments !== null) {
    return linkedInstruments;
  }
  return notebookAnalyzers || [];
}

/** Map notebook analyzer / linked-equipment entries to Carbon dropdown options. */
export function mapNotebookInstrumentsToOptions(instruments) {
  if (!instruments || !Array.isArray(instruments)) {
    return [];
  }
  return instruments.map((item) => ({
    ...item,
    id: String(item.id),
    text: item.value || item.name || String(item.id),
    physicalId: item.serialNumber || item.physicalId || "N/A",
    name: item.value || item.name,
    serialNumber: item.serialNumber,
    modelNumber: item.modelNumber,
  }));
}
