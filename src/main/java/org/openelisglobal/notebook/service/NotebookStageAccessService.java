package org.openelisglobal.notebook.service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.hibernate.Hibernate;
import org.openelisglobal.common.constants.Constants;
import org.openelisglobal.common.constants.rbac.AHRIRoleCatalog;
import org.openelisglobal.department.service.DepartmentIsolationService;
import org.openelisglobal.notebook.valueholder.NoteBook;
import org.openelisglobal.notebook.valueholder.NoteBookPage;
import org.openelisglobal.notebook.valueholder.NotebookEntry;
import org.openelisglobal.notebook.valueholder.NotebookStageAction;
import org.openelisglobal.role.service.RoleService;
import org.openelisglobal.role.valueholder.Role;
import org.openelisglobal.userrole.service.UserRoleService;
import org.openelisglobal.userrole.valueholder.LabUnitRoleMap;
import org.openelisglobal.userrole.valueholder.UserLabUnitRoles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Department ownership first, SRS persona + stage action second.
 * Project/notebook metadata does not grant department ownership.
 */
@Service
public class NotebookStageAccessService {

    @Autowired
    private WorkflowRegistryService workflowRegistryService;

    @Autowired
    private NoteBookPageService noteBookPageService;

    @Autowired
    private RoleService roleService;

    @Autowired
    private UserRoleService userRoleService;

    @Autowired
    private DepartmentIsolationService departmentIsolationService;

    @Autowired
    private NotebookUserStageOverrideService stageOverrideService;

    @Transactional(readOnly = true)
    public void assertActiveDepartment(HttpServletRequest request) {
        if (isUnrestricted(request)) {
            return;
        }
        if (departmentIsolationService.getRestrictedUserTestSectionIds(request).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Select an active department first");
        }
    }

    @Transactional(readOnly = true)
    public void assertNotebookWorkflowAccess(HttpServletRequest request, NoteBook notebook) {
        assertActiveDepartment(request);
        if (notebook == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notebook is required");
        }
        departmentIsolationService.assertNotebookDepartmentAccess(request, notebook);
    }

    @Transactional(readOnly = true)
    public void assertStageAccessForPageId(HttpServletRequest request, Integer pageId, NotebookStageAction action) {
        NoteBookPage page = requirePage(pageId);
        NoteBook notebook = requireNotebook(page);
        assertStageAccess(request, notebook, page, action);
    }

    /**
     * MNTD manifest import guard: resolve intake page (order 1) from effective
     * pages (child instances inherit template pages) then enforce stage EDIT
     * access.
     */
    @Transactional(readOnly = true)
    public void assertMntdManifestIntakeEdit(HttpServletRequest request, NotebookEntry entry) {
        if (entry == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notebook entry is required");
        }
        NoteBook notebook = entry.getNotebook();
        if (notebook == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notebook entry has no notebook");
        }
        Hibernate.initialize(notebook);
        Hibernate.initialize(notebook.getPages());
        if (notebook.isChildInstance() && notebook.getParentNotebook() != null) {
            Hibernate.initialize(notebook.getParentNotebook());
            Hibernate.initialize(notebook.getParentNotebook().getPages());
        }

        java.util.List<NoteBookPage> pages = notebook.getEffectivePages();
        NoteBookPage intakePage = pages == null ? null
                : pages.stream().filter(page -> page.getOrder() != null && page.getOrder() == 1).findFirst()
                        .orElse(null);
        if (intakePage == null || intakePage.getId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MNTD intake page not found");
        }
        assertStageAccessForPageId(request, intakePage.getId(), NotebookStageAction.EDIT);
    }

    @Transactional(readOnly = true)
    public void assertPersonaForPage(HttpServletRequest request, NoteBook notebook, Integer pageId) {
        NoteBookPage page = requirePage(pageId);
        assertStageAccess(request, notebook, page, NotebookStageAction.COMPLETE);
    }

