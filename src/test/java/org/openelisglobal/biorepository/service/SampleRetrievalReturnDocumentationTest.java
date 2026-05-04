package org.openelisglobal.biorepository.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class SampleRetrievalReturnDocumentationTest {

    @Test
    public void validateReturnDocumentation_allowsIntactWithoutNotes() {
        SampleRetrievalServiceImpl.validateReturnDocumentation("Intact", "", false);
    }

    @Test(expected = IllegalArgumentException.class)
    public void validateReturnDocumentation_rejectsDeviatedWithoutNotes() {
        SampleRetrievalServiceImpl.validateReturnDocumentation("Deviated - Damaged", " ", false);
    }

    @Test(expected = IllegalArgumentException.class)
    public void validateReturnDocumentation_rejectsConsumedWithoutNotes() {
        SampleRetrievalServiceImpl.validateReturnDocumentation("Consumed", null, true);
    }

    @Test
    public void buildReturnCustodyLogNotes_includesConditionAndNotes() {
        String notes = SampleRetrievalServiceImpl.buildReturnCustodyLogNotes("Deviated - Thawed",
                "Ice pack failed", false);

        assertTrue(notes.contains("Return condition: Deviated - Thawed"));
        assertTrue(notes.contains("Notes: Ice pack failed"));
    }

    @Test
    public void buildReturnCustodyLogNotes_trimsInputs() {
        assertEquals("Return condition: Intact | Notes: Back in storage",
                SampleRetrievalServiceImpl.buildReturnCustodyLogNotes(" Intact ", " Back in storage ", false));
    }
}
