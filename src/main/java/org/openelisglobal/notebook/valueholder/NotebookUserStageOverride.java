package org.openelisglobal.notebook.valueholder;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.HashSet;
import java.util.Set;
import org.openelisglobal.common.valueholder.BaseObject;

/**
 * Optional per-user override of notebook workflow stage access for one lab
 * unit.
 *
 * <p>
 * DEFAULT = SRS persona × registry matrix; ALL = every stage; ALLOWLIST =
 * selected page keys.
 */
@Entity
@Table(name = "notebook_user_stage_override", uniqueConstraints = {
        @UniqueConstraint(name = "uq_nuso_user_lab", columnNames = { "system_user_id", "lab_unit" }) })
public class NotebookUserStageOverride extends BaseObject<Integer> {

    public enum Mode {
        DEFAULT, ALL, ALLOWLIST
    }

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "notebook_user_stage_override_generator")
    @SequenceGenerator(name = "notebook_user_stage_override_generator", sequenceName = "notebook_user_stage_override_seq", allocationSize = 1)
    private Integer id;

    @Column(name = "system_user_id", nullable = false)
    private Integer systemUserId;

    @Column(name = "lab_unit", nullable = false, length = 64)
    private String labUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false, length = 32)
    private Mode mode = Mode.DEFAULT;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "notebook_user_stage_override_page", joinColumns = @JoinColumn(name = "override_id"))
    @Column(name = "page_key", length = 128)
    private Set<String> pageKeys = new HashSet<>();

    @Override
    public Integer getId() {
        return id;
    }

    @Override
    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getSystemUserId() {
        return systemUserId;
    }

    public void setSystemUserId(Integer systemUserId) {
        this.systemUserId = systemUserId;
    }

    public String getLabUnit() {
        return labUnit;
    }

    public void setLabUnit(String labUnit) {
        this.labUnit = labUnit;
    }

    public Mode getMode() {
        return mode;
    }

    public void setMode(Mode mode) {
        this.mode = mode == null ? Mode.DEFAULT : mode;
    }

    public Set<String> getPageKeys() {
        return pageKeys;
    }

    public void setPageKeys(Set<String> pageKeys) {
        this.pageKeys = pageKeys == null ? new HashSet<>() : pageKeys;
    }
}
