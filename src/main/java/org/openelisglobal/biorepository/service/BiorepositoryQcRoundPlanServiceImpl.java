package org.openelisglobal.biorepository.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.openelisglobal.biorepository.dao.BiorepositoryQcRoundPlanDAO;
import org.openelisglobal.biorepository.valueholder.BiorepositoryQcRoundPlan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BiorepositoryQcRoundPlanServiceImpl implements BiorepositoryQcRoundPlanService {

    private static final TypeReference<List<Map<String, Object>>> SAMPLE_LIST_TYPE = new TypeReference<>() {
    };

    @Autowired
    private BiorepositoryQcRoundPlanDAO roundPlanDAO;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    @Transactional
    public void saveRoundPlan(String qcBatchId, List<Map<String, Object>> samples, String sysUserId) {
        if (qcBatchId == null || qcBatchId.isBlank()) {
            throw new IllegalArgumentException("qcBatchId is required");
        }
        if (samples == null || samples.isEmpty()) {
            throw new IllegalArgumentException("samples are required");
        }
        try {
            String batchKey = qcBatchId.trim();
            BiorepositoryQcRoundPlan plan = roundPlanDAO.get(batchKey).orElse(null);
            if (plan == null) {
                plan = new BiorepositoryQcRoundPlan();
                plan.setQcBatchId(batchKey);
                plan.setSamplesJson(objectMapper.writeValueAsString(samples));
                plan.setSysUserId(sysUserId);
                roundPlanDAO.insert(plan);
            } else {
                plan.setSamplesJson(objectMapper.writeValueAsString(samples));
                plan.setSysUserId(sysUserId);
                roundPlanDAO.update(plan);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to persist QC round plan", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRoundPlanSamples(String qcBatchId) {
        if (qcBatchId == null || qcBatchId.isBlank()) {
            return Collections.emptyList();
        }
        BiorepositoryQcRoundPlan plan = roundPlanDAO.get(qcBatchId.trim()).orElse(null);
        if (plan == null || plan.getSamplesJson() == null || plan.getSamplesJson().isBlank()) {
            return Collections.emptyList();
        }
        try {
            List<Map<String, Object>> samples = objectMapper.readValue(plan.getSamplesJson(), SAMPLE_LIST_TYPE);
            return samples != null ? samples : Collections.emptyList();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to read QC round plan for batch " + qcBatchId, e);
        }
    }
}
