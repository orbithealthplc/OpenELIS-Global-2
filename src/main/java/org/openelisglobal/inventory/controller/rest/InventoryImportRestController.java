package org.openelisglobal.inventory.controller.rest;

import jakarta.servlet.http.HttpServletRequest;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import org.openelisglobal.common.log.LogEvent;
import org.openelisglobal.common.rest.BaseRestController;
import org.openelisglobal.inventory.form.InventoryImportResult;
import org.openelisglobal.inventory.service.InventoryImportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/rest/inventory/import")
public class InventoryImportRestController extends BaseRestController {

    @Autowired
    private InventoryImportService inventoryImportService;

    @PostMapping(value = "/catalog/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> validateCatalogImport(@RequestParam("file") MultipartFile file,
            @RequestParam(value = "departmentId", required = false) Integer departmentId, HttpServletRequest request) {
        try {
            if (file.isEmpty()) {
                return badRequest("File is empty");
            }
            InputStream inputStream = file.getInputStream();
            InventoryImportResult result = inventoryImportService.validateCatalogImport(inputStream,
                    file.getOriginalFilename(), file.getContentType(), request, departmentId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            LogEvent.logError(e);
            return serverError("Failed to validate catalog import file: " + e.getMessage());
        }
    }

    @PostMapping(value = "/catalog", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> importCatalog(@RequestParam("file") MultipartFile file,
            @RequestParam(value = "departmentId", required = false) Integer departmentId, HttpServletRequest request) {
        try {
            if (file.isEmpty()) {
                return badRequest("File is empty");
            }
            String sysUserId = getSysUserId(request);
            InputStream inputStream = file.getInputStream();
            Map<String, Object> result = inventoryImportService.importCatalog(inputStream, file.getOriginalFilename(),
                    file.getContentType(), sysUserId, request, departmentId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            LogEvent.logError(e);
            return serverError("Failed to import catalog file: " + e.getMessage());
        }
    }

    @PostMapping(value = "/lots/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> validateLotImport(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        try {
            if (file.isEmpty()) {
                return badRequest("File is empty");
            }
            InputStream inputStream = file.getInputStream();
            InventoryImportResult result = inventoryImportService.validateLotImport(inputStream,
                    file.getOriginalFilename(), file.getContentType(), request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            LogEvent.logError(e);
            return serverError("Failed to validate lot import file: " + e.getMessage());
        }
    }

    @PostMapping(value = "/lots", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> importLots(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        try {
            if (file.isEmpty()) {
                return badRequest("File is empty");
            }
            String sysUserId = getSysUserId(request);
            InputStream inputStream = file.getInputStream();
            Map<String, Object> result = inventoryImportService.importLots(inputStream, file.getOriginalFilename(),
                    file.getContentType(), sysUserId, request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            LogEvent.logError(e);
            return serverError("Failed to import lot file: " + e.getMessage());
        }
    }

    private ResponseEntity<Map<String, String>> badRequest(String message) {
        Map<String, String> errorResponse = new HashMap<>();
        errorResponse.put("error", message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    private ResponseEntity<Map<String, String>> serverError(String message) {
        Map<String, String> errorResponse = new HashMap<>();
        errorResponse.put("error", message);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
}
