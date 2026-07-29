package org.openelisglobal.notebook.controller.rest;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.Before;
import org.junit.Test;
import org.openelisglobal.BaseWebContextSensitiveTest;
import org.openelisglobal.common.action.IActionConstants;
import org.openelisglobal.login.valueholder.UserSessionData;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.web.servlet.MvcResult;

@Rollback
public class MNTDManifestImportControllerTest extends BaseWebContextSensitiveTest {

    private static final String CSV_HEADER = "projectName,sampleType,sampleIdTag,numberOfSamples,"
            + "sampleSourceLocation,broughtBy,receivedDateTime,receptionistName";

    private static final String MAPPING_JSON = "{" + "\"projectNameColumn\":\"projectName\","
            + "\"sampleIdTagColumn\":\"sampleIdTag\"," + "\"numberOfSamplesColumn\":\"numberOfSamples\","
            + "\"sampleSourceLocationColumn\":\"sampleSourceLocation\"," + "\"broughtByColumn\":\"broughtBy\","
            + "\"receivedDateTimeColumn\":\"receivedDateTime\"," + "\"receptionistNameColumn\":\"receptionistName\","
            + "\"sampleTypeColumn\":\"sampleType\"" + "}";

    private ObjectMapper objectMapper;
    private MockHttpSession mockSession;

    @Before
    public void setUp() throws Exception {
        super.setUp();
        executeDataSetWithStateManagement("testdata/mntd-manifest-import-test-data.xml");
        objectMapper = new ObjectMapper();

        mockSession = new MockHttpSession();
        UserSessionData userSessionData = new UserSessionData();
        userSessionData.setSytemUserId(1);
        userSessionData.setLoginName("admin");
        userSessionData.setAdmin(true);
        mockSession.setAttribute(IActionConstants.USER_SESSION_DATA, userSessionData);
    }

    @Test
    public void previewManifest_childInstanceInheritsTemplatePages_returns200WithRows() throws Exception {
        MvcResult result = performPreview(8801);
        assertPreviewSuccess(result);
    }

    @Test
    public void previewManifest_instanceWithLocalPages_returns200WithRows() throws Exception {
        MvcResult result = performPreview(8802);
        assertPreviewSuccess(result);
    }

    private MvcResult performPreview(int entryId) throws Exception {
        String csvContent = CSV_HEADER + "\n"
                + "Test Project,Whole Blood,TAG-001,1,Jimma Zone,Dr Test,2024-06-15 09:30,Receiver";

        MockMultipartFile file = new MockMultipartFile("file", "mntd-manifest.csv", "text/csv",
                csvContent.getBytes(StandardCharsets.UTF_8));
        MockMultipartFile mapping = new MockMultipartFile("mapping", "mapping.json", "application/json",
                MAPPING_JSON.getBytes(StandardCharsets.UTF_8));

        return mockMvc.perform(multipart("/rest/notebook/mntd/entry/" + entryId + "/samples/preview-manifest")
                .file(file).file(mapping).session(mockSession).accept(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    private void assertPreviewSuccess(MvcResult result) throws Exception {
        int status = result.getResponse().getStatus();
        assertEquals("Preview should return 200 OK", 200, status);

        Map<String, Object> response = objectMapper.readValue(result.getResponse().getContentAsString(),
                new TypeReference<Map<String, Object>>() {
                });

        assertNotNull("Response should not be null", response);
        assertTrue("Response should contain rows", response.containsKey("rows"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) response.get("rows");
        assertEquals("Should parse one manifest row", 1, rows.size());
        assertEquals("TAG-001", rows.get(0).get("sampleId"));
    }
}
