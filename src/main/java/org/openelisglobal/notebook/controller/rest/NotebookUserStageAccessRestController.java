package org.openelisglobal.notebook.controller.rest;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.openelisglobal.common.action.IActionConstants;
import org.openelisglobal.common.rest.BaseRestController;
import org.openelisglobal.department.service.DepartmentIsolationService;
import org.openelisglobal.login.valueholder.UserSessionData;
import org.openelisglobal.notebook.form.LabUnitStageAccessForm;
import org.openelisglobal.notebook.service.NotebookUserStageOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Current user's notebook stage-access override for the active (or requested)
 * lab unit.
 */
@RestController
@RequestMapping("/rest/notebook")
public class NotebookUserStageAccessRestController extends BaseRestController {

    @Autowired
    private NotebookUserStageOverrideService stageOverrideService;

    @Autowired
    private DepartmentIsolationService departmentIsolationService;

    @GetMapping(value = "/my-stage-access", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getMyStageAccess(HttpServletRequest request,
            @RequestParam(value = "labUnitId", required = false) String labUnitId) {
        Map<String, Object> response = new HashMap<>();
        String resolvedLabUnit = labUnitId;
        if (resolvedLabUnit == null || resolvedLabUnit.isBlank()) {
            UserSessionData usd = (UserSessionData) request.getSession()
                    .getAttribute(IActionConstants.USER_SESSION_DATA);
            if (usd != null && usd.getLoginLabUnit() > 0) {
                resolvedLabUnit = String.valueOf(usd.getLoginLabUnit());
            } else {
                resolvedLabUnit = departmentIsolationService.getLoginLabUnit(request);
            }
        }
        response.put("labUnitId", resolvedLabUnit);

        String sysUserId = departmentIsolationService.getSysUserId(request);
        Integer uid = null;
        try {
            if (sysUserId != null) {
                uid = Integer.valueOf(sysUserId.trim());
            }
        } catch (NumberFormatException ignored) {
            // leave null
        }

        LabUnitStageAccessForm form = new LabUnitStageAccessForm();
        form.setMode("DEFAULT");
        if (uid != null && resolvedLabUnit != null && !resolvedLabUnit.isBlank()) {
            form = stageOverrideService.getEffectiveFormForLabUnit(uid, resolvedLabUnit.trim());
        }
        response.put("mode", form.getMode());
        response.put("pageKeys", form.getPageKeys());
        return response;
    }
}
