import * as XLSX from "xlsx";
import { buildCatalogPayload } from "./catalog/inventoryCatalogValidation";
import { InventoryItemAPI, InventoryManagementAPI } from "./InventoryService";

const ITEM_TYPES = new Set([
  "REAGENT",
  "RDT",
  "CARTRIDGE",
  "EQUIPMENT",
  "CONSUMABLE",
  "HIV_KIT",
  "SYPHILIS_KIT",
  "ENZYME",
  "ANTIBIOTICS",
]);

const QC_STATUSES = new Set(["PENDING", "PASSED", "FAILED", "QUARANTINED"]);

const normalizeKey = (key) =>
  String(key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

const findValue = (row, ...keys) => {
  for (const key of keys) {
    const normalizedKey = normalizeKey(key);
    for (const [rowKey, value] of Object.entries(row)) {
      if (normalizeKey(rowKey) === normalizedKey && value?.trim()) {
        return value.trim();
      }
    }
  }
  return "";
};

const parseCsvText = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const splitLine = (line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headerCells = splitLine(lines[0]);
  const headers = headerCells.map((header, index) => {
    const normalized = normalizeKey(header);
    return normalized || `column${index + 1}`;
  });

  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index]?.trim() || "";
    });
    return row;
  });

  return {
    headers,
    rows: rows.filter((row) => Object.values(row).some(Boolean)),
  };
};

export const parseImportFile = async (file) => {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!matrix.length) {
      return { headers: [], rows: [] };
    }
    const headers = matrix[0].map((header, index) => {
      const normalized = normalizeKey(header);
      return normalized || `column${index + 1}`;
    });
    const rows = matrix.slice(1).map((cells) => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = String(cells[index] ?? "").trim();
      });
      return row;
    });
    return {
      headers,
      rows: rows.filter((row) => Object.values(row).some(Boolean)),
    };
  }

  throw new Error("Unsupported file type. Please use CSV or Excel.");
};

const emptyResult = () => ({
  valid: true,
  totalRows: 0,
  validRows: 0,
  invalidRows: 0,
  errors: [],
  previewRows: [],
});

export const validateCatalogImportLocal = (rows, departmentId) => {
  const result = emptyResult();
  result.totalRows = rows.length;

  if (!departmentId) {
    result.valid = false;
    result.errors.push({
      rowNumber: 0,
      field: "department",
      message: "Select a department before validating",
    });
    return result;
  }

  const seenNames = new Set();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowErrors = [];
    const name = findValue(row, "name", "itemname", "item_name");
    const itemType = (
      findValue(row, "itemtype", "item_type", "type") || "REAGENT"
    ).toUpperCase();
    const category = findValue(row, "category");
    const units = findValue(row, "units", "unit");

    if (!name) {
      rowErrors.push({ field: "name", message: "Item name is required" });
    }
    if (!ITEM_TYPES.has(itemType)) {
      rowErrors.push({
        field: "itemType",
        message: `Invalid item type '${itemType}'`,
      });
    }
    if (itemType !== "EQUIPMENT") {
      if (!category) {
        rowErrors.push({
          field: "category",
          message: "Category is required for stock items",
        });
      }
      if (!units) {
        rowErrors.push({
          field: "units",
          message: "Units are required for stock items",
        });
      }
    }

    const normalizedName = name.toLowerCase();
    if (name && seenNames.has(normalizedName)) {
      rowErrors.push({
        field: "name",
        message: `Duplicate item name in file: ${name}`,
      });
    }
    if (name) {
      seenNames.add(normalizedName);
    }

    if (rowErrors.length > 0) {
      result.invalidRows += 1;
      result.valid = false;
      rowErrors.forEach((error) => {
        result.errors.push({
          rowNumber,
          field: error.field,
          message: error.message,
        });
      });
      return;
    }

    result.validRows += 1;
    result.previewRows.push({
      rowNumber,
      name,
      itemType,
      category,
      manufacturer: findValue(row, "manufacturer"),
      units,
    });
  });

  return result;
};

