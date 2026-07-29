package org.openelisglobal.notebook.service;

import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.openelisglobal.common.constants.Constants;
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
import org.springframework.web.server.ResponseStatusException;

/**
 * MNTD SRS persona matrix: intake registration, lab manager override,
 * biomedical denial.
 */
@RunWith(MockitoJUnitRunner.class)
public class MNTDStageAccessMatrixTest {

    @Mock
    private WorkflowRegistryService workflowRegistryService;

    @Mock
    private NoteBookPageService noteBookPageService;

    @Mock
    private RoleService roleService;

    @Mock
    private UserRoleService userRoleService;

    @Mock
    private DepartmentIsolationService departmentIsolationService;

    @Mock
    private HttpServletRequest request;

    @InjectMocks
    private NotebookStageAccessService service;

    private NoteBook notebook;
    private NoteBookPage intakePage;
    private NoteBookPage archivingPage;
    private NoteBookPage reportingPage;

    @Before
    public void setUp() {
        notebook = new NoteBook();
        notebook.setWorkflowType("mntd");

        intakePage = page(1, "intake");
        archivingPage = page(9, "archiving");
        reportingPage = page(11, "reporting");
    }

    @Test
    public void sampleCollector_allowedOnMntdIntake() {
        stubRestrictedUser("177", "r-sc");
        when(roleService.getRoleById("r-sc")).thenReturn(role(Constants.ROLE_SAMPLE_COLLECTOR));
        when(workflowRegistryService.isActionPermitted("mntd", "intake", 1, NotebookStageAction.EDIT)).thenReturn(true);
        when(workflowRegistryService.resolveAllowedPersonasForAction(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(Constants.ROLE_SAMPLE_COLLECTOR, Constants.ROLE_LABORATORY_TECHNICIAN,
                        Constants.ROLE_LAB_MANAGER));

        service.assertStageAccess(request, notebook, intakePage, NotebookStageAction.EDIT);
    }

    @Test
    public void labManagerOnly_allowedOnMntdIntakeViaSupervisorOverride() {
        stubRestrictedUser("177", "r-lm");
        when(roleService.getRoleById("r-lm")).thenReturn(role(Constants.ROLE_LAB_MANAGER));
        when(workflowRegistryService.isActionPermitted("mntd", "intake", 1, NotebookStageAction.EDIT)).thenReturn(true);
        when(workflowRegistryService.resolveAllowedPersonasForAction(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(Constants.ROLE_SAMPLE_COLLECTOR, Constants.ROLE_LABORATORY_TECHNICIAN));

        service.assertStageAccess(request, notebook, intakePage, NotebookStageAction.EDIT);
    }

    @Test
    public void juniorResearcher_deniedOnMntdIntake() {
        stubRestrictedUser("177", "r-jr");
        when(roleService.getRoleById("r-jr")).thenReturn(role(Constants.ROLE_JUNIOR_RESEARCHER));
        when(workflowRegistryService.isActionPermitted("mntd", "intake", 1, NotebookStageAction.EDIT)).thenReturn(true);
        when(workflowRegistryService.resolveAllowedPersonasForAction(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(Constants.ROLE_SAMPLE_COLLECTOR, Constants.ROLE_LABORATORY_TECHNICIAN));

        assertThrows(ResponseStatusException.class,
                () -> service.assertStageAccess(request, notebook, intakePage, NotebookStageAction.EDIT));
    }

    @Test
    public void biomedicalStaff_deniedOnMntdIntake() {
        stubRestrictedUser("177", "r-bio");
        when(roleService.getRoleById("r-bio")).thenReturn(role(Constants.ROLE_BIOMEDICAL_STAFF));
        when(workflowRegistryService.isActionPermitted("mntd", "intake", 1, NotebookStageAction.EDIT)).thenReturn(true);
        when(workflowRegistryService.resolveAllowedPersonasForAction(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(Constants.ROLE_SAMPLE_COLLECTOR, Constants.ROLE_LABORATORY_TECHNICIAN));

        assertThrows(ResponseStatusException.class,
                () -> service.assertStageAccess(request, notebook, intakePage, NotebookStageAction.EDIT));
    }

    @Test
    public void assertMntdManifestIntakeEdit_childInstanceInheritsTemplateIntakePage() {
        when(departmentIsolationService.hasUnrestrictedDepartmentAccess(request)).thenReturn(true);

        NoteBook template = new NoteBook();
        template.setId(8801);
        template.setWorkflowType("mntd");
        template.setIsTemplate(true);
        template.getPages().add(page(1, "intake"));

        NoteBook child = new NoteBook();
        child.setId(8802);
        child.setWorkflowType("mntd");
        child.setIsTemplate(false);
        child.setParentNotebook(template);

        NotebookEntry entry = new NotebookEntry();
        entry.setId(8801);
        entry.setNotebook(child);

        when(noteBookPageService.get(1)).thenReturn(template.getPages().get(0));
        doNothing().when(departmentIsolationService).assertNotebookDepartmentAccess(any(), any());

        service.assertMntdManifestIntakeEdit(request, entry);
    }

    @Test
    public void assertMntdManifestIntakeEdit_missingIntakePage_returnsBadRequest() {
        NoteBook notebook = new NoteBook();
        notebook.setId(8803);
        notebook.setWorkflowType("mntd");
        notebook.setIsTemplate(false);

        NotebookEntry entry = new NotebookEntry();
        entry.setNotebook(notebook);

        assertThrows(ResponseStatusException.class, () -> service.assertMntdManifestIntakeEdit(request, entry));
    }

    @Test
    public void labManager_allowedOnMntdArchiving() {
        stubRestrictedUser("177", "r-lm");
        when(roleService.getRoleById("r-lm")).thenReturn(role(Constants.ROLE_LAB_MANAGER));
        when(workflowRegistryService.isActionPermitted("mntd", "archiving", 9, NotebookStageAction.EDIT))
                .thenReturn(true);
        when(workflowRegistryService.resolveAllowedPersonasForAction(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(Constants.ROLE_LAB_MANAGER));

        service.assertStageAccess(request, notebook, archivingPage, NotebookStageAction.EDIT);
    }

    @Test
    public void seniorResearcher_allowedOnMntdReporting() {
        stubRestrictedUser("177", "r-sr");
        when(roleService.getRoleById("r-sr")).thenReturn(role(Constants.ROLE_SENIOR_RESEARCHER));
        when(workflowRegistryService.isActionPermitted("mntd", "reporting", 11, NotebookStageAction.VIEW))
                .thenReturn(true);
        when(workflowRegistryService.resolveAllowedPersonasForAction(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(Constants.ROLE_LAB_MANAGER, Constants.ROLE_SENIOR_RESEARCHER));

        service.assertStageAccess(request, notebook, reportingPage, NotebookStageAction.VIEW);
    }

    @Test
    public void noActiveDepartment_denied() {
        when(departmentIsolationService.hasUnrestrictedDepartmentAccess(request)).thenReturn(false);
        when(departmentIsolationService.getRestrictedUserTestSectionIds(request)).thenReturn(Set.of());

        assertThrows(ResponseStatusException.class, () -> service.assertActiveDepartment(request));
    }

    private void stubRestrictedUser(String labUnitId, String roleId) {
        when(departmentIsolationService.hasUnrestrictedDepartmentAccess(request)).thenReturn(false);
        when(departmentIsolationService.getRestrictedUserTestSectionIds(request)).thenReturn(Set.of(177));
        doNothing().when(departmentIsolationService).assertNotebookDepartmentAccess(any(), any());
        when(departmentIsolationService.getSysUserId(request)).thenReturn("42");
        when(departmentIsolationService.activeLoginLabUnitMatches(request, labUnitId)).thenReturn(true);
        when(userRoleService.getRoleIdsForUser("42")).thenReturn(List.of());

        LabUnitRoleMap map = new LabUnitRoleMap();
        map.setLabUnit(labUnitId);
        map.setRoles(new HashSet<>(Set.of(roleId)));
        UserLabUnitRoles labRoles = new UserLabUnitRoles();
        labRoles.setLabUnitRoleMap(Set.of(map));
        when(userRoleService.getUserLabUnitRoles("42")).thenReturn(labRoles);
    }

    private NoteBookPage page(int order, String pageId) {
        NoteBookPage page = new NoteBookPage();
        page.setId(order);
        page.setOrder(order);
        page.setPageId(pageId);
        page.setNotebook(notebook);
        return page;
    }

    private Role role(String name) {
        Role role = new Role();
        role.setName(name);
        return role;
    }
}
