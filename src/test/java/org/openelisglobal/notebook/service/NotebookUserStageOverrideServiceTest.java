package org.openelisglobal.notebook.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.openelisglobal.notebook.dao.NotebookUserStageOverrideDAO;
import org.openelisglobal.notebook.form.LabUnitStageAccessForm;
import org.openelisglobal.notebook.valueholder.NotebookUserStageOverride;
import org.openelisglobal.notebook.valueholder.NotebookUserStageOverride.Mode;

@RunWith(MockitoJUnitRunner.class)
public class NotebookUserStageOverrideServiceTest {

    @Mock
    private NotebookUserStageOverrideDAO overrideDAO;

    @InjectMocks
    private NotebookUserStageOverrideService service;

    @Before
    public void setUp() {
        // no-op
    }

    @Test
    public void evaluatePageAccess_NoOverride_ReturnsEmpty() {
        when(overrideDAO.findBySystemUserIdAndLabUnit(10, "168")).thenReturn(Optional.empty());
        assertFalse(service.evaluatePageAccess(10, "168", "reception").isPresent());
    }

    @Test
    public void evaluatePageAccess_AllMode_AllowsAnyPage() {
        NotebookUserStageOverride override = new NotebookUserStageOverride();
        override.setMode(Mode.ALL);
        when(overrideDAO.findBySystemUserIdAndLabUnit(10, "168")).thenReturn(Optional.of(override));
        assertEquals(Optional.of(Boolean.TRUE), service.evaluatePageAccess(10, "168", "disposal"));
    }

    @Test
    public void evaluatePageAccess_Allowlist_OnlyListedKeys() {
        NotebookUserStageOverride override = new NotebookUserStageOverride();
        override.setMode(Mode.ALLOWLIST);
        Set<String> keys = new HashSet<>();
        keys.add("reception");
        keys.add("lab_reception");
        override.setPageKeys(keys);
        when(overrideDAO.findBySystemUserIdAndLabUnit(10, "168")).thenReturn(Optional.of(override));
        assertEquals(Optional.of(Boolean.TRUE), service.evaluatePageAccess(10, "168", "reception"));
        assertEquals(Optional.of(Boolean.FALSE), service.evaluatePageAccess(10, "168", "disposal"));
    }

    @Test
    public void saveOverridesForUser_SkipsDefaultRows() {
        Map<String, LabUnitStageAccessForm> submitted = new HashMap<>();
        LabUnitStageAccessForm def = new LabUnitStageAccessForm();
        def.setMode("DEFAULT");
        submitted.put("168", def);

        LabUnitStageAccessForm all = new LabUnitStageAccessForm();
        all.setMode("ALL");
        submitted.put("177", all);

        service.saveOverridesForUser(42, submitted, "1");

        verify(overrideDAO).deleteBySystemUserId(42);
        ArgumentCaptor<NotebookUserStageOverride> captor = ArgumentCaptor.forClass(NotebookUserStageOverride.class);
        verify(overrideDAO).insert(captor.capture());
        assertEquals(Integer.valueOf(42), captor.getValue().getSystemUserId());
        assertEquals("177", captor.getValue().getLabUnit());
        assertEquals(Mode.ALL, captor.getValue().getMode());
        verify(overrideDAO, never()).insert(eq(null));
    }
}
