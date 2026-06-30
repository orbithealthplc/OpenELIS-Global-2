package org.openelisglobal.biorepository.service;

import java.util.List;
import java.util.Map;

public interface BiorepositoryQcRoundPlanService {

    void saveRoundPlan(String qcBatchId, List<Map<String, Object>> samples, String sysUserId);

    List<Map<String, Object>> getRoundPlanSamples(String qcBatchId);
}
