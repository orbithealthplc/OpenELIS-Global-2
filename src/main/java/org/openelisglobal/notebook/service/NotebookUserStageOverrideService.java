package org.openelisglobal.notebook.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.openelisglobal.notebook.dao.NotebookUserStageOverrideDAO;
import org.openelisglobal.notebook.form.LabUnitStageAccessForm;
import org.openelisglobal.notebook.valueholder.NotebookUserStageOverride;
import org.openelisglobal.notebook.valueholder.NotebookUserStageOverride.Mode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class NotebookUserStageOverrideService {

    @Autowired
    private NotebookUserStageOverrideDAO overrideDAO;

    @Transactional(readOnly = true)
    public Map<String, LabUnitStageAccessForm> getOverridesForUserAsFormMap(String systemUserId) {
        Map<String, LabUnitStageAccessForm> result = new HashMap<>();
        if (systemUserId == null || systemUserId.isBlank()) {
            return result;
        }
        Integer uid;
        try {
            uid = Integer.valueOf(systemUserId);
        } catch (NumberFormatException e) {
            return result;
        }
        for (NotebookUserStageOverride override : overrideDAO.findBySystemUserId(uid)) {
            LabUnitStageAccessForm form = new LabUnitStageAccessForm();
            form.setMode(override.getMode() == null ? Mode.DEFAULT.name() : override.getMode().name());
            form.setPageKeys(override.getPageKeys() == null ? new HashSet<>() : new HashSet<>(override.getPageKeys()));
            result.put(override.getLabUnit(), form);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Optional<NotebookUserStageOverride> findOverride(Integer systemUserId, String labUnit) {
        if (systemUserId == null || labUnit == null || labUnit.isBlank()) {
            return Optional.empty();
        }
        return overrideDAO.findBySystemUserIdAndLabUnit(systemUserId, labUnit.trim());
    }

    /**
     * Replace all stage overrides for a user with the submitted map (labUnitId →
     * config). DEFAULT / empty entries are omitted (no DB row = DEFAULT behavior).
     */
    public void saveOverridesForUser(Integer systemUserId, Map<String, LabUnitStageAccessForm> submitted,
            String loggedOnUserId) {
        if (systemUserId == null) {
            return;
        }
        overrideDAO.deleteBySystemUserId(systemUserId);
        if (submitted == null || submitted.isEmpty()) {
            return;
        }
        for (Map.Entry<String, LabUnitStageAccessForm> entry : submitted.entrySet()) {
            String labUnit = entry.getKey();
            LabUnitStageAccessForm form = entry.getValue();
            if (labUnit == null || labUnit.isBlank() || "AllLabUnits".equalsIgnoreCase(labUnit.trim())
                    || form == null) {
                continue;
            }
            Mode mode = parseMode(form.getMode());
            if (mode == Mode.DEFAULT) {
                continue;
            }
            NotebookUserStageOverride override = new NotebookUserStageOverride();
            override.setSystemUserId(systemUserId);
            override.setLabUnit(labUnit.trim());
            override.setMode(mode);
            override.setSysUserId(loggedOnUserId);
            if (mode == Mode.ALLOWLIST) {
                Set<String> keys = new HashSet<>();
                if (form.getPageKeys() != null) {
                    for (String key : form.getPageKeys()) {
                        if (key != null && !key.isBlank()) {
                            keys.add(key.trim());
                        }
                    }
                }
                override.setPageKeys(keys);
            } else {
                override.setPageKeys(new HashSet<>());
            }
            overrideDAO.insert(override);
        }
    }

    /**
     * Whether the user may access the given page key under their override for the
     * lab unit. Empty optional means no override (caller uses DEFAULT persona
     * logic). If present: true/false is the override decision (ALL / ALLOWLIST).
     */
    @Transactional(readOnly = true)
    public Optional<Boolean> evaluatePageAccess(Integer systemUserId, String labUnit, String pageKey) {
        Optional<NotebookUserStageOverride> opt = findOverride(systemUserId, labUnit);
        if (opt.isEmpty()) {
            return Optional.empty();
        }
        NotebookUserStageOverride override = opt.get();
        Mode mode = override.getMode() == null ? Mode.DEFAULT : override.getMode();
        if (mode == Mode.DEFAULT) {
            return Optional.empty();
        }
        if (mode == Mode.ALL) {
            return Optional.of(Boolean.TRUE);
        }
        // ALLOWLIST
        if (pageKey == null || pageKey.isBlank()) {
            return Optional.of(Boolean.FALSE);
        }
        Set<String> keys = override.getPageKeys();
        if (keys == null || keys.isEmpty()) {
            return Optional.of(Boolean.FALSE);
        }
        String normalized = pageKey.trim();
        boolean match = keys.stream().anyMatch(k -> k != null && k.trim().equalsIgnoreCase(normalized));
        return Optional.of(match);
    }

    @Transactional(readOnly = true)
    public LabUnitStageAccessForm getEffectiveFormForLabUnit(Integer systemUserId, String labUnit) {
        LabUnitStageAccessForm form = new LabUnitStageAccessForm();
        form.setMode(Mode.DEFAULT.name());
        form.setPageKeys(new HashSet<>());
        Optional<NotebookUserStageOverride> opt = findOverride(systemUserId, labUnit);
        if (opt.isEmpty()) {
            return form;
        }
        NotebookUserStageOverride override = opt.get();
        form.setMode(override.getMode() == null ? Mode.DEFAULT.name() : override.getMode().name());
        form.setPageKeys(override.getPageKeys() == null ? new HashSet<>() : new HashSet<>(override.getPageKeys()));
        return form;
    }

    private Mode parseMode(String raw) {
        if (raw == null || raw.isBlank()) {
            return Mode.DEFAULT;
        }
        try {
            return Mode.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return Mode.DEFAULT;
        }
    }

    @Transactional(readOnly = true)
    public List<NotebookUserStageOverride> listForUser(Integer systemUserId) {
        return overrideDAO.findBySystemUserId(systemUserId);
    }
}