export const importCatalogLocal = async (rows, departmentId) => {
  const errors = [];
  let createdCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    try {
      const formData = {
        name: findValue(row, "name", "itemname", "item_name"),
        itemType: (
          findValue(row, "itemtype", "item_type", "type") || "REAGENT"
        ).toUpperCase(),
        category: findValue(row, "category"),
        manufacturer: findValue(row, "manufacturer"),
        units: findValue(row, "units", "unit"),
        lowStockThreshold:
          Number(findValue(row, "lowstockthreshold", "low_stock_threshold")) ||
          0,
        projectName: findValue(row, "projectname", "project_name", "project"),
        concentration: findValue(row, "concentration"),
        storageRequirements: findValue(
          row,
          "storagerequirements",
          "storage_requirements",
          "storage",
        ),
        stabilityAfterOpening:
          Number(
            findValue(row, "stabilityafteropening", "stability_after_opening"),
          ) || 0,
        dilutionNotes: findValue(row, "dilutionnotes", "dilution_notes"),
      };
      const payload = buildCatalogPayload(formData, departmentId);
      await InventoryItemAPI.create(payload);
      createdCount += 1;
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error.message || "Import failed"}`);
    }
  }

  return {
    success: errors.length === 0,
    createdCount,
    failedCount: errors.length,
    errors,
  };
};

export const validateLotImportLocal = async (rows) => {
  const result = emptyResult();
  result.totalRows = rows.length;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const rowErrors = [];
    const itemName = findValue(
      row,
      "itemname",
      "item_name",
      "name",
      "catalogitem",
    );
    const lotNumber = findValue(row, "lotnumber", "lot_number", "lot");
    const quantityValue = findValue(row, "quantity", "currentquantity", "qty");
    const expirationDate = findValue(
      row,
      "expirationdate",
      "expiration_date",
      "expiry",
    );
    const qcStatus = (
      findValue(row, "qcstatus", "qc_status", "qc") || "PENDING"
    ).toUpperCase();

    if (!itemName) {
      rowErrors.push({ field: "itemName", message: "Item name is required" });
    }
    if (!lotNumber) {
      rowErrors.push({ field: "lotNumber", message: "Lot number is required" });
    }
    if (!quantityValue) {
      rowErrors.push({ field: "quantity", message: "Quantity is required" });
    } else if (Number(quantityValue) <= 0) {
      rowErrors.push({
        field: "quantity",
        message: "Quantity must be greater than 0",
      });
    }
    if (qcStatus && !QC_STATUSES.has(qcStatus)) {
      rowErrors.push({
        field: "qcStatus",
        message: `Invalid QC status '${qcStatus}'`,
      });
    }

    let matchedItem = null;
    if (itemName && rowErrors.length === 0) {
      try {
        const matches = await InventoryItemAPI.search(itemName);
        const exact = (matches || []).filter(
          (item) => item.name?.toLowerCase() === itemName.toLowerCase(),
        );
        if (exact.length === 0) {
          rowErrors.push({
            field: "itemName",
            message: `No catalog item found with name '${itemName}'`,
          });
        } else if (exact.length > 1) {
          rowErrors.push({
            field: "itemName",
            message: `Multiple items match '${itemName}'. Use itemId in the file.`,
          });
        } else {
          matchedItem = exact[0];
        }
      } catch (error) {
        rowErrors.push({
          field: "itemName",
          message: error.message || "Failed to look up catalog item",
        });
      }
    }

    if (rowErrors.length > 0) {
      result.invalidRows += 1;
      result.valid = false;
      rowErrors.forEach((error) => {
        result.errors.push({
          rowNumber,
          field: error.field,
          message: error.message,
        });
      });
      continue;
    }

    result.validRows += 1;
    result.previewRows.push({
      rowNumber,
      name: matchedItem?.name || itemName,
      lotNumber,
      quantity: quantityValue,
      expirationDate,
    });
  }

  return result;
};

export const importLotsLocal = async (rows) => {
  const errors = [];
  let createdCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    try {
      const itemName = findValue(
        row,
        "itemname",
        "item_name",
        "name",
        "catalogitem",
      );
      const itemIdValue = findValue(row, "itemid", "item_id");
      let item = null;

      if (itemIdValue) {
        item = await InventoryItemAPI.getById(itemIdValue);
      } else {
        const matches = await InventoryItemAPI.search(itemName);
        item = (matches || []).find(
          (candidate) =>
            candidate.name?.toLowerCase() === itemName.toLowerCase(),
        );
      }

      if (!item?.id) {
        throw new Error(`Catalog item not found: ${itemName || itemIdValue}`);
      }

      const quantity = Number(
        findValue(row, "quantity", "currentquantity", "qty"),
      );
      const expirationDate = findValue(
        row,
        "expirationdate",
        "expiration_date",
        "expiry",
      );
      const receiptDate = findValue(row, "receiptdate", "receipt_date");
      const qcStatus = (
        findValue(row, "qcstatus", "qc_status", "qc") || "PENDING"
      ).toUpperCase();

      const lotPayload = {
        inventoryItem: { id: item.id },
        lotNumber: findValue(row, "lotnumber", "lot_number", "lot"),
        initialQuantity: quantity,
        currentQuantity: quantity,
        qcStatus,
        status: "ACTIVE",
      };

      if (expirationDate) {
        lotPayload.expirationDate = `${expirationDate}T00:00:00`;
      }
      if (receiptDate) {
        lotPayload.receiptDate = `${receiptDate}T00:00:00`;
      }

      await InventoryManagementAPI.receive(lotPayload);
      createdCount += 1;
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error.message || "Import failed"}`);
    }
  }

  return {
    success: errors.length === 0,
    createdCount,
    failedCount: errors.length,
    errors,
  };
};

export const isImportApiUnavailable = (response) =>
  response && (response.status === 404 || response.status === 405);
