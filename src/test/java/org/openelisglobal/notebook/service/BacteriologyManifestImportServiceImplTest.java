package org.openelisglobal.notebook.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.openelisglobal.notebook.form.BacteriologyManifestImportForm;
import org.openelisglobal.notebook.service.BacteriologyManifestImportService.BacteriologyManifestRow;
import org.openelisglobal.notebook.service.BacteriologyManifestImportService.ParseError;
import org.openelisglobal.notebook.service.BacteriologyManifestImportService.ParsedManifest;
import org.openelisglobal.typeofsample.service.TypeOfSampleService;
import org.openelisglobal.typeofsample.valueholder.TypeOfSample;

/**
 * Unit tests for Bacteriology manifest parsing with barcode-only go-live
 * imports.
 */
@RunWith(MockitoJUnitRunner.Silent.class)
public class BacteriologyManifestImportServiceImplTest {

    @Mock
    private TypeOfSampleService typeOfSampleService;

    @InjectMocks
    private BacteriologyManifestImportServiceImpl bacteriologyManifestImportService;

    private BacteriologyManifestImportForm barcodeOnlyMapping;

    @Before
    public void setUp() {
        barcodeOnlyMapping = new BacteriologyManifestImportForm();
        barcodeOnlyMapping.setBarcodeColumn("sample_id");
    }

    @Test
    public void testParseManifestCsv_BarcodeOnlyRows_ReturnsRowsWithoutErrors() {
        String csv = "sample_id\n" + "BACT-001\n" + "BACT-002\n";

        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));

        ParsedManifest result = bacteriologyManifestImportService.parseManifestCsv(input, barcodeOnlyMapping);

        assertNotNull(result);
        assertEquals(2, result.rows().size());
        assertTrue(result.errors().isEmpty());

        BacteriologyManifestRow row1 = result.rows().get(0);
        assertEquals("BACT-001", row1.barcode());
        assertEquals("", row1.sampleType());
        assertEquals("", row1.sampleOrigin());
    }

    @Test
    public void testParseManifestCsv_MissingBarcode_ReturnsParseError() {
        String csv = "sample_id\n" + ",\n";

        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));

        ParsedManifest result = bacteriologyManifestImportService.parseManifestCsv(input, barcodeOnlyMapping);

        assertEquals(0, result.rows().size());
        assertEquals(1, result.errors().size());
        assertEquals("barcode", result.errors().get(0).column());
    }

    @Test
    public void testValidateSampleTypes_BlankSampleType_SkipsValidation() {
        BacteriologyManifestRow row = new BacteriologyManifestRow(2, null, null, null, "BACT-001", null, "", null, null,
                null, null, null, null, null, null, "", null);
        ParsedManifest manifest = new ParsedManifest(List.of(row), List.of());

        List<ParseError> errors = bacteriologyManifestImportService.validateSampleTypes(manifest);

        assertTrue(errors.isEmpty());
    }

    @Test
    public void testValidateSampleTypes_UnknownSampleType_ReturnsError() {
        BacteriologyManifestRow row = new BacteriologyManifestRow(2, null, null, null, "BACT-001", null, "Mystery Type",
                null, null, null, null, null, null, null, null, "", null);
        ParsedManifest manifest = new ParsedManifest(List.of(row), List.of());

        when(typeOfSampleService.getTypeOfSampleByDescriptionAndDomain(any(TypeOfSample.class), eq(true)))
                .thenReturn(null);

        List<ParseError> errors = bacteriologyManifestImportService.validateSampleTypes(manifest);

        assertEquals(1, errors.size());
        assertEquals("sampleType", errors.get(0).column());
    }
}
