package org.openelisglobal.medlab.service;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.openelisglobal.notebook.valueholder.NoteBookPage;

public class MedLabWorkflowPageResolutionTest {

    @Test
    public void matchesCanonicalPageId() {
        NoteBookPage page = new NoteBookPage();
        page.setPageId("medlab-quality-check");

        assertTrue(MedLabPatientOrderServiceImpl.isMedLabWorkflowPage(page, 3, "Sample Receipt & Quality Assessment",
                "quality-check", "medlab-quality-check"));
    }

    @Test
    public void fallsBackToTitleAndOrderWhenClonedPageIdIsBlank() {
        NoteBookPage page = new NoteBookPage();
        page.setOrder(3);
        page.setTitle("Sample Receipt & Quality Assessment");

        assertTrue(MedLabPatientOrderServiceImpl.isMedLabWorkflowPage(page, 3, "Sample Receipt & Quality Assessment",
                "quality-check", "medlab-quality-check"));
    }

    @Test
    public void doesNotMatchWrongStage() {
        NoteBookPage page = new NoteBookPage();
        page.setOrder(4);
        page.setTitle("Sample Routing");

        assertFalse(MedLabPatientOrderServiceImpl.isMedLabWorkflowPage(page, 3, "Sample Receipt & Quality Assessment",
                "quality-check", "medlab-quality-check"));
    }
}