    @Transactional(readOnly = true)
    public void assertStageAccess(HttpServletRequest request, NoteBook notebook, NoteBookPage page,
            NotebookStageAction action) {
        assertNotebookWorkflowAccess(request, notebook);
        // Global Admin / AllLabUnits may open any department notebook, but scientific
        // COMPLETE still requires a lab-unit persona (or Lab Manager on that lab) — do
        // not
        // bypass. Use name() so hot-deploy / classloader identity cannot skip the
        // check.
        boolean completeAction = action != null && NotebookStageAction.COMPLETE.name().equals(action.name());
        if (isUnrestricted(request) && !completeAction) {
            return;
        }
        // Hard gate: unrestricted accounts (Global Administrator / AllLabUnits) must
        // not
        // COMPLETE scientific stages. Their system_user_role soup often includes Lab
        // Manager
        // / Sample Collector without a real lab-unit post.
        if (completeAction && isUnrestricted(request)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Unrestricted administrators cannot COMPLETE notebook stages; use a department persona account");
        }

        String pageKey = NotebookPageKeyResolver.resolvePageKey(page);
        int order = page.getOrder() != null ? page.getOrder() : 0;
        String workflowType = notebook.getWorkflowType();

        if (action != null && !workflowRegistryService.isActionPermitted(workflowType, pageKey, order, action)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Action " + action + " is not permitted for this workflow stage");
        }

        String sysUserId = departmentIsolationService.getSysUserId(request);
        // COMPLETE must not honor legacy Global Administrator role soup on
        // system_user_role (often includes Lab Manager / Sample Collector). Only
        // personas on the active login lab unit count for scientific completion.
        Set<String> userPersonas = completeAction ? getLabUnitScopedDepartmentPersonaNames(request, sysUserId)
                : getUserDepartmentPersonaNames(request, sysUserId);
        if (userPersonas.contains(AHRIRoleCatalog.normalizeRoleName(Constants.ROLE_LAB_MANAGER))) {
            return;
        }

        // Optional admin override: ALL / ALLOWLIST for this user + active lab unit
        Integer userId = parseUserId(sysUserId);
        String loginLabUnitId = resolveLoginLabUnitId(request);
        if (userId != null && loginLabUnitId != null) {
            var overrideDecision = stageOverrideService.evaluatePageAccess(userId, loginLabUnitId, pageKey);
            if (overrideDecision.isPresent()) {
                if (Boolean.TRUE.equals(overrideDecision.get())) {
                    return;
                }
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Stage not included in this user's lab-unit stage access allowlist");
            }
        }

        List<String> allowedPersonas = resolveAllowedPersonas(notebook, page, action);
        if (allowedPersonas.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No SRS personas configured for this workflow stage");
        }

        boolean allowed = allowedPersonas.stream()
                .anyMatch(persona -> userPersonas.contains(AHRIRoleCatalog.normalizeRoleName(persona)));
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient lab role for this workflow stage");
        }
    }

    private Integer parseUserId(String sysUserId) {
        if (sysUserId == null || sysUserId.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(sysUserId.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String resolveLoginLabUnitId(HttpServletRequest request) {
        try {
            Object usd = request.getSession()
                    .getAttribute(org.openelisglobal.common.action.IActionConstants.USER_SESSION_DATA);
            if (usd instanceof org.openelisglobal.login.valueholder.UserSessionData sessionData
                    && sessionData.getLoginLabUnit() > 0) {
                return String.valueOf(sessionData.getLoginLabUnit());
            }
        } catch (Exception ignored) {
            // fall through
        }
        String loginLabUnit = departmentIsolationService.getLoginLabUnit(request);
        return (loginLabUnit == null || loginLabUnit.isBlank()) ? null : loginLabUnit.trim();
    }

    private List<String> resolveAllowedPersonas(NoteBook notebook, NoteBookPage page, NotebookStageAction action) {
        Set<String> pageRoles = page.getAllowedRoles();
        List<String> explicit = pageRoles == null ? List.of()
                : pageRoles.stream().filter(AHRIRoleCatalog::isDepartmentRoleName).collect(Collectors.toList());

        String workflowType = notebook.getWorkflowType();
        String pageKey = NotebookPageKeyResolver.resolvePageKey(page);
        int order = page.getOrder() != null ? page.getOrder() : 0;

        return workflowRegistryService.resolveAllowedPersonasForAction(workflowType, pageKey, order, order, action,
                explicit);
    }

    private NoteBookPage requirePage(Integer pageId) {
        NoteBookPage page = noteBookPageService.get(pageId);
        if (page == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notebook page not found");
        }
        return page;
    }

    private NoteBook requireNotebook(NoteBookPage page) {
        NoteBook notebook = page.getNotebook();
        if (notebook == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notebook page has no parent notebook");
        }
        return notebook;
    }

    private Set<String> getUserDepartmentPersonaNames(HttpServletRequest request, String sysUserId) {
        Set<String> names = new HashSet<>();
        if (sysUserId == null) {
            return names;
        }

        addDepartmentPersonaNames(names, userRoleService.getRoleIdsForUser(sysUserId));
        names.addAll(getLabUnitScopedDepartmentPersonaNames(request, sysUserId));
        return names;
    }

    /**
     * Department personas assigned on the user's active login lab unit only. Skips
     * AllLabUnits and global system_user_role rows (legacy Global Administrator
     * grants often include Lab Manager / Results Entry without a real lab post).
     */
    private Set<String> getLabUnitScopedDepartmentPersonaNames(HttpServletRequest request, String sysUserId) {
        Set<String> names = new HashSet<>();
        if (sysUserId == null) {
            return names;
        }

        UserLabUnitRoles labRoles = userRoleService.getUserLabUnitRoles(sysUserId);
        if (labRoles == null || labRoles.getLabUnitRoleMap() == null) {
            return names;
        }

        for (LabUnitRoleMap map : labRoles.getLabUnitRoleMap()) {
            if (map == null || map.getRoles() == null || map.getLabUnit() == null) {
                continue;
            }
            String mapped = map.getLabUnit().trim();
            // AllLabUnits is for admin role assignment only — not an owning department
            // scope.
            if ("AllLabUnits".equalsIgnoreCase(mapped)) {
                continue;
            }
            if (departmentIsolationService.activeLoginLabUnitMatches(request, mapped)) {
                addDepartmentPersonaNames(names, map.getRoles());
            }
        }
        return names;
    }

    private void addDepartmentPersonaNames(Set<String> names, Collection<String> roleIds) {
        if (roleIds == null) {
            return;
        }
        for (String roleId : roleIds) {
            if (roleId == null || roleId.isBlank()) {
                continue;
            }
            Role role = roleService.getRoleById(roleId);
            if (role != null && AHRIRoleCatalog.isDepartmentRoleName(role.getName())) {
                names.add(AHRIRoleCatalog.normalizeRoleName(role.getName()));
            }
        }
    }

    private boolean isUnrestricted(HttpServletRequest request) {
        return departmentIsolationService.hasUnrestrictedDepartmentAccess(request);
    }
}
