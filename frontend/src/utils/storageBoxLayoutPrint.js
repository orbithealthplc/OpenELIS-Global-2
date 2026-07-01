import {
  findLayoutEntryForCell,
  getRowHeaderLabel,
  getStorageCoordinateLabel,
} from "./storagePositionUtils";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build a minimal single-page HTML document for printing a storage box layout.
 */
export function buildStorageBoxLayoutPrintHtml({
  pathLabel = "Path:",
  path = "",
  boxId,
  boxLabel,
  layout = {},
  rows = 9,
  columns = 9,
  positionSchemaHint = "number-number",
}) {
  const hint = positionSchemaHint || "number-number";
  const safeRows = Math.max(1, Number(rows) || 9);
  const safeColumns = Math.max(1, Number(columns) || 9);
  const columnNumbers = Array.from({ length: safeColumns }, (_, i) => i + 1);
  const rowIndices = Array.from({ length: safeRows }, (_, i) => i);

  const cellPx = Math.max(
    14,
    Math.min(
      28,
      Math.floor(720 / (safeColumns + 1)),
      Math.floor(520 / (safeRows + 2)),
    ),
  );
  const fontPx = Math.max(6, Math.min(9, cellPx - 10));

  const headerCells = columnNumbers
    .map(
      (col) => `<th style="width:${cellPx}px;height:${cellPx}px">${col}</th>`,
    )
    .join("");

  const bodyRows = rowIndices
    .map((rowIdx) => {
      const rowHeader = getRowHeaderLabel(rowIdx, hint);
      const wells = columnNumbers
        .map((col) => {
          const colIdx = col - 1;
          const info = findLayoutEntryForCell(
            layout,
            rowIdx,
            colIdx,
            safeColumns,
            hint,
          );
          const label = info
            ? escapeHtml(info.externalId || info.sampleItemId || "•")
            : "";
          const occupiedClass = info ? " occupied" : "";
          return `<td class="well${occupiedClass}" style="width:${cellPx}px;height:${cellPx}px;font-size:${fontPx}px">${label}</td>`;
        })
        .join("");
      return `<tr><th class="row-head" style="width:${cellPx}px;height:${cellPx}px">${escapeHtml(rowHeader)}</th>${wells}</tr>`;
    })
    .join("");

  const title = escapeHtml(boxLabel || boxId || "");
  const pathLine = escapeHtml(path);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title} — Storage layout</title>
    <style>
      @page { size: landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        font-family: "IBM Plex Sans", Arial, sans-serif;
        color: #161616;
        background: #fff;
      }
      body { padding: 6mm; }
      .path {
        font-size: 11px;
        margin: 0 0 8px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .path strong { font-weight: 600; }
      table {
        border-collapse: collapse;
        margin: 0 auto;
      }
      th, td {
        border: 1px solid #c6c6c6;
        text-align: center;
        vertical-align: middle;
        padding: 0;
        line-height: 1.1;
      }
      th.row-head, thead th {
        background: #f4f4f4;
        font-weight: 600;
        font-size: 10px;
      }
      td.well { background: #fff; }
      td.well.occupied { background: #d0e2ff; font-weight: 600; }
    </style>
  </head>
  <body>
    <p class="path"><strong>${escapeHtml(pathLabel)}</strong> ${pathLine}</p>
    <table>
      <thead>
        <tr>
          <th style="width:${cellPx}px;height:${cellPx}px"></th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
    <script>
      window.onload = function () {
        window.print();
        window.onafterprint = function () { window.close(); };
      };
    </script>
  </body>
</html>`;
}

export function openStorageBoxLayoutPrintWindow(options) {
  const html = buildStorageBoxLayoutPrintHtml(options);
  const printWindow = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=900,height=700",
  );
  if (!printWindow) {
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
