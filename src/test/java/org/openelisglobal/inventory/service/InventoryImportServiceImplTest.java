package org.openelisglobal.inventory.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.openelisglobal.department.service.DepartmentIsolationService;
import org.openelisglobal.inventory.form.InventoryImportResult;
import org.openelisglobal.inventory.valueholder.InventoryEnums.ItemType;
import org.openelisglobal.inventory.valueholder.InventoryItem;
import org.openelisglobal.rbac.RbacAction;
import org.openelisglobal.rbac.RbacPermissionService;

@RunWith(MockitoJUnitRunner.class)
public class InventoryImportServiceImplTest {

    @InjectMocks
    private InventoryImportServiceImpl inventoryImportService;

    @Mock
    private InventoryItemService inventoryItemService;

    @Mock
    private InventoryManagementService inventoryManagementService;

    @Mock
    private DepartmentIsolationService departmentIsolationService;

    @Mock
    private RbacPermissionService rbacPermissionService;

    @Mock
    private HttpServletRequest request;

    @Before
    public void setUp() {
        lenient().when(departmentIsolationService.resolveDepartmentForStrictScopedCreate(any(), any(), any()))
                .thenReturn(7);
        lenient().when(departmentIsolationService.isInventoryProjectConsistent(eq(7), any())).thenReturn(true);
        lenient().when(departmentIsolationService.getRestrictedUserTestSectionIds(any())).thenReturn(Set.of(7));
        lenient().when(rbacPermissionService.hasPermission(any(), eq(RbacAction.UPDATE_SAMPLES))).thenReturn(true);
    }

    @Test
    public void validateCatalogImport_acceptsValidReagentRow() {
        String csv = "name,itemType,category,manufacturer,units\n" + "Ethanol 70%,REAGENT,Solvent,Merck,mL\n";
        InventoryImportResult result = inventoryImportService.validateCatalogImport(
                new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)), "catalog.csv", "text/csv", request, 7);

        assertTrue(result.isValid());
        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getValidRows());
        assertEquals(1, result.getPreviewRows().size());
        assertEquals("Ethanol 70%", result.getPreviewRows().get(0).getName());
        assertEquals("REAGENT", result.getPreviewRows().get(0).getItemType());
    }

    @Test
    public void validateCatalogImport_rejectsMissingName() {
        String csv = "name,itemType,category,units\n" + ",REAGENT,Solvent,mL\n";
        InventoryImportResult result = inventoryImportService.validateCatalogImport(
                new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)), "catalog.csv", "text/csv", request, 7);

        assertFalse(result.isValid());
        assertEquals(1, result.getInvalidRows());
        assertTrue(result.getErrors().stream().anyMatch(error -> "name".equals(error.getField())));
    }

    @Test
    public void validateCatalogImport_rejectsInvalidItemType() {
        String csv = "name,itemType,category,units\n" + "Bad Item,NOT_A_TYPE,Solvent,mL\n";
        InventoryImportResult result = inventoryImportService.validateCatalogImport(
                new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)), "catalog.csv", "text/csv", request, 7);

        assertFalse(result.isValid());
        assertTrue(result.getErrors().stream().anyMatch(error -> "itemType".equals(error.getField())));
    }

    @Test
    public void validateLotImport_rejectsUnknownItemName() {
        when(inventoryItemService.searchByName("Missing Reagent")).thenReturn(Collections.emptyList());

        String csv = "itemName,lotNumber,quantity\n" + "Missing Reagent,LOT-1,10\n";
        InventoryImportResult result = inventoryImportService.validateLotImport(
                new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)), "lots.csv", "text/csv", request);

        assertFalse(result.isValid());
        assertTrue(result.getErrors().stream().anyMatch(error -> "itemName".equals(error.getField())));
    }

    @Test
    public void validateLotImport_acceptsValidLotRow() {
        InventoryItem item = new InventoryItem();
        item.setId(42L);
        item.setName("Ethanol 70%");
        item.setItemType(ItemType.REAGENT);
        item.setDepartmentTestSectionId(7);

        when(inventoryItemService.searchByName("Ethanol 70%")).thenReturn(List.of(item));
        when(departmentIsolationService.canAccessInventoryItemStrictIntersection(item, request)).thenReturn(true);

        String csv = "itemName,lotNumber,quantity,expirationDate,qcStatus\n"
                + "Ethanol 70%,LOT-2024-001,500,2026-12-31,PENDING\n";
        InventoryImportResult result = inventoryImportService.validateLotImport(
                new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)), "lots.csv", "text/csv", request);

        assertTrue(result.isValid());
        assertEquals(1, result.getPreviewRows().size());
        assertEquals("LOT-2024-001", result.getPreviewRows().get(0).getLotNumber());
        assertEquals("500", result.getPreviewRows().get(0).getQuantity());
    }
}
