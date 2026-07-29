package org.openelisglobal.notebook.service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openelisglobal.common.service.AuditableBaseObjectServiceImpl;
import org.openelisglobal.notebook.dao.NotebookEntryTemperatureLogDAO;
import org.openelisglobal.notebook.valueholder.NotebookEntry;
import org.openelisglobal.notebook.valueholder.NotebookEntryTemperatureLog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service implementation for NotebookEntryTemperatureLog operations.
 */
@Service
public class NotebookEntryTemperatureLogServiceImpl
        extends AuditableBaseObjectServiceImpl<NotebookEntryTemperatureLog, Integer>
        implements NotebookEntryTemperatureLogService {

    @Autowired
    private NotebookEntryTemperatureLogDAO temperatureLogDAO;

    @Autowired
    private NotebookEntryService notebookEntryService;

    public NotebookEntryTemperatureLogServiceImpl() {
        super(NotebookEntryTemperatureLog.class);
    }

    @Override
    protected NotebookEntryTemperatureLogDAO getBaseObjectDAO() {
        return temperatureLogDAO;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotebookEntryTemperatureLog> findByEntryId(Integer entryId) {
        return temperatureLogDAO.findByEntryId(entryId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotebookEntryTemperatureLog> findByEntryIdAndFreezerId(Integer entryId, String freezerId) {
        return temperatureLogDAO.findByEntryIdAndFreezerId(entryId, freezerId);
    }

    @Override
    @Transactional(readOnly = true)
    public Long countByEntryId(Integer entryId) {
        return temperatureLogDAO.countByEntryId(entryId);
    }

    @Override
    @Transactional
    public NotebookEntryTemperatureLog logTemperature(Integer entryId, String freezerId, String checkTime,
            Double temperatureValue, String temperatureUnit, String checkedBy, Timestamp checkedDateTime, String notes,
            String sysUserId) {

        NotebookEntry entry = notebookEntryService.get(entryId);
        if (entry == null) {
            throw new IllegalArgumentException("Notebook entry not found with ID: " + entryId
                    + ". This may indicate a data consistency issue. Please refresh the page or contact support if the problem persists.");
        }

        NotebookEntryTemperatureLog log = new NotebookEntryTemperatureLog();
        log.setNotebookEntry(entry);
        log.setFreezerId(freezerId);
        log.setCheckTime(checkTime != null ? checkTime : "AM");
        log.setTemperatureValue(temperatureValue);
        log.setTemperatureUnit(temperatureUnit != null ? temperatureUnit : "C");
        log.setCheckedBy(checkedBy);
        log.setCheckedDateTime(checkedDateTime != null ? checkedDateTime : new Timestamp(System.currentTimeMillis()));
        log.setNotes(notes);
        log.setLoggedBy(sysUserId);
        log.setLoggedAt(new Timestamp(System.currentTimeMillis()));
        log.setSysUserId(sysUserId);

        Integer id = insert(log);
        log.setId(id);
        return log;
    }

    @Override
    @Transactional
    public Map<String, Object> importTemperatureLogs(Integer entryId, List<Map<String, Object>> rows,
            String scopeDeviceCode, String sysUserId) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        int importedCount = 0;
        int skippedCount = 0;

        if (rows == null || rows.isEmpty()) {
            result.put("success", false);
            result.put("error", "No rows provided for import");
            return result;
        }

        NotebookEntry entry = notebookEntryService.get(entryId);
        if (entry == null) {
            result.put("success", false);
            result.put("error", "Notebook entry not found with ID: " + entryId);
            return result;
        }

        Set<String> existingKeys = new HashSet<>();
        for (NotebookEntryTemperatureLog existing : findByEntryId(entryId)) {
            existingKeys.add(buildDuplicateKey(existing.getFreezerId(), existing.getCheckedDateTime()));
        }

        Set<String> batchKeys = new HashSet<>();

        for (int i = 0; i < rows.size(); i++) {
            int rowNumber = i + 1;
            Map<String, Object> row = rows.get(i);
            try {
                String deviceCode = firstNonBlank(scopeDeviceCode, stringValue(row, "deviceCode"),
                        stringValue(row, "device_code"), stringValue(row, "freezerId"));
                if (deviceCode == null) {
                    errors.add(errorRow(rowNumber, "device_code is required"));
                    skippedCount++;
                    continue;
                }

                Double temperatureValue = doubleValue(row, "temperatureValue", "temperature_value");
                if (temperatureValue == null) {
                    errors.add(errorRow(rowNumber, "temperature_value is required"));
                    skippedCount++;
                    continue;
                }

                Timestamp checkedDateTime = parseCheckedDateTime(stringValue(row, "checkedDateTime"),
                        stringValue(row, "checked_date_time"));
                if (checkedDateTime == null) {
                    errors.add(errorRow(rowNumber, "checked_date_time is required or invalid"));
                    skippedCount++;
                    continue;
                }

                String duplicateKey = buildDuplicateKey(deviceCode, checkedDateTime);
                if (existingKeys.contains(duplicateKey) || !batchKeys.add(duplicateKey)) {
                    errors.add(errorRow(rowNumber, "Duplicate reading for device at the same date/time"));
                    skippedCount++;
                    continue;
                }

                String checkTime = inferCheckTime(stringValue(row, "checkTime"), stringValue(row, "check_time"),
                        checkedDateTime);
                String temperatureUnit = firstNonBlank(stringValue(row, "temperatureUnit"),
                        stringValue(row, "temperature_unit"), "C");
                String checkedBy = firstNonBlank(stringValue(row, "checkedBy"), stringValue(row, "checked_by"),
                        sysUserId);
                String notes = stringValue(row, "notes");

                logTemperature(entryId, deviceCode, checkTime, temperatureValue, temperatureUnit, checkedBy,
                        checkedDateTime, notes, sysUserId);
                existingKeys.add(duplicateKey);
                importedCount++;
            } catch (Exception e) {
                errors.add(errorRow(rowNumber, e.getMessage()));
                skippedCount++;
            }
        }

        result.put("success", importedCount > 0 || errors.isEmpty());
        result.put("importedCount", importedCount);
        result.put("skippedCount", skippedCount);
        if (!errors.isEmpty()) {
            result.put("errors", errors);
        }
        return result;
    }

    private static Map<String, Object> errorRow(int rowNumber, String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("row", rowNumber);
        error.put("message", message);
        return error;
    }

    private static String buildDuplicateKey(String deviceCode, Timestamp checkedDateTime) {
        return deviceCode.trim().toLowerCase() + "|" + checkedDateTime.getTime();
    }

    private static String inferCheckTime(String checkTime, String altCheckTime, Timestamp checkedDateTime) {
        String value = firstNonBlank(checkTime, altCheckTime);
        if (value != null) {
            return value.trim().toUpperCase();
        }
        return checkedDateTime.toLocalDateTime().getHour() < 12 ? "AM" : "PM";
    }

    private static Timestamp parseCheckedDateTime(String... values) {
        for (String value : values) {
            if (value == null || value.isBlank()) {
                continue;
            }
            String trimmed = value.trim();
            Timestamp parsed = tryParseTimestamp(trimmed);
            if (parsed != null) {
                return parsed;
            }
        }
        return null;
    }

    private static Timestamp tryParseTimestamp(String value) {
        String[] patterns = { "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm",
                "yyyy-MM-dd" };
        for (String pattern : patterns) {
            try {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern);
                LocalDateTime dateTime = LocalDateTime.parse(value, formatter);
                return Timestamp.valueOf(dateTime);
            } catch (DateTimeParseException ignored) {
                // try next pattern
            }
        }
        try {
            return Timestamp.valueOf(LocalDateTime.parse(value));
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private static String stringValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Double doubleValue(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            Object value = row.get(key);
            if (value == null) {
                continue;
            }
            if (value instanceof Number) {
                return ((Number) value).doubleValue();
            }
            try {
                return Double.parseDouble(String.valueOf(value).trim());
            } catch (NumberFormatException ignored) {
                // try next key
            }
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
