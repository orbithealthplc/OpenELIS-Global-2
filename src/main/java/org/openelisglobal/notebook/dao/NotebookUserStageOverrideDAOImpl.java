package org.openelisglobal.notebook.dao;

import jakarta.persistence.TypedQuery;
import java.util.List;
import java.util.Optional;
import org.openelisglobal.common.daoimpl.BaseDAOImpl;
import org.openelisglobal.notebook.valueholder.NotebookUserStageOverride;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class NotebookUserStageOverrideDAOImpl extends BaseDAOImpl<NotebookUserStageOverride, Integer>
        implements NotebookUserStageOverrideDAO {

    public NotebookUserStageOverrideDAOImpl() {
        super(NotebookUserStageOverride.class);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotebookUserStageOverride> findBySystemUserId(Integer systemUserId) {
        TypedQuery<NotebookUserStageOverride> query = entityManager.createQuery(
                "SELECT o FROM NotebookUserStageOverride o WHERE o.systemUserId = :uid",
                NotebookUserStageOverride.class);
        query.setParameter("uid", systemUserId);
        return query.getResultList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<NotebookUserStageOverride> findBySystemUserIdAndLabUnit(Integer systemUserId, String labUnit) {
        TypedQuery<NotebookUserStageOverride> query = entityManager.createQuery(
                "SELECT o FROM NotebookUserStageOverride o WHERE o.systemUserId = :uid AND o.labUnit = :lab",
                NotebookUserStageOverride.class);
        query.setParameter("uid", systemUserId);
        query.setParameter("lab", labUnit);
        List<NotebookUserStageOverride> results = query.getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    @Override
    public void deleteBySystemUserId(Integer systemUserId) {
        // Hibernate in this deployment rejects bulk DELETE HQL ("query must begin with
        // SELECT or FROM"). Load + entity delete is the compatible path;
        // ElementCollection
        // pages cascade via orphanRemoval/FK ON DELETE CASCADE.
        List<NotebookUserStageOverride> existing = findBySystemUserId(systemUserId);
        for (NotebookUserStageOverride override : existing) {
            if (override.getPageKeys() != null) {
                override.getPageKeys().clear();
            }
            delete(override);
        }
    }
}
