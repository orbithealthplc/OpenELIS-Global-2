package org.openelisglobal.biorepository.controller.rest.dto;

/**
 * Classifies duplicate Sample ID issues detected during manifest validation.
 */
public enum DuplicateIssue {
    NONE, IN_MANIFEST, IN_DATABASE
}
