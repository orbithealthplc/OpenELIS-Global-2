package org.openelisglobal.biorepository.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.openelisglobal.biorepository.dao.BiorepositoryQcRoundPlanDAO;
import org.openelisglobal.biorepository.valueholder.BiorepositoryQcRoundPlan;

@RunWith(MockitoJUnitRunner.class)
public class BiorepositoryQcRoundPlanServiceTest {

    @Mock
    private BiorepositoryQcRoundPlanDAO roundPlanDAO;

    @InjectMocks
    private BiorepositoryQcRoundPlanServiceImpl roundPlanService;

    @Test
    public void saveAndLoadRoundPlan_PreservesSamples() {
        when(roundPlanDAO.get("QCBATCH-1")).thenReturn(Optional.empty());
        List<Map<String, Object>> samples = List.of(Map.of("bioSampleId", 7, "accessionNumber", "ACC-7"));

        roundPlanService.saveRoundPlan("QCBATCH-1", samples, "user-1");

        ArgumentCaptor<BiorepositoryQcRoundPlan> captor = ArgumentCaptor.forClass(BiorepositoryQcRoundPlan.class);
        verify(roundPlanDAO).insert(captor.capture());
        BiorepositoryQcRoundPlan saved = captor.getValue();
        when(roundPlanDAO.get("QCBATCH-1")).thenReturn(Optional.of(saved));

        List<Map<String, Object>> loaded = roundPlanService.getRoundPlanSamples("QCBATCH-1");
        assertEquals(1, loaded.size());
        assertEquals(7, ((Number) loaded.get(0).get("bioSampleId")).intValue());
        assertEquals("ACC-7", loaded.get(0).get("accessionNumber"));
        assertTrue(saved.getSamplesJson().contains("ACC-7"));
    }
}
