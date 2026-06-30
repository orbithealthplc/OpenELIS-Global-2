package org.openelisglobal.biorepository.valueholder;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import org.openelisglobal.common.valueholder.BaseObject;

/**
 * Persisted snapshot of samples selected for a biorepository QC round. Used to
 * render inspection worksheets (PDF/CSV) before inspections are recorded.
 */
@Entity
@Table(name = "biorepository_qc_round_plan", schema = "clinlims")
public class BiorepositoryQcRoundPlan extends BaseObject<String> {

    @Id
    @Column(name = "qc_batch_id", length = 80)
    private String qcBatchId;

    @NotNull
    @Column(name = "samples_json", nullable = false, columnDefinition = "TEXT")
    private String samplesJson;

    @Override
    public String getId() {
        return qcBatchId;
    }

    @Override
    public void setId(String id) {
        this.qcBatchId = id;
    }

    public String getQcBatchId() {
        return qcBatchId;
    }

    public void setQcBatchId(String qcBatchId) {
        this.qcBatchId = qcBatchId;
    }

    public String getSamplesJson() {
        return samplesJson;
    }

    public void setSamplesJson(String samplesJson) {
        this.samplesJson = samplesJson;
    }
}
