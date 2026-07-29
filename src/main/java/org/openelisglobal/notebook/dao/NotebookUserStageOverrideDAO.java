package org.openelisglobal.notebook.dao;

import java.util.List;
import java.util.Optional;
import org.openelisglobal.common.dao.BaseDAO;
import org.openelisglobal.notebook.valueholder.NotebookUserStageOverride;

public interface NotebookUserStageOverrideDAO extends BaseDAO<NotebookUserStageOverride, Integer> {

    List<NotebookUserStageOverride> findBySystemUserId(Integer systemUserId);

    Optional<NotebookUserStageOverride> findBySystemUserIdAndLabUnit(Integer systemUserId, String labUnit);

    void deleteBySystemUserId(Integer systemUserId);
}
