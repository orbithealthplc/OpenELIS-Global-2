package org.openelisglobal.biorepository.controller.rest.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class QcWorksheetExportRequest {

    private String qcBatchId;
    private List<Map<String, Object>> samples = new ArrayList<>();

    public String getQcBatchId() {
        return qcBatchId;
    }

    public void setQcBatchId(String qcBatchId) {
        this.qcBatchId = qcBatchId;
    }

    public List<Map<String, Object>> getSamples() {
        return samples;
    }

    public void setSamples(List<Map<String, Object>> samples) {
        this.samples = samples != null ? samples : new ArrayList<>();
    }
}
