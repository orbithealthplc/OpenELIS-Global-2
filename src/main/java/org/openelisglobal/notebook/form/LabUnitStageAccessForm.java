package org.openelisglobal.notebook.form;

import java.util.HashSet;
import java.util.Set;

/**
 * Admin UI DTO: stage access mode for one lab unit assignment on a user.
 */
public class LabUnitStageAccessForm {

    /** DEFAULT | ALL | ALLOWLIST */
    private String mode = "DEFAULT";

    private Set<String> pageKeys = new HashSet<>();

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Set<String> getPageKeys() {
        return pageKeys;
    }

    public void setPageKeys(Set<String> pageKeys) {
        this.pageKeys = pageKeys == null ? new HashSet<>() : pageKeys;
    }
}
