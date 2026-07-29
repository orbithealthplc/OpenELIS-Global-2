package org.openelisglobal.inventory.service;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.commons.validator.GenericValidator;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.openelisglobal.common.log.LogEvent;
import org.openelisglobal.department.service.DepartmentIsolationService;
import org.openelisglobal.inventory.form.InventoryImportResult;
import org.openelisglobal.inventory.form.InventoryImportResult.PreviewRow;
import org.openelisglobal.inventory.valueholder.InventoryEnums.ItemType;
import org.openelisglobal.inventory.valueholder.InventoryEnums.LotStatus;
import org.openelisglobal.inventory.valueholder.InventoryEnums.QCStatus;
import org.openelisglobal.inventory.valueholder.InventoryItem;
import org.openelisglobal.inventory.valueholder.InventoryLot;
import org.openelisglobal.rbac.RbacAction;
import org.openelisglobal.rbac.RbacPermissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryImportServiceImpl implements InventoryImportService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    @Autowired
    private InventoryItemService inventoryItemService;

    @Autowired
    private InventoryManagementService inventoryManagementService;

    @Autowired
    private DepartmentIsolationService departmentIsolationService;

    @Autowired
    private RbacPermissionService rbacPermissionService;

    @Override
    @Transactional(readOnly = true)
    public InventoryImportResult validateCatalogImport(InputStream inputStream, String fileName, String contentType,
            HttpServletRequest request, Integer defaultDepartmentId) {
        InventoryImportResult result = new InventoryImportResult();
        try {
            ParseResult parsed = parseFile(inputStream, fileName, contentType);
            List<Map<String, String>> dataRows = filterNonEmptyRows(parsed.getDataRows());
            result.setTotalRows(dataRows.size());

            if (dataRows.isEmpty()) {
                result.addError(0, "file", "File has no data rows");
                return result;
            }

            Set<String> namesInFile = new HashSet<>();
            int validCount = 0;
            int invalidCount = 0;

            for (int i = 0; i < dataRows.size(); i++) {
                int rowNumber = i + 2;
                Map<String, String> row = dataRows.get(i);
                List<String> rowErrors = new ArrayList<>();
                CatalogRow catalogRow = parseCatalogRow(row, rowNumber, request, rowErrors, false, defaultDepartmentId);

                String normalizedName = catalogRow.name != null ? catalogRow.name.trim().toLowerCase() : null;
                if (normalizedName != null) {
                    if (!namesInFile.add(normalizedName)) {
                        rowErrors.add("name: Duplicate item name in file: " + catalogRow.name);
                    }
                }

                if (rowErrors.isEmpty()) {
                    validCount++;
                    PreviewRow preview = new PreviewRow();
                    preview.setRowNumber(rowNumber);
                    preview.setName(catalogRow.name);
                    preview.setItemType(catalogRow.itemType.name());
                    preview.setCategory(catalogRow.category);
                    preview.setManufacturer(catalogRow.manufacturer);
                    preview.setUnits(catalogRow.units);
                    result.addPreviewRow(preview);
                } else {
                    invalidCount++;
                    for (String error : rowErrors) {
                        addRowError(result, rowNumber, error);
                    }
                }
            }

            result.setValidRows(validCount);
            result.setInvalidRows(invalidCount);
            result.setValid(result.getErrors().isEmpty());
        } catch (Exception e) {
            LogEvent.logError(e);
            result.addError(0, "file", "Error reading file: " + e.getMessage());
        }
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> importCatalog(InputStream inputStream, String fileName, String contentType,
            String sysUserId, HttpServletRequest request, Integer defaultDepartmentId) {
        Map<String, Object> response = new HashMap<>();
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;

        try {
            ParseResult parsed = parseFile(inputStream, fileName, contentType);
            List<Map<String, String>> dataRows = filterNonEmptyRows(parsed.getDataRows());

            if (dataRows.isEmpty()) {
                response.put("success", false);
                response.put("error", "File has no data rows");
                return response;
            }

            Set<String> namesInFile = new HashSet<>();

            for (int i = 0; i < dataRows.size(); i++) {
                int rowNumber = i + 2;
                Map<String, String> row = dataRows.get(i);
                List<String> rowErrors = new ArrayList<>();
                CatalogRow catalogRow = parseCatalogRow(row, rowNumber, request, rowErrors, true, defaultDepartmentId);

                String normalizedName = catalogRow.name != null ? catalogRow.name.trim().toLowerCase() : null;
                if (normalizedName != null && !namesInFile.add(normalizedName)) {
                    rowErrors.add("name: Duplicate item name in file: " + catalogRow.name);
                }

                if (!rowErrors.isEmpty()) {
                    failed++;
                    errors.add("Row " + rowNumber + ": " + String.join("; ", rowErrors));
                    continue;
                }

                try {
                    InventoryItem item = catalogRow.toItem(sysUserId);
                    inventoryItemService.insert(item);
                    created++;
                } catch (Exception e) {
                    failed++;
                    errors.add("Row " + rowNumber + ": " + e.getMessage());
                    LogEvent.logError(e);
                }
            }

            response.put("success", errors.isEmpty());
            response.put("createdCount", created);
            response.put("failedCount", failed);
            if (!errors.isEmpty()) {
                response.put("errors", errors);
            }
        } catch (Exception e) {
            LogEvent.logError(e);
            response.put("success", false);
            response.put("error", "Failed to import catalog: " + e.getMessage());
        }

        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryImportResult validateLotImport(InputStream inputStream, String fileName, String contentType,
            HttpServletRequest request) {
        InventoryImportResult result = new InventoryImportResult();
        try {
            ParseResult parsed = parseFile(inputStream, fileName, contentType);
            List<Map<String, String>> dataRows = filterNonEmptyRows(parsed.getDataRows());
            result.setTotalRows(dataRows.size());

            if (dataRows.isEmpty()) {
                result.addError(0, "file", "File has no data rows");
                return result;
            }

            int validCount = 0;
            int invalidCount = 0;

            for (int i = 0; i < dataRows.size(); i++) {
                int rowNumber = i + 2;
                Map<String, String> row = dataRows.get(i);
                List<String> rowErrors = new ArrayList<>();
                LotRow lotRow = parseLotRow(row, rowNumber, request, rowErrors);

                if (rowErrors.isEmpty()) {
                    validCount++;
                    PreviewRow preview = new PreviewRow();
                    preview.setRowNumber(rowNumber);
                    preview.setName(lotRow.itemName);
                    preview.setLotNumber(lotRow.lotNumber);
                    preview.setQuantity(formatQuantity(lotRow.quantity));
                    preview.setExpirationDate(lotRow.expirationDateRaw);
                    result.addPreviewRow(preview);
                } else {
                    invalidCount++;
                    for (String error : rowErrors) {
                        addRowError(result, rowNumber, error);
                    }
                }
            }

            result.setValidRows(validCount);
            result.setInvalidRows(invalidCount);
            result.setValid(result.getErrors().isEmpty());
        } catch (Exception e) {
            LogEvent.logError(e);
            result.addError(0, "file", "Error reading file: " + e.getMessage());
        }
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> importLots(InputStream inputStream, String fileName, String contentType,
            String sysUserId, HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;

        try {
            ParseResult parsed = parseFile(inputStream, fileName, contentType);
            List<Map<String, String>> dataRows = filterNonEmptyRows(parsed.getDataRows());

            if (dataRows.isEmpty()) {
                response.put("success", false);
                response.put("error", "File has no data rows");
                return response;
            }

            for (int i = 0; i < dataRows.size(); i++) {
                int rowNumber = i + 2;
                Map<String, String> row = dataRows.get(i);
                List<String> rowErrors = new ArrayList<>();
                LotRow lotRow = parseLotRow(row, rowNumber, request, rowErrors);

                if (!rowErrors.isEmpty()) {
                    failed++;
                    errors.add("Row " + rowNumber + ": " + String.join("; ", rowErrors));
                    continue;
                }

                try {
                    InventoryLot lot = lotRow.toLot(sysUserId);
                    inventoryManagementService.receiveInventory(lot, sysUserId);
                    created++;
                } catch (Exception e) {
                    failed++;
                    errors.add("Row " + rowNumber + ": " + e.getMessage());
                    LogEvent.logError(e);
                }
            }

            response.put("success", errors.isEmpty());
            response.put("createdCount", created);
            response.put("failedCount", failed);
            if (!errors.isEmpty()) {
                response.put("errors", errors);
            }
        } catch (Exception e) {
            LogEvent.logError(e);
            response.put("success", false);
            response.put("error", "Failed to import lots: " + e.getMessage());
        }

        return response;
    }

    private CatalogRow parseCatalogRow(Map<String, String> row, int rowNumber, HttpServletRequest request,
            List<String> rowErrors, boolean checkExisting, Integer defaultDepartmentId) {
        CatalogRow catalogRow = new CatalogRow();

        catalogRow.name = trim(findValue(row, "name", "itemname", "item_name"));
        if (GenericValidator.isBlankOrNull(catalogRow.name)) {
            rowErrors.add("name: Item name is required");
        }

        String itemTypeValue = trim(findValue(row, "itemtype", "item_type", "type"));
        if (GenericValidator.isBlankOrNull(itemTypeValue)) {
            catalogRow.itemType = ItemType.REAGENT;
        } else {
            try {
                catalogRow.itemType = ItemType.valueOf(itemTypeValue.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                rowErrors.add("itemType: Invalid item type '" + itemTypeValue
                        + "'. Valid values: REAGENT, RDT, CARTRIDGE, EQUIPMENT, CONSUMABLE, HIV_KIT, SYPHILIS_KIT, ENZYME, ANTIBIOTICS");
            }
        }

        catalogRow.category = trim(findValue(row, "category"));
        catalogRow.manufacturer = trim(findValue(row, "manufacturer"));
        catalogRow.units = trim(findValue(row, "units", "unit"));
        catalogRow.projectName = trim(findValue(row, "projectname", "project_name", "project"));
        catalogRow.concentration = trim(findValue(row, "concentration"));
        catalogRow.storageRequirements = trim(findValue(row, "storagerequirements", "storage_requirements", "storage"));
        catalogRow.dilutionNotes = trim(findValue(row, "dilutionnotes", "dilution_notes"));
        catalogRow.catalogNumber = trim(findValue(row, "catalognumber", "catalog_number"));

        String lowStock = trim(findValue(row, "lowstockthreshold", "low_stock_threshold", "lowstock"));
        if (!GenericValidator.isBlankOrNull(lowStock)) {
            try {
                catalogRow.lowStockThreshold = Integer.parseInt(lowStock);
            } catch (NumberFormatException e) {
                rowErrors.add("lowStockThreshold: Must be a whole number");
            }
        }

        String stability = trim(findValue(row, "stabilityafteropening", "stability_after_opening", "stability"));
        if (!GenericValidator.isBlankOrNull(stability)) {
            try {
                catalogRow.stabilityAfterOpening = Integer.parseInt(stability);
            } catch (NumberFormatException e) {
                rowErrors.add("stabilityAfterOpening: Must be a whole number");
            }
        }

        String departmentValue = trim(
                findValue(row, "departmenttestsectionid", "department_test_section_id", "departmentid", "department"));
        if (!GenericValidator.isBlankOrNull(departmentValue)) {
            try {
                catalogRow.departmentTestSectionId = Integer.parseInt(departmentValue);
            } catch (NumberFormatException e) {
                rowErrors.add("departmentTestSectionId: Must be a whole number");
            }
        }

        if (catalogRow.itemType != null && !InventoryBehavior.isPermanentEquipment(catalogRow.itemType)) {
            if (GenericValidator.isBlankOrNull(catalogRow.category)) {
                rowErrors.add("category: Category is required for stock items");
            }
            if (GenericValidator.isBlankOrNull(catalogRow.units)) {
                rowErrors.add("units: Units are required for stock items");
            }
        }

        if (catalogRow.departmentTestSectionId == null && defaultDepartmentId != null) {
            catalogRow.departmentTestSectionId = defaultDepartmentId;
        }

        if (catalogRow.itemType != null && rowErrors.stream().noneMatch(err -> err.startsWith("department"))) {
            Integer departmentId = departmentIsolationService.resolveDepartmentForStrictScopedCreate(request,
                    catalogRow.departmentTestSectionId, catalogRow.projectName);
            if (departmentId == null && catalogRow.departmentTestSectionId == null) {
                departmentId = resolveSingleAssignableDepartment(request);
            }
            if (departmentId == null) {
                if (departmentIsolationService.hasUnrestrictedDepartmentAccess(request)) {
                    rowErrors.add("department: Select a department above before validating or importing");
                } else if (departmentIsolationService.getRestrictedUserTestSectionIds(request).isEmpty()) {
                    rowErrors.add("department: No lab unit is assigned to your account");
                } else {
                    rowErrors.add("department: Select a department above before validating or importing");
                }
            } else {
                catalogRow.departmentTestSectionId = departmentId;
                if (!departmentIsolationService.isInventoryProjectConsistent(departmentId, catalogRow.projectName)) {
                    rowErrors.add("projectName: Linked project belongs to a different department");
                }
            }
        }

        if (catalogRow.itemType != null && catalogRow.departmentTestSectionId != null && catalogRow.name != null
                && checkExisting) {
            List<InventoryItem> existing = inventoryItemService.searchByName(catalogRow.name).stream()
                    .filter(item -> item.getName() != null && item.getName().equalsIgnoreCase(catalogRow.name.trim())
                            && catalogRow.departmentTestSectionId.equals(item.getDepartmentTestSectionId()))
                    .collect(Collectors.toList());
            if (!existing.isEmpty()) {
                rowErrors.add("name: Catalog item already exists: " + catalogRow.name);
            }
        }

        if (catalogRow.itemType != null && catalogRow.name != null) {
            InventoryItem permissionProbe = new InventoryItem();
            permissionProbe.setItemType(catalogRow.itemType);
            permissionProbe.setDepartmentTestSectionId(catalogRow.departmentTestSectionId);
            if (!rbacPermissionService.hasPermission(request, inventoryActionFor(permissionProbe))) {
                rowErrors.add("permission: Insufficient permission to create this inventory item type");
            }
        }

        return catalogRow;
    }

    private LotRow parseLotRow(Map<String, String> row, int rowNumber, HttpServletRequest request,
            List<String> rowErrors) {
        LotRow lotRow = new LotRow();

        String itemIdValue = trim(findValue(row, "itemid", "item_id", "inventoryitemid"));
        lotRow.itemName = trim(findValue(row, "itemname", "item_name", "name", "catalogitem"));

        InventoryItem matchedItem = null;
        if (!GenericValidator.isBlankOrNull(itemIdValue)) {
            try {
                Long itemId = Long.parseLong(itemIdValue);
                matchedItem = inventoryItemService.get(itemId);
                if (matchedItem == null) {
                    rowErrors.add("itemId: Inventory item not found: " + itemIdValue);
                }
            } catch (NumberFormatException e) {
                rowErrors.add("itemId: Must be a whole number");
            }
        } else if (GenericValidator.isBlankOrNull(lotRow.itemName)) {
            rowErrors.add("itemName: Item name or item ID is required");
        } else {
            List<InventoryItem> matches = inventoryItemService.searchByName(lotRow.itemName).stream()
                    .filter(item -> item.getName() != null && item.getName().equalsIgnoreCase(lotRow.itemName.trim()))
                    .filter(item -> departmentIsolationService.canAccessInventoryItemStrictIntersection(item, request))
                    .collect(Collectors.toList());
            if (matches.isEmpty()) {
                rowErrors.add("itemName: No accessible catalog item found with name '" + lotRow.itemName + "'");
            } else if (matches.size() > 1) {
                rowErrors.add(
                        "itemName: Multiple catalog items match name '" + lotRow.itemName + "'. Use itemId instead.");
            } else {
                matchedItem = matches.get(0);
            }
        }

        if (matchedItem != null
                && !departmentIsolationService.canAccessInventoryItemStrictIntersection(matchedItem, request)) {
            rowErrors.add("itemName: Access denied for catalog item");
            matchedItem = null;
        }

        lotRow.inventoryItem = matchedItem;
        if (matchedItem != null) {
            lotRow.itemName = matchedItem.getName();
        }

        lotRow.lotNumber = trim(findValue(row, "lotnumber", "lot_number", "lot"));
        if (GenericValidator.isBlankOrNull(lotRow.lotNumber)) {
            rowErrors.add("lotNumber: Lot number is required");
        }

        String quantityValue = trim(findValue(row, "quantity", "currentquantity", "current_quantity", "qty"));
        if (GenericValidator.isBlankOrNull(quantityValue)) {
            rowErrors.add("quantity: Quantity is required");
        } else {
            try {
                lotRow.quantity = Double.parseDouble(quantityValue);
                if (lotRow.quantity <= 0) {
                    rowErrors.add("quantity: Quantity must be greater than 0");
                }
            } catch (NumberFormatException e) {
                rowErrors.add("quantity: Must be a number");
            }
        }

        lotRow.expirationDateRaw = trim(findValue(row, "expirationdate", "expiration_date", "expiry", "expirydate"));
        if (!GenericValidator.isBlankOrNull(lotRow.expirationDateRaw)) {
            lotRow.expirationDate = parseDate(lotRow.expirationDateRaw, rowErrors, "expirationDate");
        }

        String receiptDateRaw = trim(findValue(row, "receiptdate", "receipt_date", "receiveddate"));
        if (!GenericValidator.isBlankOrNull(receiptDateRaw)) {
            lotRow.receiptDate = parseDate(receiptDateRaw, rowErrors, "receiptDate");
        }

        String qcStatusValue = trim(findValue(row, "qcstatus", "qc_status", "qc"));
        if (GenericValidator.isBlankOrNull(qcStatusValue)) {
            lotRow.qcStatus = QCStatus.PENDING;
        } else {
            try {
                lotRow.qcStatus = QCStatus.valueOf(qcStatusValue.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                rowErrors.add("qcStatus: Invalid QC status '" + qcStatusValue
                        + "'. Valid values: PENDING, PASSED, FAILED, QUARANTINED");
            }
        }

        if (matchedItem != null && !rbacPermissionService.hasPermission(request, inventoryActionFor(matchedItem))) {
            rowErrors.add("permission: Insufficient permission to receive lots for this item");
        }

        return lotRow;
    }

    private Timestamp parseDate(String value, List<String> rowErrors, String fieldName) {
        try {
            LocalDate date = LocalDate.parse(value.trim(), DATE_FORMAT);
            return Timestamp.valueOf(date.atStartOfDay());
        } catch (DateTimeParseException e) {
            rowErrors.add(fieldName + ": Date must be in yyyy-MM-dd format");
            return null;
        }
    }

    private void addRowError(InventoryImportResult result, int rowNumber, String error) {
        String[] parts = error.split(":", 2);
        String field = parts.length > 0 ? parts[0].trim() : "unknown";
        String message = parts.length > 1 ? parts[1].trim() : error;
        result.addError(rowNumber, field, message);
    }

    private List<Map<String, String>> filterNonEmptyRows(List<Map<String, String>> dataRows) {
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : dataRows) {
            boolean hasValue = row.values().stream().anyMatch(value -> !GenericValidator.isBlankOrNull(value));
            if (hasValue) {
                filtered.add(row);
            }
        }
        return filtered;
    }

    private RbacAction inventoryActionFor(InventoryItem item) {
        if (item != null && item.getItemType() == ItemType.EQUIPMENT) {
            return RbacAction.MANAGE_EQUIPMENT;
        }
        return RbacAction.UPDATE_SAMPLES;
    }

    private Integer resolveSingleAssignableDepartment(HttpServletRequest request) {
        List<Map<String, String>> assignable = departmentIsolationService.getAssignableLabDepartments(request);
        if (assignable == null || assignable.size() != 1) {
            return null;
        }
        try {
            return Integer.parseInt(assignable.get(0).get("id"));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private String formatQuantity(Double quantity) {
        if (quantity == null) {
            return "";
        }
        if (quantity == Math.floor(quantity)) {
            return String.valueOf(quantity.longValue());
        }
        return String.valueOf(quantity);
    }

    private String findValue(Map<String, String> row, String... possibleKeys) {
        for (String key : possibleKeys) {
            if (row.containsKey(key)) {
                String value = row.get(key);
                if (!GenericValidator.isBlankOrNull(value)) {
                    return value;
                }
            }
            for (String rowKey : row.keySet()) {
                String normalizedRowKey = normalizeKey(rowKey);
                String normalizedKey = normalizeKey(key);
                if (normalizedRowKey.equals(normalizedKey)) {
                    String value = row.get(rowKey);
                    if (!GenericValidator.isBlankOrNull(value)) {
                        return value;
                    }
                }
            }
        }
        return null;
    }

    private String normalizeKey(String key) {
        if (key == null) {
            return "";
        }
        return key.toLowerCase().replaceAll("\\s+", "").replaceAll("[^a-z0-9]", "");
    }

    private ParseResult parseFile(InputStream inputStream, String fileName, String contentType)
            throws IOException, CsvException {
        String lowerName = fileName == null ? "" : fileName.toLowerCase();
        if (lowerName.endsWith(".csv") || (contentType != null && contentType.contains("text/csv"))) {
            return parseCsv(inputStream);
        }
        if (lowerName.endsWith(".xlsx") || (contentType != null && contentType.contains("spreadsheetml"))) {
            return parseExcel(inputStream, true);
        }
        if (lowerName.endsWith(".xls") || (contentType != null && contentType.contains("excel"))) {
            return parseExcel(inputStream, false);
        }
        throw new IOException("Unsupported file type. Please use CSV or Excel (.csv, .xlsx, .xls) files.");
    }

    private ParseResult parseCsv(InputStream inputStream) throws IOException, CsvException {
        List<String> headers = new ArrayList<>();
        List<Map<String, String>> dataRows = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8));
                CSVReader csvReader = new CSVReader(reader)) {
            List<String[]> allRows = csvReader.readAll();
            if (allRows.isEmpty()) {
                return new ParseResult(headers, dataRows);
            }

            String[] headerArray = allRows.get(0);
            normalizeHeaders(headerArray);
            for (String header : headerArray) {
                headers.add(header);
            }

            for (int i = 1; i < allRows.size(); i++) {
                String[] values = allRows.get(i);
                Map<String, String> row = new HashMap<>();
                for (int j = 0; j < headers.size() && j < values.length; j++) {
                    row.put(headers.get(j), values[j] != null ? values[j].trim() : "");
                }
                dataRows.add(row);
            }
        }

        return new ParseResult(headers, dataRows);
    }

    private ParseResult parseExcel(InputStream inputStream, boolean xlsx) throws IOException {
        List<String> headers = new ArrayList<>();
        List<Map<String, String>> dataRows = new ArrayList<>();

        try (Workbook workbook = xlsx ? new XSSFWorkbook(inputStream) : new HSSFWorkbook(inputStream)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                return new ParseResult(headers, dataRows);
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return new ParseResult(headers, dataRows);
            }

            for (Cell cell : headerRow) {
                headers.add(getCellValueAsString(cell).trim());
            }
            String[] headerArray = headers.toArray(new String[0]);
            normalizeHeaders(headerArray);
            headers.clear();
            for (String header : headerArray) {
                headers.add(header);
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    continue;
                }
                Map<String, String> rowData = new HashMap<>();
                for (int j = 0; j < headers.size(); j++) {
                    Cell cell = row.getCell(j);
                    rowData.put(headers.get(j), cell != null ? getCellValueAsString(cell).trim() : "");
                }
                dataRows.add(rowData);
            }
        }

        return new ParseResult(headers, dataRows);
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) {
            return "";
        }
        switch (cell.getCellType()) {
        case STRING:
            return cell.getStringCellValue();
        case NUMERIC:
            if (org.apache.poi.ss.usermodel.DateUtil.isCellDateFormatted(cell)) {
                return cell.getLocalDateTimeCellValue().toLocalDate().format(DATE_FORMAT);
            }
            double numValue = cell.getNumericCellValue();
            if (numValue == Math.floor(numValue)) {
                return String.valueOf((long) numValue);
            }
            return String.valueOf(numValue);
        case BOOLEAN:
            return String.valueOf(cell.getBooleanCellValue());
        case FORMULA:
            return cell.getCellFormula();
        default:
            return "";
        }
    }

    private void normalizeHeaders(String[] headers) {
        for (int i = 0; i < headers.length; i++) {
            String headerValue = headers[i];
            if (headerValue == null || GenericValidator.isBlankOrNull(headerValue.trim())) {
                headers[i] = "column" + (i + 1);
                continue;
            }
            String normalized = normalizeKey(headerValue);
            if (GenericValidator.isBlankOrNull(normalized)) {
                normalized = "column" + (i + 1);
            }
            headers[i] = normalized;
        }
    }

    private static class ParseResult {
        private final List<String> headers;
        private final List<Map<String, String>> dataRows;

        private ParseResult(List<String> headers, List<Map<String, String>> dataRows) {
            this.headers = headers;
            this.dataRows = dataRows;
        }

        private List<Map<String, String>> getDataRows() {
            return dataRows;
        }
    }

    private static class CatalogRow {
        private String name;
        private ItemType itemType;
        private String category;
        private String manufacturer;
        private String units;
        private Integer lowStockThreshold;
        private String projectName;
        private String concentration;
        private String storageRequirements;
        private Integer stabilityAfterOpening;
        private String dilutionNotes;
        private String catalogNumber;
        private Integer departmentTestSectionId;

        private InventoryItem toItem(String sysUserId) {
            InventoryItem item = new InventoryItem();
            item.setName(name);
            item.setItemType(itemType);
            item.setCategory(category);
            item.setManufacturer(manufacturer);
            item.setUnits(units != null ? units : "each");
            item.setLowStockThreshold(lowStockThreshold != null ? lowStockThreshold : 0);
            item.setProjectName(projectName);
            item.setConcentration(concentration);
            item.setStorageRequirements(storageRequirements);
            item.setStabilityAfterOpening(stabilityAfterOpening);
            item.setDilutionNotes(dilutionNotes);
            item.setCatalogNumber(catalogNumber);
            item.setDepartmentTestSectionId(departmentTestSectionId);
            item.setIsActive("Y");
            item.setSysUserId(sysUserId);
            item.setFhirUuid(UUID.randomUUID());
            return item;
        }
    }

    private static class LotRow {
        private InventoryItem inventoryItem;
        private String itemName;
        private String lotNumber;
        private Double quantity;
        private Timestamp expirationDate;
        private String expirationDateRaw;
        private Timestamp receiptDate;
        private QCStatus qcStatus = QCStatus.PENDING;

        private InventoryLot toLot(String sysUserId) {
            InventoryLot lot = new InventoryLot();
            lot.setInventoryItem(inventoryItem);
            lot.setLotNumber(lotNumber);
            lot.setInitialQuantity(quantity);
            lot.setCurrentQuantity(quantity);
            lot.setExpirationDate(expirationDate);
            lot.setReceiptDate(receiptDate);
            lot.setQcStatus(qcStatus);
            lot.setStatus(LotStatus.ACTIVE);
            lot.setSysUserId(sysUserId);
            lot.setFhirUuid(UUID.randomUUID());
            return lot;
        }
    }
}
