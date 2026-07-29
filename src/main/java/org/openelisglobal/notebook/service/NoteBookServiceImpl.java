package org.openelisglobal.notebook.service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.validator.GenericValidator;
import org.hibernate.Hibernate;
import org.openelisglobal.analysis.service.AnalysisService;
import org.openelisglobal.analysis.valueholder.Analysis;
import org.openelisglobal.analyzer.service.AnalyzerService;
import org.openelisglobal.common.action.IActionConstants;
import org.openelisglobal.common.dao.BaseDAO;
import org.openelisglobal.common.log.LogEvent;
import org.openelisglobal.common.service.AuditableBaseObjectServiceImpl;
import org.openelisglobal.common.util.DateUtil;
import org.openelisglobal.common.util.IdValuePair;
import org.openelisglobal.dictionary.service.DictionaryService;
import org.openelisglobal.dictionary.valueholder.Dictionary;
import org.openelisglobal.dictionarycategory.service.DictionaryCategoryService;
import org.openelisglobal.dictionarycategory.valueholder.DictionaryCategory;
import org.openelisglobal.notebook.bean.NoteBookDisplayBean;
import org.openelisglobal.notebook.bean.NoteBookFullDisplayBean;
import org.openelisglobal.notebook.bean.NotebookHierarchyDTO;
import org.openelisglobal.notebook.bean.SampleDisplayBean;
import org.openelisglobal.notebook.bean.SampleDisplayBean.ResultDisplayBean;
import org.openelisglobal.notebook.dao.NoteBookDAO;
import org.openelisglobal.notebook.dao.NoteBookPageDAO;
import org.openelisglobal.notebook.form.NoteBookForm;
import org.openelisglobal.notebook.valueholder.NoteBook;
import org.openelisglobal.notebook.valueholder.NoteBook.NoteBookStatus;
import org.openelisglobal.notebook.valueholder.NoteBookComment;
import org.openelisglobal.notebook.valueholder.NoteBookFile;
import org.openelisglobal.notebook.valueholder.NoteBookPage;
import org.openelisglobal.notebook.valueholder.NotebookEntry;
import org.openelisglobal.notebook.valueholder.NotebookEntry.EntryStatus;
import org.openelisglobal.organization.service.OrganizationService;
import org.openelisglobal.organization.valueholder.Organization;
import org.openelisglobal.result.service.ResultService;
import org.openelisglobal.result.valueholder.Result;
import org.openelisglobal.sample.service.SampleService;
import org.openelisglobal.sample.valueholder.Sample;
import org.openelisglobal.sampleitem.service.SampleItemService;
import org.openelisglobal.sampleitem.valueholder.SampleItem;
import org.openelisglobal.systemuser.service.SystemUserService;
import org.openelisglobal.test.service.TestSectionService;
import org.openelisglobal.test.valueholder.TestSection;
import org.openelisglobal.typeofsample.service.TypeOfSampleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteBookServiceImpl extends AuditableBaseObjectServiceImpl<NoteBook, Integer> implements NoteBookService {

    @Autowired
    private NoteBookDAO baseObjectDAO;

    @Autowired
    private NoteBookPageDAO noteBookPageDAO;

    @Autowired
    private SampleService sampleService;

    @Autowired
    private SampleItemService sampleItemService;

    @Autowired
    private TypeOfSampleService typeOfSampleService;

    @Autowired
    private AnalysisService analysisService;

    @Autowired
    ResultService resultService;

    @Autowired
    private AnalyzerService analyzerService;

    @Autowired
    private SystemUserService systemUserService;

    @Autowired
    private DictionaryService dictionaryService;

    @Autowired
    private DictionaryCategoryService dictionaryCategoryService;

    @Autowired
    private OrganizationService organizationService;

    @Autowired
    private TestSectionService testSectionService;

    @Autowired
    private org.openelisglobal.inventory.service.InventoryItemService inventoryItemService;

    @Autowired
    private NotebookAuditService notebookAuditService;

    @Autowired
    private NotebookEntryService notebookEntryService;

    public NoteBookServiceImpl() {
        super(NoteBook.class);
        this.auditTrailLog = true;
    }

    @Override
    protected BaseDAO<NoteBook, Integer> getBaseObjectDAO() {
        return baseObjectDAO;
    }

    @Override
    @Transactional
    public List<NoteBook> filterNoteBookEntries(List<NoteBookStatus> statuses, List<String> types, List<String> tags,
            Date fromDate, Date toDate, Integer noteBookId, Boolean orphanOnly) {
        List<Integer> entryIds = new ArrayList<>();
        if (noteBookId != null) {
            if (Boolean.TRUE.equals(orphanOnly)) {
                // Only get entries directly linked to the parent template (orphan entries)
                Optional<NoteBook> parentOpt = baseObjectDAO.get(noteBookId);
                if (parentOpt.isPresent()) {
                    NoteBook parent = parentOpt.get();
                    Hibernate.initialize(parent.getEntries());
                    if (parent.getEntries() != null) {
                        entryIds = parent.getEntries().stream().map(e -> e.getId()).collect(Collectors.toList());
                    }
                }
            } else {
                // Get all entries (from children and orphans)
                entryIds = getNoteBookEntries(noteBookId).stream().map(e -> e.getId()).collect(Collectors.toList());
            }
        }
        if (noteBookId != null && entryIds.isEmpty()) {
            return new ArrayList<>();
        }

        return baseObjectDAO.filterNoteBookEntries(statuses, types, tags, fromDate, toDate, entryIds);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteBookDisplayBean> filterDashboardEntries(List<NoteBookStatus> statuses, List<String> types,
            List<String> tags, Date fromDate, Date toDate, Integer noteBookId, Boolean orphanOnly) {
        List<NoteBookDisplayBean> results = new ArrayList<>();

        List<NoteBook> legacyEntries = filterNoteBookEntries(statuses, types, tags, fromDate, toDate, noteBookId,
                orphanOnly);
        for (NoteBook legacyEntry : legacyEntries) {
            results.add(convertToDisplayBean(legacyEntry.getId()));
        }

        if (!Boolean.TRUE.equals(orphanOnly)) {
            results.addAll(collectWorkflowEntryDisplayBeans(noteBookId, statuses, types, tags, fromDate, toDate));
        }

        return results;
    }

    private List<NoteBookDisplayBean> collectWorkflowEntryDisplayBeans(Integer noteBookId,
            List<NoteBookStatus> statuses, List<String> types, List<String> tags, Date fromDate, Date toDate) {
        if (noteBookId == null) {
            return new ArrayList<>();
        }

        NoteBook notebook = get(noteBookId);
        if (notebook == null) {
            return new ArrayList<>();
        }

        List<NoteBook> instances = resolveInstancesForDashboard(notebook);
        if (instances.isEmpty()) {
            return new ArrayList<>();
        }

        List<NoteBookDisplayBean> beans = new ArrayList<>();
        for (NoteBook instance : instances) {
            List<NotebookEntry> workflowEntries = notebookEntryService.findByNotebookId(instance.getId());
            if (workflowEntries == null || workflowEntries.isEmpty()) {
                continue;
            }

            List<NotebookEntry> sortedEntries = workflowEntries.stream().sorted((e1, e2) -> {
                if (e1.getDateCreated() == null && e2.getDateCreated() == null) {
                    return Integer.compare(e1.getId(), e2.getId());
                }
                if (e1.getDateCreated() == null) {
                    return 1;
                }
                if (e2.getDateCreated() == null) {
                    return -1;
                }
                int byDate = e1.getDateCreated().compareTo(e2.getDateCreated());
                return byDate != 0 ? byDate : Integer.compare(e1.getId(), e2.getId());
            }).collect(Collectors.toList());

            for (int i = 0; i < sortedEntries.size(); i++) {
                NotebookEntry entry = sortedEntries.get(i);
                if (!matchesWorkflowEntryFilters(entry, instance, statuses, types, tags, fromDate, toDate)) {
                    continue;
                }
                beans.add(convertWorkflowEntryToDisplayBean(entry, instance, i + 1));
            }
        }
        return beans;
    }

    private List<NoteBook> resolveInstancesForDashboard(NoteBook notebook) {
        List<NoteBook> instances = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();

        if (notebook.isChildInstance()) {
            instances.add(notebook);
            return instances;
        }

        if (!notebook.isParentTemplate()) {
            return instances;
        }

        for (NoteBook child : baseObjectDAO.findChildrenByParentId(notebook.getId())) {
            if (seen.add(child.getId())) {
                instances.add(child);
            }
        }

        Hibernate.initialize(notebook.getEntries());
        if (notebook.getEntries() != null) {
            for (NoteBook legacy : notebook.getEntries()) {
                if (legacy == null || Boolean.TRUE.equals(legacy.getIsTemplate())) {
                    continue;
                }
                Hibernate.initialize(legacy.getParentNotebook());
                if (legacy.getParentNotebook() == null && seen.add(legacy.getId())) {
                    instances.add(legacy);
                }
            }
        }

        return instances;
    }

    private boolean matchesWorkflowEntryFilters(NotebookEntry entry, NoteBook instance, List<NoteBookStatus> statuses,
            List<String> types, List<String> tags, Date fromDate, Date toDate) {
        NoteBookStatus entryStatus = mapWorkflowEntryStatus(entry.getStatus());
        if (statuses != null && !statuses.isEmpty() && !statuses.contains(entryStatus)) {
            return false;
        }

        if (types != null && !types.isEmpty()) {
            if (instance.getType() == null || !types.contains(instance.getType().getId())) {
                return false;
            }
        }

        if (tags != null && !tags.isEmpty()) {
            Hibernate.initialize(instance.getTags());
            if (instance.getTags() == null || instance.getTags().stream().noneMatch(tags::contains)) {
                return false;
            }
        }

        if (fromDate != null && entry.getDateCreated() != null && entry.getDateCreated().before(fromDate)) {
            return false;
        }
        if (toDate != null && entry.getDateCreated() != null && entry.getDateCreated().after(toDate)) {
            return false;
        }

        return true;
    }

    private NoteBookStatus mapWorkflowEntryStatus(EntryStatus status) {
        if (status == null) {
            return NoteBookStatus.DRAFT;
        }
        return NoteBookStatus.valueOf(status.name());
    }

    private NoteBookDisplayBean convertWorkflowEntryToDisplayBean(NotebookEntry entry, NoteBook instance,
            int entryNumber) {
        NoteBookDisplayBean displayBean = new NoteBookDisplayBean();
        displayBean.setWorkflowEntryId(entry.getId());
        displayBean.setInstanceNotebookId(instance.getId());
        displayBean.setId(instance.getId());
        displayBean.setEntryNumber(entryNumber);
        displayBean.setNotebookName(instance.getTitle());
        displayBean.setTitle(StringUtils.isNotBlank(entry.getTitle()) ? entry.getTitle() : "Entry #" + entryNumber);
        displayBean.setStatus(mapWorkflowEntryStatus(entry.getStatus()));
        displayBean.setIsTemplate(false);
        displayBean.setDateCreated(
                entry.getDateCreated() != null ? DateUtil.formatDateAsText(entry.getDateCreated()) : null);
        displayBean.setWorkflowType(getEffectiveWorkflowType(instance));

        if (entry.getTechnician() != null) {
            displayBean.setTechnicianId(Integer.valueOf(entry.getTechnician().getId()));
        }
        if (entry.getCreator() != null) {
            displayBean.setCreatorId(Integer.valueOf(entry.getCreator().getId()));
        }

        if (instance.getType() != null) {
            displayBean.setType(Integer.valueOf(instance.getType().getId()));
            displayBean.setTypeName(instance.getType().getDictEntry());
        }

        Hibernate.initialize(instance.getTags());
        displayBean.setTags(instance.getTags() != null ? new ArrayList<>(instance.getTags()) : new ArrayList<>());

        Hibernate.initialize(instance.getParentNotebook());
        NoteBook parentTemplate = instance.getParentNotebook();
        if (parentTemplate == null) {
            parentTemplate = baseObjectDAO.findParentTemplate(instance.getId());
        }
        if (parentTemplate != null) {
            Hibernate.initialize(parentTemplate.getAllowedRoles());
            displayBean.setAllowedRoles(new HashSet<>(parentTemplate.getAllowedRoles()));
            if (parentTemplate.getType() != null && displayBean.getTypeName() == null) {
                displayBean.setTypeName(parentTemplate.getType().getDictEntry());
            }
        } else {
            Hibernate.initialize(instance.getAllowedRoles());
            displayBean.setAllowedRoles(
                    instance.getAllowedRoles() != null ? new HashSet<>(instance.getAllowedRoles()) : new HashSet<>());
        }

        return displayBean;
    }

    private int countEntriesForInstance(Integer instanceId) {
        Long workflowCount = notebookEntryService.countByNotebookId(instanceId);
        int count = workflowCount != null ? workflowCount.intValue() : 0;
        NoteBook instance = get(instanceId);
        if (instance != null) {
            Hibernate.initialize(instance.getEntries());
            if (instance.getEntries() != null) {
                count += instance.getEntries().size();
            }
        }
        return count;
    }

    private NotebookHierarchyDTO buildChildHierarchyDTO(NoteBook parent, NoteBook child) {
        NotebookHierarchyDTO childDTO = new NotebookHierarchyDTO();
        childDTO.setId(child.getId());
        childDTO.setTitle(child.getTitle());
        childDTO.setParentTemplate(false);
        childDTO.setChildInstance(true);
        childDTO.setParentNotebookId(parent.getId());
        childDTO.setParentNotebookTitle(parent.getTitle());
        childDTO.setEntryCount(countEntriesForInstance(child.getId()));
        return childDTO;
    }

    @Override
    @Transactional
    public List<NoteBook> filterNoteBooks(List<NoteBookStatus> statuses, List<String> types, List<String> tags,
            Date fromDate, Date toDate) {
        return baseObjectDAO.filterNoteBooks(statuses, types, tags, fromDate, toDate);
    }

    @Override
    @Transactional
    public void updateWithStatus(Integer notebookId, NoteBookStatus status, String sysUserId) {
        Optional<NoteBook> optionalNoteBook = baseObjectDAO.get(notebookId);
        if (optionalNoteBook.isPresent()) {
            NoteBook noteBook = optionalNoteBook.get();
            noteBook.setStatus(status);
            if (sysUserId != null) {
                noteBook.setSysUserId(sysUserId);
            }
            update(noteBook);
        }
    }

    @Override
    @Transactional
    public NoteBook createWithFormValues(NoteBookForm form) {
        NoteBook noteBook = new NoteBook();
        noteBook = createNoteBookFromForm(noteBook, form);
        noteBook = save(noteBook);

        // If creating a new TEMPLATE, automatically assign all active departments
        // This ensures the template is accessible to all users by default
        if (noteBook.getIsTemplate()) {
            assignAllActiveDepartments(noteBook);
            assignAllActiveOrganizations(noteBook);
            update(noteBook);
        } else if (form.getTemplateId() != null) {
            // Creating an entry - can be from a template OR from a child instance
            NoteBook parentNoteBook = get(form.getTemplateId());
            LogEvent.logInfo(this.getClass().getSimpleName(), "createWithFormValues",
                    "Creating entry with templateId=" + form.getTemplateId() + ", parentNoteBook="
                            + (parentNoteBook != null
                                    ? "found (id=" + parentNoteBook.getId() + ", isTemplate="
                                            + parentNoteBook.getIsTemplate() + ")"
                                    : "null"));

            if (parentNoteBook != null) {
                // Initialize parentNotebook to check isChildInstance properly
                Hibernate.initialize(parentNoteBook.getParentNotebook());
                boolean isChildInst = parentNoteBook.isChildInstance();
                boolean isTemplate = parentNoteBook.getIsTemplate();

                LogEvent.logInfo(this.getClass().getSimpleName(), "createWithFormValues",
                        "parentNoteBook: isTemplate=" + isTemplate + ", isChildInstance=" + isChildInst
                                + ", parentNotebook="
                                + (parentNoteBook.getParentNotebook() != null
                                        ? parentNoteBook.getParentNotebook().getId()
                                        : "null"));

                // Check if this notebook can accept entries:
                // - Child instances (isTemplate=false with parentNotebook set) can accept
                // entries
                // - Legacy templates (isTemplate=true) can also accept entries for backwards
                // compatibility
                boolean canAccept = isTemplate || isChildInst;
                LogEvent.logInfo(this.getClass().getSimpleName(), "createWithFormValues", "canAccept=" + canAccept);

                if (canAccept) {
                    Hibernate.initialize(parentNoteBook.getEntries());
                    int entriesBefore = parentNoteBook.getEntries().size();
                    parentNoteBook.getEntries().add(noteBook);
                    LogEvent.logInfo(this.getClass().getSimpleName(), "createWithFormValues",
                            "Added entry to parentNoteBook entries. Before=" + entriesBefore + ", After="
                                    + parentNoteBook.getEntries().size());
                    // Set sysUserId for audit trail tracking when updating parent
                    if (form.getSystemUserId() != null) {
                        parentNoteBook.setSysUserId(form.getSystemUserId().toString());
                    }
                    initializeLazyCollections(parentNoteBook);
                    update(parentNoteBook);
                    LogEvent.logInfo(this.getClass().getSimpleName(), "createWithFormValues",
                            "Updated parentNoteBook with new entry");
                }
            }
        }

        return noteBook;
    }

    /**
     * Assign all active departments (test sections) to a notebook template. This
     * makes the template accessible to all departments by default.
     */
    private void assignAllActiveDepartments(NoteBook noteBook) {
        List<TestSection> allDepartments = testSectionService.getAllActiveTestSections();
        if (noteBook.getDepartments() == null) {
            noteBook.setDepartments(new HashSet<>());
        }
        noteBook.getDepartments().addAll(allDepartments);
    }

    /**
     * Assign all active organizations to a notebook template. This makes the
     * template accessible to all organizations by default.
     */
    private void assignAllActiveOrganizations(NoteBook noteBook) {
        List<Organization> allOrganizations = organizationService.getActiveOrganizations();
        if (noteBook.getOrganizations() == null) {
            noteBook.setOrganizations(new HashSet<>());
        }
        noteBook.getOrganizations().addAll(allOrganizations);
    }

    @Override
    @Transactional
    public void updateWithFormValues(Integer noteBookId, NoteBookForm form) {
        Optional<NoteBook> optionalNoteBook = baseObjectDAO.get(noteBookId);
        if (optionalNoteBook.isPresent()) {
            NoteBook noteBook = optionalNoteBook.get();
            noteBook = createNoteBookFromForm(noteBook, form);
            initializeLazyCollections(noteBook);
            update(noteBook);
        }
    }

    @Override
    @Transactional
    protected NoteBook update(NoteBook noteBook, String auditTrailType) {
        // Note: Do NOT evict the modified noteBook - it would cause
        // "collection no longer referenced" errors with orphanRemoval collections.
        // The parent class handles getting the old object for audit trail comparison.
        // We just need to ensure lazy collections are initialized on the entity being
        // saved.
        initializeLazyCollections(noteBook);
        return super.update(noteBook, auditTrailType);
    }

    /**
     * Initialize all lazy collections on a NoteBook entity to prevent
     * LazyInitializationException when the entity is accessed outside of a
     * transaction (e.g., in audit trail comparison).
     */
    private void initializeLazyCollections(NoteBook noteBook) {
        Hibernate.initialize(noteBook.getTags());
        Hibernate.initialize(noteBook.getSamples());
        Hibernate.initialize(noteBook.getAnalysers());
        Hibernate.initialize(noteBook.getInventoryInstrumentIds());
        Hibernate.initialize(noteBook.getPages());
        // Initialize panels and tests for each page (panels is LAZY to avoid
        // MultipleBagFetchException)
        if (noteBook.getPages() != null) {
            for (NoteBookPage page : noteBook.getPages()) {
                Hibernate.initialize(page.getPanels());
                Hibernate.initialize(page.getTests());
            }
        }
        Hibernate.initialize(noteBook.getFiles());
        Hibernate.initialize(noteBook.getComments());
        Hibernate.initialize(noteBook.getEntries());
        Hibernate.initialize(noteBook.getOrganizations());
        Hibernate.initialize(noteBook.getDepartments());
        Hibernate.initialize(noteBook.getAllowedRoles());
        Hibernate.initialize(noteBook.getAllowedTestIds());
        if (noteBook.getTechnician() != null) {
            Hibernate.initialize(noteBook.getTechnician());
        }
    }

    @Override
    @Transactional
    public NoteBookDisplayBean convertToDisplayBean(Integer noteBookId) {
        NoteBookDisplayBean displayBean = new NoteBookDisplayBean();
        Optional<NoteBook> optionalNoteBook = baseObjectDAO.get(noteBookId);
        if (optionalNoteBook.isPresent()) {
            NoteBook noteBook = optionalNoteBook.get();
            Hibernate.initialize(noteBook.getTags());
            Hibernate.initialize(noteBook.getEntries());
            displayBean.setId(noteBook.getId());
            displayBean.setTitle(noteBook.getTitle());
            displayBean.setTags(noteBook.getTags());
            if (noteBook.getTechnician() != null) {
                displayBean.setTechnicianId(Integer.valueOf(noteBook.getTechnician().getId()));
            }
            if (noteBook.getCreator() != null) {
                displayBean.setCreatorId(Integer.valueOf(noteBook.getCreator().getId()));
            }
            // Handle type - it's now a Dictionary entity
            if (noteBook.getType() != null) {
                displayBean.setType(Integer.valueOf(noteBook.getType().getId()));
                displayBean.setTypeName(noteBook.getType().getDictEntry());
            }

            displayBean.setDateCreated(
                    noteBook.getDateCreated() != null ? DateUtil.formatDateAsText(noteBook.getDateCreated()) : null);
            displayBean.setStatus(noteBook.getStatus());
            displayBean.setIsTemplate(noteBook.getIsTemplate());
            displayBean.setEntriesCount(noteBook.getEntries().size());
            displayBean.setQuestionnaireFhirUuid(noteBook.getQuestionnaireFhirUuid());

            // Project metadata fields
            displayBean.setPrincipalInvestigator(noteBook.getPrincipalInvestigator());
            displayBean.setFundingSource(noteBook.getFundingSource());
            displayBean.setBudget(noteBook.getBudget());
            displayBean.setProjectTimeline(noteBook.getProjectTimeline());

            displayBean.setWorkflowType(getEffectiveWorkflowType(noteBook));

            // Handle allowedRoles based on notebook type
            // 1. Parent templates (isTemplate=true, no parentNotebook): use own
            // allowedRoles
            // 2. Child instances (isTemplate=false, has parentNotebook): inherit from
            // parent
            // template
            // 3. Entries (isTemplate=false, no parentNotebook, in entries collection):
            // inherit
            // from parent template via findParentTemplate
            if (noteBook.isChildInstance()) {
                // Child instance - get allowedRoles from parent template
                NoteBook parentTemplate = noteBook.getParentNotebook();
                if (parentTemplate != null) {
                    Hibernate.initialize(parentTemplate.getAllowedRoles());
                    displayBean.setAllowedRoles(new HashSet<>(parentTemplate.getAllowedRoles()));
                } else {
                    // Fallback to own allowedRoles if parent not found (shouldn't happen)
                    Hibernate.initialize(noteBook.getAllowedRoles());
                    displayBean.setAllowedRoles(new HashSet<>(noteBook.getAllowedRoles()));
                }
            } else if (noteBook.getIsTemplate() != null && !noteBook.getIsTemplate()) {
                // Entry (not a child instance) - find parent via entries collection
                NoteBook directParent = baseObjectDAO.findDirectParentNotebook(noteBook.getId());
                // Find the ultimate parent template for allowedRoles
                NoteBook parentTemplate = baseObjectDAO.findParentTemplate(noteBook.getId());

                // Entries inherit allowedRoles from their parent template
                if (parentTemplate != null) {
                    Hibernate.initialize(parentTemplate.getAllowedRoles());
                    displayBean.setAllowedRoles(new HashSet<>(parentTemplate.getAllowedRoles()));
                }

                // Use direct parent's title for display name and calculate entry number
                if (directParent != null) {
                    displayBean.setNotebookName(directParent.getTitle());
                    Hibernate.initialize(directParent.getEntries());
                    List<NoteBook> entries = directParent.getEntries();
                    if (entries != null) {
                        // Sort entries by dateCreated to get consistent numbering
                        List<NoteBook> sortedEntries = entries.stream().sorted((e1, e2) -> {
                            if (e1.getDateCreated() == null && e2.getDateCreated() == null) {
                                return 0;
                            }
                            if (e1.getDateCreated() == null) {
                                return 1;
                            }
                            if (e2.getDateCreated() == null) {
                                return -1;
                            }
                            return e1.getDateCreated().compareTo(e2.getDateCreated());
                        }).collect(Collectors.toList());
                        for (int i = 0; i < sortedEntries.size(); i++) {
                            if (sortedEntries.get(i).getId().equals(noteBook.getId())) {
                                displayBean.setEntryNumber(i + 1);
                                break;
                            }
                        }
                    }
                }
            } else {
                // For parent templates, use their own allowedRoles
                Hibernate.initialize(noteBook.getAllowedRoles());
                displayBean.setAllowedRoles(new HashSet<>(noteBook.getAllowedRoles()));
            }
        }
        return displayBean;
    }

    @Override
    @Transactional
    public NoteBookFullDisplayBean convertToFullDisplayBean(Integer noteBookId) {
        NoteBookFullDisplayBean fullDisplayBean = new NoteBookFullDisplayBean();
        NoteBook noteBook = get(noteBookId);
        if (noteBook != null) {
            Hibernate.initialize(noteBook.getAnalysers());
            Hibernate.initialize(noteBook.getInventoryInstrumentIds());
            Hibernate.initialize(noteBook.getSamples());

            // Pages must come from the concrete notebook record being edited/viewed.
            //
            // Child instances have their own copied `notebook_page` rows (with distinct
            // IDs).
            // Returning the parent template pages here causes the frontend to query
            // `/rest/notebook/page/{pageId}/samples` using template page IDs, while the
            // backend creates `notebook_page_sample` rows against the *instance* page IDs.
            // That mismatch makes imported samples appear to "disappear" in the UI.
            List<NoteBookPage> effectivePages;
            Hibernate.initialize(noteBook.getPages());
            effectivePages = noteBook.getPages();

            // Fallback: if instance pages were not copied for some reason, use parent
            // pages.
            if ((effectivePages == null || effectivePages.isEmpty()) && noteBook.isChildInstance()) {
                NoteBook parentTemplate = noteBook.getParentNotebook();
                if (parentTemplate != null) {
                    Hibernate.initialize(parentTemplate.getPages());
                    effectivePages = parentTemplate.getPages();
                }
            }

            // Initialize panels, tests, and allowedRoles for each page (LAZY to avoid
            // MultipleBagFetchException)
            // Also explicitly copy allowedRoles to ensure proper JSON serialization
            if (effectivePages != null) {
                for (NoteBookPage page : effectivePages) {
                    Hibernate.initialize(page.getPanels());
                    Hibernate.initialize(page.getTests());
                    Hibernate.initialize(page.getAllowedRoles());
                    // Ensure allowedRoles is a regular HashSet (not Hibernate proxy) for JSON
                    // serialization
                    page.setAllowedRoles(new HashSet<>(page.getAllowedRoles()));
                }
            }
            Hibernate.initialize(noteBook.getFiles());
            Hibernate.initialize(noteBook.getComments());
            Hibernate.initialize(noteBook.getTags());
            Hibernate.initialize(noteBook.getEntries());
            fullDisplayBean.setId(noteBook.getId());
            fullDisplayBean.setTitle(noteBook.getTitle());
            if (noteBook.getType() != null) {
                fullDisplayBean.setType(Integer.valueOf(noteBook.getType().getId()));
                fullDisplayBean.setTypeName(noteBook.getType().getDictEntry());
            }
            fullDisplayBean.setTags(noteBook.getTags());
            fullDisplayBean.setDateCreated(
                    noteBook.getDateCreated() != null ? DateUtil.formatDateAsText(noteBook.getDateCreated()) : null);
            fullDisplayBean.setStatus(noteBook.getStatus());
            fullDisplayBean.setContent(noteBook.getContent());
            fullDisplayBean.setObjective(noteBook.getObjective());
            fullDisplayBean.setProtocol(noteBook.getProtocol());

            // Project metadata fields
            fullDisplayBean.setPrincipalInvestigator(noteBook.getPrincipalInvestigator());
            fullDisplayBean.setFundingSource(noteBook.getFundingSource());
            fullDisplayBean.setBudget(noteBook.getBudget());
            fullDisplayBean.setProjectTimeline(noteBook.getProjectTimeline());

            fullDisplayBean.setWorkflowType(getEffectiveWorkflowType(noteBook));

            // Prefer inventory instruments over legacy analyzers
            List<IdValuePair> instrumentList = new ArrayList<>();
            List<Long> instrumentIds = noteBook.getInventoryInstrumentIds();

            if ((instrumentIds == null || instrumentIds.isEmpty()) && noteBook.isChildInstance()) {
                NoteBook parentTemplate = noteBook.getParentNotebook();
                if (parentTemplate != null) {
                    Hibernate.initialize(parentTemplate.getInventoryInstrumentIds());
                    instrumentIds = parentTemplate.getInventoryInstrumentIds();
                }
            }

            // If this is an entry (not a template) and has no instruments, get from parent
            // template
            if ((instrumentIds == null || instrumentIds.isEmpty()) && noteBook.getIsTemplate() != null
                    && !noteBook.getIsTemplate()) {
                NoteBook parentTemplate = baseObjectDAO.findParentTemplate(noteBook.getId());
                if (parentTemplate != null) {
                    Hibernate.initialize(parentTemplate.getInventoryInstrumentIds());
                    instrumentIds = parentTemplate.getInventoryInstrumentIds();
                }
            }

            if (instrumentIds != null && !instrumentIds.isEmpty()) {
                for (Long instrumentId : instrumentIds) {
                    try {
                        var inventoryItem = inventoryItemService.get(instrumentId);
                        if (inventoryItem != null) {
                            IdValuePair pair = new IdValuePair(inventoryItem.getId().toString(),
                                    inventoryItem.getName());
                            pair.setSerialNumber(inventoryItem.getSerialNumber());
                            pair.setModelNumber(inventoryItem.getModelNumber());
                            instrumentList.add(pair);
                        }
                    } catch (Exception e) {
                        LogEvent.logWarn(this.getClass().getSimpleName(), "convertToFullDisplayBean",
                                "Could not find inventory item with id: " + instrumentId);
                    }
                }
            } else {
                // Fallback to legacy analyzers if no inventory instruments
                instrumentList = noteBook.getAnalysers().stream()
                        .map(analyzer -> new IdValuePair(analyzer.getId(), analyzer.getName())).toList();
            }
            fullDisplayBean.setAnalyzers(instrumentList);
            fullDisplayBean.setPages(effectivePages); // Use effective pages (inherited for child instances)
            fullDisplayBean.setFiles(noteBook.getFiles());
            // Initialize author for each comment
            for (NoteBookComment comment : noteBook.getComments()) {
                Hibernate.initialize(comment.getAuthor());
            }
            fullDisplayBean.setComments(noteBook.getComments());
            if (noteBook.getTechnician() != null) {
                fullDisplayBean.setTechnicianName(noteBook.getTechnician().getDisplayName());
                fullDisplayBean.setTechnicianId(Integer.valueOf(noteBook.getTechnician().getId()));
            }
            if (noteBook.getCreator() != null) {
                fullDisplayBean.setCreatorName(noteBook.getCreator().getDisplayName());
                fullDisplayBean.setCreatorId(Integer.valueOf(noteBook.getCreator().getId()));
            }
            fullDisplayBean.setIsTemplate(noteBook.getIsTemplate());
            fullDisplayBean.setEntriesCount(noteBook.getEntries().size());
            fullDisplayBean.setQuestionnaireFhirUuid(noteBook.getQuestionnaireFhirUuid());

            // For child instances, set the parent template ID directly
            // For entries, find the parent via entries collection
            if (noteBook.isChildInstance()) {
                NoteBook parentTemplate = noteBook.getParentNotebook();
                if (parentTemplate != null) {
                    fullDisplayBean.setTemplateId(parentTemplate.getId());
                }
            } else if (noteBook.getIsTemplate() != null && !noteBook.getIsTemplate()) {
                NoteBook parentTemplate = baseObjectDAO.findParentTemplate(noteBook.getId());
                if (parentTemplate != null) {
                    fullDisplayBean.setTemplateId(parentTemplate.getId());
                }
            }

            List<SampleDisplayBean> sampleDisplayBeans = new ArrayList<>();

            for (SampleItem sampleItem : noteBook.getSamples()) {
                SampleDisplayBean displayBean = convertSampleToDisplayBean(sampleItem);
                sampleDisplayBeans.add(displayBean);
            }
            fullDisplayBean.setSamples(sampleDisplayBeans);

            // For child instances, get access control settings from parent template
            // This ensures page-level role restrictions are properly inherited
            if (noteBook.isChildInstance()) {
                NoteBook parentTemplate = noteBook.getParentNotebook();
                if (parentTemplate != null) {
                    Hibernate.initialize(parentTemplate.getOrganizations());
                    fullDisplayBean.setOrganizations(parentTemplate.getOrganizations());

                    Hibernate.initialize(parentTemplate.getDepartments());
                    fullDisplayBean.setDepartments(parentTemplate.getDepartments());

                    Hibernate.initialize(parentTemplate.getAllowedRoles());
                    fullDisplayBean.setAllowedRoles(parentTemplate.getAllowedRoles());

                    // Prefer this entry's saved order-type filter; fall back to parent
                    // template only when the entry has none configured.
                    Hibernate.initialize(noteBook.getAllowedTestIds());
                    java.util.Set<Integer> allowedTests = new java.util.HashSet<>(noteBook.getAllowedTestIds());
                    if (allowedTests.isEmpty()) {
                        Hibernate.initialize(parentTemplate.getAllowedTestIds());
                        allowedTests = new java.util.HashSet<>(parentTemplate.getAllowedTestIds());
                    }
                    fullDisplayBean.setAllowedTestIds(allowedTests);
                } else {
                    // Fallback to own settings
                    Hibernate.initialize(noteBook.getOrganizations());
                    fullDisplayBean.setOrganizations(noteBook.getOrganizations());

                    Hibernate.initialize(noteBook.getDepartments());
                    fullDisplayBean.setDepartments(noteBook.getDepartments());

                    Hibernate.initialize(noteBook.getAllowedRoles());
                    fullDisplayBean.setAllowedRoles(noteBook.getAllowedRoles());

                    Hibernate.initialize(noteBook.getAllowedTestIds());
                    fullDisplayBean.setAllowedTestIds(new java.util.HashSet<>(noteBook.getAllowedTestIds()));
                }
            } else {
                Hibernate.initialize(noteBook.getOrganizations());
                fullDisplayBean.setOrganizations(noteBook.getOrganizations());

                Hibernate.initialize(noteBook.getDepartments());
                fullDisplayBean.setDepartments(noteBook.getDepartments());

                Hibernate.initialize(noteBook.getAllowedRoles());
                fullDisplayBean.setAllowedRoles(noteBook.getAllowedRoles());

                Hibernate.initialize(noteBook.getAllowedTestIds());
                java.util.Set<Integer> allowedTests = new java.util.HashSet<>(noteBook.getAllowedTestIds());
                // Entries (legacy/non-child) inherit order-filter tests from parent template
                if (allowedTests.isEmpty() && noteBook.getIsTemplate() != null && !noteBook.getIsTemplate()) {
                    NoteBook parentTemplate = baseObjectDAO.findParentTemplate(noteBook.getId());
                    if (parentTemplate != null) {
                        Hibernate.initialize(parentTemplate.getAllowedTestIds());
                        allowedTests = new java.util.HashSet<>(parentTemplate.getAllowedTestIds());
                    }
                }
                fullDisplayBean.setAllowedTestIds(allowedTests);
            }

        }
        return fullDisplayBean;
    }

    @Override
    public SampleDisplayBean convertSampleToDisplayBean(SampleItem sampleItem) {
        SampleDisplayBean sampleDisplayBean = new SampleDisplayBean();
        sampleDisplayBean.setId(Integer.valueOf(sampleItem.getId()));
        sampleDisplayBean.setSampleItemId(sampleItem.getId()); // Store SampleItem ID
        sampleDisplayBean
                .setSampleType(typeOfSampleService.getNameForTypeOfSampleId(sampleItem.getTypeOfSample().getId()));
        sampleDisplayBean.setCollectionDate(DateUtil.convertTimestampToStringDate(sampleItem.getCollectionDate()));
        sampleDisplayBean.setVoided(sampleItem.isVoided());
        sampleDisplayBean.setVoidReason(sampleItem.getVoidReason());
        sampleDisplayBean.setExternalId(sampleItem.getExternalId());

        // Get accession number from parent Sample
        if (sampleItem.getSample() != null) {
            Sample sample = (Sample) sampleItem.getSample();
            sampleDisplayBean.setAccessionNumber(sample.getAccessionNumber());
            sampleDisplayBean.setSampleStatus(sample.getStatus());
        }

        List<Analysis> analyses = analysisService.getAnalysesBySampleItem(sampleItem);
        List<ResultDisplayBean> resultsDisplayBeans = new ArrayList<>();
        for (Analysis analysis : analyses) {
            List<Result> results = resultService.getResultsByAnalysis(analysis);
            for (Result result : results) {
                ResultDisplayBean resultDisplayBean = new ResultDisplayBean();
                resultDisplayBean.setResult(resultService.getResultValue(result, true));
                resultDisplayBean.setTest(analysis.getTest().getLocalizedName());
                resultDisplayBean.setDateCreated(DateUtil.convertTimestampToStringDate(result.getLastupdated()));
                resultsDisplayBeans.add(resultDisplayBean);
            }
        }
        sampleDisplayBean.setResults(resultsDisplayBeans);
        return sampleDisplayBean;
    }

    private NoteBook createNoteBookFromForm(NoteBook noteBook, NoteBookForm form) {

        if (!GenericValidator.isBlankOrNull(form.getTitle())) {
            noteBook.setTitle(form.getTitle());
        }
        if (!GenericValidator.isBlankOrNull(form.getTypeName())) {
            Dictionary experimentType = resolveExperimentTypeDictionary(form.getTypeName().trim());
            if (experimentType != null) {
                noteBook.setType(experimentType);
            }
        } else if (form.getType() != null) {
            noteBook.setType(dictionaryService.get(form.getType().toString()));
        }
        if (form.getTags() != null && !form.getTags().isEmpty()) {
            noteBook.setTags(new ArrayList<>(form.getTags()));
        }
        if (!GenericValidator.isBlankOrNull(form.getContent())) {
            noteBook.setContent(form.getContent());
        }
        if (!GenericValidator.isBlankOrNull(form.getWorkflowType())) {
            String normalizedPathologyType = PathologyWorkflowTypeConfig.normalizeWorkflowType(form.getWorkflowType());
            noteBook.setWorkflowType(
                    normalizedPathologyType != null ? normalizedPathologyType : form.getWorkflowType());
        }
        if (!GenericValidator.isBlankOrNull(form.getObjective())) {
            noteBook.setObjective(form.getObjective());
        }
        if (!GenericValidator.isBlankOrNull(form.getProtocol())) {
            noteBook.setProtocol(form.getProtocol());
        }

        // Project metadata fields
        if (!GenericValidator.isBlankOrNull(form.getPrincipalInvestigator())) {
            noteBook.setPrincipalInvestigator(form.getPrincipalInvestigator());
        }
        if (!GenericValidator.isBlankOrNull(form.getFundingSource())) {
            noteBook.setFundingSource(form.getFundingSource());
        }
        if (form.getBudget() != null) {
            noteBook.setBudget(form.getBudget());
        }
        if (!GenericValidator.isBlankOrNull(form.getProjectTimeline())) {
            noteBook.setProjectTimeline(form.getProjectTimeline());
        }

        noteBook.setIsTemplate(form.getIsTemplate());
        if (form.getStatus() != null) {
            noteBook.setStatus(form.getStatus());
        }

        if (form.getQuestionnaireFhirUuid() != null) {
            noteBook.setQuestionnaireFhirUuid(form.getQuestionnaireFhirUuid());
        }
        // Set sysUserId for audit trail tracking
        if (form.getSystemUserId() != null) {
            noteBook.setSysUserId(form.getSystemUserId().toString());
            noteBook.setCreator(systemUserService.get(form.getSystemUserId().toString()));
        }
        if (noteBook.getId() == null) {
            noteBook.setDateCreated(new Date());
            // Only set technician from systemUserId if technicianId is not provided in form
            if (form.getTechnicianId() != null) {
                noteBook.setTechnician(systemUserService.get(form.getTechnicianId().toString()));
            } else if (form.getSystemUserId() != null) {
                noteBook.setTechnician(systemUserService.get(form.getSystemUserId().toString()));
            }
        } else {
            noteBook.setDateCreated(noteBook.getDateCreated());
            // Only update technician if provided in form, otherwise keep existing
            if (form.getTechnicianId() != null) {
                noteBook.setTechnician(systemUserService.get(form.getTechnicianId().toString()));
            }
        }

        noteBook.getAnalysers().clear();
        if (form.getAnalyzerIds() != null) {
            for (Integer analyserId : form.getAnalyzerIds()) {
                if (analyserId == null || analyserId <= 0) {
                    continue;
                }
                try {
                    noteBook.getAnalysers().add(analyzerService.get(analyserId.toString()));
                } catch (Exception e) {
                    LogEvent.logWarn(this.getClass().getSimpleName(), "createNoteBookFromForm",
                            "Ignoring invalid analyzerId=" + analyserId + " while saving notebook id="
                                    + noteBook.getId());
                }
            }
        }

        // Handle inventory instruments
        noteBook.getInventoryInstrumentIds().clear();
        if (form.getInventoryInstrumentIds() != null) {
            noteBook.getInventoryInstrumentIds().addAll(form.getInventoryInstrumentIds());
        }

        noteBook.getSamples().clear();
        if (form.getSampleIds() != null) {
            for (Integer sampleId : form.getSampleIds()) {
                if (sampleId == null || sampleId <= 0) {
                    continue;
                }
                try {
                    noteBook.getSamples().add(sampleItemService.get(sampleId.toString()));
                } catch (Exception e) {
                    LogEvent.logWarn(this.getClass().getSimpleName(), "createNoteBookFromForm",
                            "Ignoring invalid sampleId=" + sampleId + " while saving notebook id=" + noteBook.getId());
                }
            }
        }

        noteBook.getFiles().clear();
        if (form.getFiles() != null) {
            for (NoteBookForm.NoteBookFileForm fileForm : form.getFiles()) {
                NoteBookFile file = new NoteBookFile();
                file.setId(null);
                file.setFileName(fileForm.getFileName());
                file.setFileType(fileForm.getFileType());
                file.setFileData(fileForm.getFileData());
                file.setNotebook(noteBook);
                noteBook.getFiles().add(file);
            }
        }

        // Handle pages by reconciling submitted rows against persisted rows without
        // clear()+addAll().
        // This avoids orphanRemoval deleting notebook_page rows (and cascading into
        // notebook_page_sample)
        // when the client is updating an existing workflow entry in place.
        if (form.getPages() != null) {
            Map<Integer, NoteBookPage> existingPagesById = new HashMap<>();
            Map<String, NoteBookPage> existingPagesByStableKey = new HashMap<>();
            for (NoteBookPage existingPage : noteBook.getPages()) {
                if (existingPage.getId() != null) {
                    existingPagesById.put(existingPage.getId(), existingPage);
                }
                String stableKey = buildPageStableKey(existingPage);
                if (stableKey != null) {
                    existingPagesByStableKey.putIfAbsent(stableKey, existingPage);
                }
            }

            Set<Integer> matchedExistingIds = new HashSet<>();
            for (NoteBookPage formPage : form.getPages()) {
                NoteBookPage matchedPage = resolveExistingPage(formPage, existingPagesById, existingPagesByStableKey);
                if (matchedPage != null && matchedPage.getId() != null) {
                    matchedExistingIds.add(matchedPage.getId());
                }
            }

            // Remove only pages that the payload clearly omitted. If the client sends no
            // usable
            // identifiers, do not risk wiping persisted workflow pages.
            if (!matchedExistingIds.isEmpty()) {
                noteBook.getPages()
                        .removeIf(page -> page.getId() != null && !matchedExistingIds.contains(page.getId()));
            }

            existingPagesById.clear();
            existingPagesByStableKey.clear();
            for (NoteBookPage existingPage : noteBook.getPages()) {
                if (existingPage.getId() != null) {
                    existingPagesById.put(existingPage.getId(), existingPage);
                }
                String stableKey = buildPageStableKey(existingPage);
                if (stableKey != null) {
                    existingPagesByStableKey.putIfAbsent(stableKey, existingPage);
                }
            }

            for (NoteBookPage formPage : form.getPages()) {
                NoteBookPage existingPage = resolveExistingPage(formPage, existingPagesById, existingPagesByStableKey);
                if (existingPage != null) {
                    mergePage(existingPage, formPage);
                } else {
                    NoteBookPage newPage = new NoteBookPage();
                    mergePage(newPage, formPage);
                    newPage.setNotebook(noteBook);
                    noteBook.getPages().add(newPage);
                }
            }
        }

        // Handle comments - only add new comments (those without id)
        if (form.getComments() != null) {
            for (NoteBookForm.NoteBookCommentForm commentForm : form.getComments()) {
                // Only process new comments (id is null)
                if (commentForm.getId() == null && !GenericValidator.isBlankOrNull(commentForm.getText())) {
                    NoteBookComment comment = new NoteBookComment();
                    comment.setText(commentForm.getText());
                    comment.setDateCreated(new Date());
                    comment.setNotebook(noteBook);
                    // Set author from systemUserId (current user)
                    if (form.getSystemUserId() != null) {
                        comment.setAuthor(systemUserService.get(form.getSystemUserId().toString()));
                    }
                    noteBook.getComments().add(comment);
                }
            }
        }

        // Handle organizations (for templates - defines which locations can use this
        // template)
        // Check if the form included this field (it might be empty list, which implies
        // clearing)
        if (form.getOrganizationIds() != null) {
            // Use clear/add on existing collection to ensure persistence
            noteBook.getOrganizations().clear();
            for (String orgId : form.getOrganizationIds()) {
                Organization org = organizationService.get(orgId);
                if (org != null) {
                    noteBook.getOrganizations().add(org);
                }
            }
        }

        // Handle departments (for templates - defines which departments can use this
        // template)
        // Only update departments if explicitly provided in the form (not null)
        if (form.getDepartmentIds() != null) {
            noteBook.getDepartments().clear();
            for (String deptId : form.getDepartmentIds()) {
                TestSection ts = testSectionService.get(deptId);
                if (ts != null) {
                    noteBook.getDepartments().add(ts);
                }
            }
        }

        // Handle allowed roles (for templates - defines which roles can create entries)
        if (form.getAllowedRoles() != null) {
            noteBook.getAllowedRoles().clear();
            noteBook.getAllowedRoles().addAll(form.getAllowedRoles());
        }

        // Handle allowed test IDs (for templates - filters which tests appear in Stage
        // 1 order creation)
        if (form.getAllowedTestIds() != null) {
            noteBook.getAllowedTestIds().clear();
            noteBook.getAllowedTestIds().addAll(form.getAllowedTestIds());
        }

        return noteBook;
    }

    private NoteBookPage resolveExistingPage(NoteBookPage formPage, Map<Integer, NoteBookPage> existingPagesById,
            Map<String, NoteBookPage> existingPagesByStableKey) {
        if (formPage.getId() != null && existingPagesById.containsKey(formPage.getId())) {
            return existingPagesById.get(formPage.getId());
        }

        String stableKey = buildPageStableKey(formPage);
        if (stableKey != null) {
            return existingPagesByStableKey.get(stableKey);
        }

        return null;
    }

    private String buildPageStableKey(NoteBookPage page) {
        if (!GenericValidator.isBlankOrNull(page.getPageId())) {
            return "pageId:" + page.getPageId().trim().toLowerCase(Locale.ROOT);
        }

        if (page.getOrder() != null && !GenericValidator.isBlankOrNull(page.getTitle())) {
            return "orderTitle:" + page.getOrder() + ":" + page.getTitle().trim().toLowerCase(Locale.ROOT);
        }

        return null;
    }

    private void mergePage(NoteBookPage targetPage, NoteBookPage sourcePage) {
        targetPage.setTitle(sourcePage.getTitle());
        targetPage.setOrder(sourcePage.getOrder());
        targetPage.setContent(sourcePage.getContent());
        targetPage.setInstructions(sourcePage.getInstructions());
        targetPage.setPageType(sourcePage.getPageType());
        targetPage.setPageId(sourcePage.getPageId());
        targetPage.setSampleTypeId(sourcePage.getSampleTypeId());
        targetPage.setCompleted(sourcePage.getCompleted());
        targetPage.setData(sourcePage.getData());

        targetPage.getPanels().clear();
        if (sourcePage.getPanels() != null) {
            targetPage.getPanels().addAll(sourcePage.getPanels());
        }

        targetPage.getTests().clear();
        if (sourcePage.getTests() != null) {
            targetPage.getTests().addAll(sourcePage.getTests());
        }

        targetPage.getAllowedRoles().clear();
        if (sourcePage.getAllowedRoles() != null) {
            targetPage.getAllowedRoles().addAll(sourcePage.getAllowedRoles());
        }
    }

    @Override
    @Transactional
    public Long getCountWithStatus(List<NoteBookStatus> statuses) {
        return baseObjectDAO.getCountWithStatus(statuses);
    }

    @Override
    @Transactional
    public Long getCountWithStatusBetweenDates(List<NoteBookStatus> statuses, Timestamp from, Timestamp to) {
        return baseObjectDAO.getCountWithStatusBetweenDates(statuses, from, to);
    }

    @Override
    @Transactional
    public Long getTotalCount() {
        return baseObjectDAO.getTotalCount();
    }

    @Override
    @Transactional
    public List<SampleDisplayBean> searchSampleItems(String accession) {

        List<Sample> samples = StringUtils.isNotBlank(accession) ? Optional
                .ofNullable(sampleService.getSampleByAccessionNumber(accession)).map(List::of).orElseGet(List::of)
                : new ArrayList<>();

        return samples.stream().flatMap(sample -> sampleItemService.getSampleItemsBySampleId(sample.getId()).stream())
                .map(this::convertSampleToDisplayBean).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<NoteBook> getAllTemplateNoteBooks() {
        List<NoteBook> noteBooks = baseObjectDAO.getAllMatching("isTemplate", true);
        noteBooks.forEach(nb -> {
            Hibernate.initialize(nb.getDepartments());
            Hibernate.initialize(nb.getOrganizations());
            Hibernate.initialize(nb.getAllowedRoles());
        });
        return noteBooks;
    }

    @Override
    @Transactional
    public List<NoteBook> getNoteBookEntries(Integer notebookId) {
        if (notebookId == null) {
            return new ArrayList<>();
        }
        try {
            NoteBook notebook = get(notebookId);
            if (notebook != null) {

                // DEBUG: Log all relevant fields before isParentTemplate check
                LogEvent.logInfo(this.getClass().getSimpleName(), "getNoteBookEntries",
                        "DEBUG: notebookId=" + notebookId + ", isTemplate=" + notebook.getIsTemplate()
                                + ", parentNotebook=" + notebook.getParentNotebook() + ", isParentTemplate()="
                                + notebook.isParentTemplate() + ", isChildInstance()=" + notebook.isChildInstance());

                // If this is a parent template, aggregate entries from all child instances
                // Also include any direct entries (for backwards compatibility with legacy
                // data)
                if (notebook.isParentTemplate()) {
                    // First, add any direct entries on the template itself (legacy support)
                    Hibernate.initialize(notebook.getEntries());
                    List<NoteBook> allEntries = new ArrayList<>(notebook.getEntries());

                    // Then, aggregate entries from all child instances
                    List<NoteBook> children = baseObjectDAO.findChildrenByParentId(notebookId);
                    LogEvent.logInfo(this.getClass().getSimpleName(), "getNoteBookEntries",
                            "Parent template notebookId=" + notebookId + ", directEntries="
                                    + notebook.getEntries().size() + ", childCount=" + children.size());
                    for (NoteBook child : children) {
                        Hibernate.initialize(child.getEntries());
                        allEntries.addAll(child.getEntries());
                    }
                    LogEvent.logInfo(this.getClass().getSimpleName(), "getNoteBookEntries",
                            "Parent template total entries=" + allEntries.size());
                    return allEntries;
                }

                // For child instances, return their direct entries
                Hibernate.initialize(notebook.getEntries());
                LogEvent.logInfo(this.getClass().getSimpleName(), "getNoteBookEntries",
                        "notebookId=" + notebookId + ", isTemplate=" + notebook.getIsTemplate() + ", entriesCount="
                                + notebook.getEntries().size());
                return notebook.getEntries();
            }
        } catch (Exception e) {
            // Handle cases like ObjectNotFoundException for non-existent IDs
            LogEvent.logDebug(this.getClass().getSimpleName(), "getNoteBookEntries",
                    "Notebook not found: " + notebookId);
        }
        return new ArrayList<>();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteBook> getAllActiveNotebooks() {
        // Get all notebooks that are not chilled
        List<NoteBookStatus> activeStatuses = List.of(NoteBookStatus.DRAFT, NoteBookStatus.SUBMITTED,
                NoteBookStatus.FINALIZED, NoteBookStatus.LOCKED);
        List<NoteBook> noteBooks = filterNoteBooks(activeStatuses, null, null, null, null);
        noteBooks.forEach(nb -> {
            Hibernate.initialize(nb.getDepartments());
            Hibernate.initialize(nb.getOrganizations());
            Hibernate.initialize(nb.getAllowedRoles());
        });
        return noteBooks;
    }

    @Override
    @Transactional
    public NoteBook createInstanceFromTemplate(Integer templateId, String title, String sysUserId) {
        NoteBook template = get(templateId);
        if (template == null) {
            throw new IllegalArgumentException("Template not found: " + templateId);
        }
        if (!template.getIsTemplate()) {
            throw new IllegalArgumentException("Notebook " + templateId + " is not a template");
        }

        // Initialize lazy collections
        Hibernate.initialize(template.getPages());
        Hibernate.initialize(template.getTags());
        Hibernate.initialize(template.getAnalysers());
        Hibernate.initialize(template.getDepartments());
        if (template.getPages() != null) {
            for (NoteBookPage page : template.getPages()) {
                Hibernate.initialize(page.getPanels());
                Hibernate.initialize(page.getTests());
            }
        }

        // Create new instance
        NoteBook instance = new NoteBook();
        instance.setTitle(title);
        instance.setIsTemplate(false);
        instance.setStatus(NoteBookStatus.DRAFT);
        instance.setDateCreated(new Date());
        instance.setType(template.getType());
        instance.setContent(template.getContent());
        instance.setObjective(template.getObjective());
        instance.setProtocol(template.getProtocol());
        instance.setQuestionnaireFhirUuid(template.getQuestionnaireFhirUuid());
        instance.setWorkflowType(template.getWorkflowType());

        // Copy tags
        if (template.getTags() != null) {
            instance.setTags(new ArrayList<>(template.getTags()));
        }

        // Copy analyzers (legacy)
        if (template.getAnalysers() != null) {
            instance.getAnalysers().addAll(template.getAnalysers());
        }

        // Copy inventory instruments
        if (template.getInventoryInstrumentIds() != null) {
            instance.getInventoryInstrumentIds().addAll(template.getInventoryInstrumentIds());
        }

        // Copy departments (for sample type validation)
        if (template.getDepartments() != null && !template.getDepartments().isEmpty()) {
            instance.getDepartments().addAll(template.getDepartments());
        }

        // Set creator and technician
        if (sysUserId != null) {
            instance.setSysUserId(sysUserId);
            instance.setCreator(systemUserService.get(sysUserId));
            instance.setTechnician(systemUserService.get(sysUserId));
        }

        // Copy pages
        if (template.getPages() != null) {
            for (NoteBookPage templatePage : template.getPages()) {
                // Initialize lazy collections for this page
                Hibernate.initialize(templatePage.getAllowedRoles());

                NoteBookPage instancePage = new NoteBookPage();
                instancePage.setTitle(templatePage.getTitle());
                instancePage.setOrder(templatePage.getOrder());
                instancePage.setContent(templatePage.getContent());
                instancePage.setInstructions(templatePage.getInstructions());
                instancePage.setPageId(templatePage.getPageId());
                instancePage.setPageType(templatePage.getPageType());
                instancePage.setSampleTypeId(templatePage.getSampleTypeId());
                instancePage.setNotebook(instance);

                // Copy panels and tests references
                if (templatePage.getPanels() != null) {
                    instancePage.getPanels().addAll(templatePage.getPanels());
                }
                if (templatePage.getTests() != null) {
                    instancePage.getTests().addAll(templatePage.getTests());
                }

                // Copy allowed roles for page-level access control
                if (templatePage.getAllowedRoles() != null && !templatePage.getAllowedRoles().isEmpty()) {
                    instancePage.getAllowedRoles().addAll(templatePage.getAllowedRoles());
                }

                instance.getPages().add(instancePage);
            }
        }

        // Save the instance
        instance = save(instance);

        // Link to template's entries list
        template.getEntries().add(instance);
        template.setSysUserId(sysUserId);
        update(template);

        return instance;
    }

    @Override
    @Transactional(readOnly = true)
    public NoteBookPage getPage(Integer pageId) {
        if (pageId == null) {
            return null;
        }
        return noteBookPageDAO.get(pageId).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public NoteBookPage getNextPage(Integer pageId) {
        if (pageId == null) {
            LogEvent.logDebug(this.getClass().getName(), "getNextPage", "pageId is null");
            return null;
        }

        NoteBookPage currentPage = noteBookPageDAO.get(pageId).orElse(null);
        if (currentPage == null) {
            LogEvent.logDebug(this.getClass().getName(), "getNextPage", "currentPage not found for pageId=" + pageId);
            return null;
        }

        // Get the notebook and its pages
        NoteBook notebook = currentPage.getNotebook();
        if (notebook == null) {
            LogEvent.logDebug(this.getClass().getName(), "getNextPage",
                    "notebook is null for pageId=" + pageId + " title='" + currentPage.getTitle() + "'");
            return null;
        }

        Hibernate.initialize(notebook.getPages());
        List<NoteBookPage> pages = notebook.getPages();
        if (pages == null || pages.isEmpty()) {
            LogEvent.logDebug(this.getClass().getName(), "getNextPage",
                    "pages is empty for notebook id=" + notebook.getId());
            return null;
        }

        // Sort pages by order and find the next one
        Integer currentOrder = getWorkflowStageOrder(currentPage);
        if (currentOrder == null) {
            LogEvent.logDebug(this.getClass().getName(), "getNextPage",
                    "currentOrder is null for pageId=" + pageId + " title='" + currentPage.getTitle() + "'");
            return null;
        }

        LogEvent.logInfo(this.getClass().getName(), "getNextPage",
                "Finding next page: currentPageId=" + pageId + " currentOrder=" + currentOrder + " title='"
                        + currentPage.getTitle() + "' notebookId=" + notebook.getId() + " totalPages=" + pages.size());

        // Log all pages for debugging
        for (NoteBookPage p : pages) {
            LogEvent.logDebug(this.getClass().getName(), "getNextPage",
                    "  Page: id=" + p.getId() + " order=" + p.getOrder() + " title='" + p.getTitle() + "'");
        }

        String workflowType = getEffectiveWorkflowType(notebook);
        NoteBookPage nextPage = pages.stream().filter(p -> isStageApplicableForWorkflow(workflowType, p))
                .filter(p -> getWorkflowStageOrder(p) != null && getWorkflowStageOrder(p) > currentOrder)
                .min((p1, p2) -> getWorkflowStageOrder(p1).compareTo(getWorkflowStageOrder(p2))).orElse(null);

        if (nextPage != null) {
            LogEvent.logInfo(this.getClass().getName(), "getNextPage", "Found next page: id=" + nextPage.getId()
                    + " order=" + nextPage.getOrder() + " title='" + nextPage.getTitle() + "'");
        } else {
            LogEvent.logInfo(this.getClass().getName(), "getNextPage",
                    "No next page found for currentOrder=" + currentOrder + " (this might be the last page)");
        }

        return nextPage;
    }

    @Override
    @Transactional(readOnly = true)
    public NoteBookPage getPreviousPage(Integer pageId) {
        if (pageId == null) {
            return null;
        }

        NoteBookPage currentPage = noteBookPageDAO.get(pageId).orElse(null);
        if (currentPage == null) {
            return null;
        }

        // Get the notebook and its pages
        NoteBook notebook = currentPage.getNotebook();
        if (notebook == null) {
            return null;
        }

        Hibernate.initialize(notebook.getPages());
        List<NoteBookPage> pages = notebook.getPages();
        if (pages == null || pages.isEmpty()) {
            return null;
        }

        // Sort pages by order and find the previous one
        Integer currentOrder = getWorkflowStageOrder(currentPage);
        if (currentOrder == null) {
            return null;
        }

        String workflowType = getEffectiveWorkflowType(notebook);
        return pages.stream().filter(p -> isStageApplicableForWorkflow(workflowType, p))
                .filter(p -> getWorkflowStageOrder(p) != null && getWorkflowStageOrder(p) < currentOrder)
                .max((p1, p2) -> getWorkflowStageOrder(p1).compareTo(getWorkflowStageOrder(p2))).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public NoteBookPage getLastPage(Integer notebookId) {
        if (notebookId == null) {
            return null;
        }

        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return null;
        }

        Hibernate.initialize(notebook.getPages());
        List<NoteBookPage> pages = notebook.getPages();
        if (pages == null || pages.isEmpty()) {
            return null;
        }

        // Find the archiving page by title (Disposal & Archiving)
        // This is where samples go after Storage or when routed to external/storage
        NoteBookPage archivingPage = pages.stream()
                .filter(p -> p.getTitle() != null && (p.getTitle().toLowerCase().contains("disposal")
                        || p.getTitle().toLowerCase().contains("archiving")))
                .findFirst().orElse(null);

        if (archivingPage != null) {
            return archivingPage;
        }

        // Fallback: Return page with order 7 (standard archiving page position)
        NoteBookPage order7Page = pages.stream().filter(p -> p.getOrder() != null && p.getOrder() == 7).findFirst()
                .orElse(null);

        if (order7Page != null) {
            return order7Page;
        }

        // Final fallback: Return the page with the highest order
        // (excluding Reference & SOP Module which is typically order 8)
        return pages.stream().filter(p -> p.getOrder() != null)
                .filter(p -> p.getTitle() == null || !p.getTitle().toLowerCase().contains("reference"))
                .max((p1, p2) -> p1.getOrder().compareTo(p2.getOrder())).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public NoteBookPage getPageByNotebookIdAndOrder(Integer notebookId, Integer pageOrder) {
        if (notebookId == null || pageOrder == null) {
            return null;
        }

        NoteBook notebook;
        try {
            notebook = get(notebookId);
        } catch (org.hibernate.ObjectNotFoundException e) {
            return null;
        }
        if (notebook == null) {
            return null;
        }

        Hibernate.initialize(notebook.getPages());
        List<NoteBookPage> pages = notebook.getPages();
        if (pages == null || pages.isEmpty()) {
            return null;
        }

        // Find page by order
        String workflowType = getEffectiveWorkflowType(notebook);
        return pages.stream().filter(p -> pageOrder.equals(getWorkflowStageOrder(p)))
                .filter(p -> isStageApplicableForWorkflow(workflowType, p)).findFirst().orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isRoutingPage(Integer pageId) {
        if (pageId == null) {
            return false;
        }
        NoteBookPage page = noteBookPageDAO.get(pageId).orElse(null);
        if (page == null) {
            return false;
        }

        // Only BRANCHING pages require SampleRouting before T150 advance.
        // CHILD_SAMPLE_CREATION is for linear child-creation pages (isolates, slides,
        // aliquots).
        String pageType = StringUtils.trimToEmpty(page.getPageType());
        return StringUtils.equalsIgnoreCase(pageType, "BRANCHING");
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isStoragePage(Integer pageId) {
        if (pageId == null) {
            return false;
        }
        NoteBookPage page = noteBookPageDAO.get(pageId).orElse(null);
        if (page == null) {
            return false;
        }

        String pageType = StringUtils.trimToEmpty(page.getPageType());
        return StringUtils.equalsIgnoreCase(pageType, "STORAGE_ASSIGNMENT")
                || StringUtils.equalsIgnoreCase(pageType, "PATHOLOGY_STORAGE_INVENTORY");
    }

    @Override
    @Transactional
    public Integer attachFile(Integer notebookId, byte[] fileData, String fileName, String fileType, String sysUserId) {
        if (notebookId == null) {
            throw new IllegalArgumentException("Notebook ID is required");
        }
        if (fileData == null || fileData.length == 0) {
            throw new IllegalArgumentException("File data is required");
        }
        if (fileName == null || fileName.isBlank()) {
            throw new IllegalArgumentException("File name is required");
        }

        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            throw new IllegalArgumentException("Notebook not found: " + notebookId);
        }

        // Create NoteBookFile record
        NoteBookFile file = new NoteBookFile();
        file.setNotebook(notebook);
        file.setFileData(fileData);
        file.setFileName(fileName);
        file.setFileType(fileType != null ? fileType : "application/octet-stream");

        // Initialize files list if needed
        if (notebook.getFiles() == null) {
            notebook.setFiles(new ArrayList<>());
        }
        notebook.getFiles().add(file);

        // Set sysUserId for audit trail
        if (sysUserId != null) {
            notebook.setSysUserId(sysUserId);
        }

        // Update notebook which will cascade to NoteBookFile
        update(notebook);

        return file.getId();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteBookFile> getFiles(Integer notebookId) {
        if (notebookId == null) {
            return new ArrayList<>();
        }

        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return new ArrayList<>();
        }

        Hibernate.initialize(notebook.getFiles());
        return notebook.getFiles() != null ? notebook.getFiles() : new ArrayList<>();
    }

    @Override
    @Transactional
    public int syncPagesFromTemplate(Integer instanceId, String sysUserId) {
        if (instanceId == null) {
            throw new IllegalArgumentException("Instance ID is required");
        }

        NoteBook instance = get(instanceId);
        if (instance == null) {
            throw new IllegalArgumentException("Notebook instance not found: " + instanceId);
        }

        if (instance.getIsTemplate() != null && instance.getIsTemplate()) {
            throw new IllegalArgumentException("Cannot sync pages for a template notebook");
        }

        // Find the parent template
        // First check if this is a child instance (has direct parentNotebook)
        NoteBook template = instance.getParentNotebook();
        if (template == null) {
            // Fallback: try to find parent via entries collection (legacy behavior)
            template = baseObjectDAO.findParentTemplate(instanceId);
        }
        if (template == null) {
            LogEvent.logWarn(this.getClass().getName(), "syncPagesFromTemplate",
                    "No parent template found for instance " + instanceId);
            return 0;
        }

        // Initialize pages collections
        Hibernate.initialize(template.getPages());
        Hibernate.initialize(instance.getPages());
        if (template.getPages() != null) {
            for (NoteBookPage p : template.getPages()) {
                Hibernate.initialize(p.getPanels());
                Hibernate.initialize(p.getTests());
            }
        }

        List<NoteBookPage> templatePages = template.getPages();
        List<NoteBookPage> instancePages = instance.getPages();

        if (templatePages == null || templatePages.isEmpty()) {
            return 0;
        }

        // Create a set of existing page orders in the instance
        java.util.Set<Integer> existingOrders = new java.util.HashSet<>();
        if (instancePages != null) {
            for (NoteBookPage p : instancePages) {
                if (p.getOrder() != null) {
                    existingOrders.add(p.getOrder());
                }
            }
        }

        // Add any missing pages from template to instance
        int addedCount = 0;
        for (NoteBookPage templatePage : templatePages) {
            Integer templateOrder = templatePage.getOrder();
            if (templateOrder == null) {
                continue; // Skip pages without order
            }

            if (!existingOrders.contains(templateOrder)) {
                // Initialize lazy collections for this page
                Hibernate.initialize(templatePage.getAllowedRoles());

                // This page is in template but not in instance - add it
                NoteBookPage newPage = new NoteBookPage();
                newPage.setTitle(templatePage.getTitle());
                newPage.setOrder(templatePage.getOrder());
                newPage.setContent(templatePage.getContent());
                newPage.setInstructions(templatePage.getInstructions());
                newPage.setPageId(templatePage.getPageId());
                newPage.setPageType(templatePage.getPageType());
                newPage.setSampleTypeId(templatePage.getSampleTypeId());
                newPage.setNotebook(instance);
                newPage.setCompleted(false);

                // Copy panels and tests references
                if (templatePage.getPanels() != null) {
                    newPage.getPanels().addAll(templatePage.getPanels());
                }
                if (templatePage.getTests() != null) {
                    newPage.getTests().addAll(templatePage.getTests());
                }

                // Copy allowed roles for page-level access control
                if (templatePage.getAllowedRoles() != null && !templatePage.getAllowedRoles().isEmpty()) {
                    newPage.getAllowedRoles().addAll(templatePage.getAllowedRoles());
                }

                instance.getPages().add(newPage);
                addedCount++;

                LogEvent.logInfo(this.getClass().getName(), "syncPagesFromTemplate", "Added page '"
                        + templatePage.getTitle() + "' (order=" + templateOrder + ") to instance " + instanceId);
            }
        }

        if (addedCount > 0) {
            // Set sysUserId for audit trail and update
            instance.setSysUserId(sysUserId);
            update(instance);
            LogEvent.logInfo(this.getClass().getName(), "syncPagesFromTemplate",
                    "Synced " + addedCount + " pages from template " + template.getId() + " to instance " + instanceId);
        }

        return addedCount;
    }

    @Override
    @Transactional
    public void updateTemplateOrganizations(Integer notebookId, List<String> organizationIds, String sysUserId) {
        if (notebookId == null) {
            return;
        }

        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return;
        }

        // Initialize lazy collections
        initializeLazyCollections(notebook);

        // Clear existing organizations and add new ones to the EXISTING collection
        notebook.getOrganizations().clear();
        if (organizationIds != null) {
            for (String orgId : organizationIds) {
                Organization org = organizationService.get(orgId);
                if (org != null) {
                    notebook.getOrganizations().add(org);
                }
            }
        }

        if (sysUserId != null) {
            notebook.setSysUserId(sysUserId);
        }

        update(notebook);
    }

    @Override
    @Transactional
    public void updateTemplateAllowedRoles(Integer notebookId, List<String> allowedRoles, String sysUserId) {
        if (notebookId == null) {
            return;
        }

        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return;
        }

        // Initialize lazy collections
        initializeLazyCollections(notebook);

        // Clear existing roles and add new ones to the EXISTING collection
        notebook.getAllowedRoles().clear();
        if (allowedRoles != null) {
            notebook.getAllowedRoles().addAll(allowedRoles);
        }

        if (sysUserId != null) {
            notebook.setSysUserId(sysUserId);
        }

        update(notebook);
    }

    @Override
    @Transactional
    public void updateTemplateDepartments(Integer notebookId, List<String> departmentIds, String sysUserId) {
        if (notebookId == null) {
            return;
        }

        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return;
        }

        // Initialize lazy collections
        initializeLazyCollections(notebook);

        // Clear existing departments and add new ones to the EXISTING collection
        notebook.getDepartments().clear();
        if (departmentIds != null) {
            for (String deptId : departmentIds) {
                TestSection ts = testSectionService.get(deptId);
                if (ts != null) {
                    notebook.getDepartments().add(ts);
                }
            }
        }

        if (sysUserId != null) {
            notebook.setSysUserId(sysUserId);
        }

        update(notebook);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<TestSection> getNoteBookDepartments(Integer notebookId) {
        if (notebookId == null) {
            return new HashSet<>();
        }
        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return new HashSet<>();
        }

        // For child instances, get departments from parent template
        // This ensures access control is always inherited from the authoritative source
        if (notebook.isChildInstance()) {
            NoteBook parentTemplate = notebook.getParentNotebook();
            if (parentTemplate != null) {
                Hibernate.initialize(parentTemplate.getDepartments());
                return parentTemplate.getDepartments();
            }
        }

        Hibernate.initialize(notebook.getDepartments());
        return notebook.getDepartments();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Organization> getNoteBookOrganizations(Integer notebookId) {
        if (notebookId == null) {
            return new HashSet<>();
        }
        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return new HashSet<>();
        }

        // For child instances, get organizations from parent template
        // This ensures access control is always inherited from the authoritative source
        if (notebook.isChildInstance()) {
            NoteBook parentTemplate = notebook.getParentNotebook();
            if (parentTemplate != null) {
                Hibernate.initialize(parentTemplate.getOrganizations());
                return parentTemplate.getOrganizations();
            }
        }

        Hibernate.initialize(notebook.getOrganizations());
        return notebook.getOrganizations();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> getNoteBookAllowedRoles(Integer notebookId) {
        if (notebookId == null) {
            return new HashSet<>();
        }
        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            return new HashSet<>();
        }

        // For child instances, get allowedRoles from parent template
        // This ensures roles are always inherited from the authoritative source
        if (notebook.isChildInstance()) {
            NoteBook parentTemplate = notebook.getParentNotebook();
            if (parentTemplate != null) {
                Hibernate.initialize(parentTemplate.getAllowedRoles());
                return parentTemplate.getAllowedRoles();
            }
        }

        // For templates and entries, use own allowedRoles
        Hibernate.initialize(notebook.getAllowedRoles());
        return notebook.getAllowedRoles();
    }

    @Override
    @Transactional(readOnly = true)
    public NoteBook getParentTemplate(Integer entryId) {
        if (entryId == null) {
            return null;
        }

        // First check if this notebook itself is a child instance (project)
        // If so, return its parent template directly
        NoteBook notebook;
        try {
            notebook = get(entryId);
        } catch (org.hibernate.ObjectNotFoundException e) {
            return null;
        }
        if (notebook == null) {
            return null;
        }

        // If this is a child instance, return its parent template directly
        if (notebook.isChildInstance()) {
            return notebook.getParentNotebook();
        }

        // Otherwise, search via entries collection (for regular entries)
        return baseObjectDAO.findParentTemplate(entryId);
    }

    // ========== Notebook Hierarchy Methods ==========

    @Override
    @Transactional
    public NoteBook createChildInstance(Integer parentId, String title, String sysUserId) {
        if (parentId == null) {
            throw new IllegalArgumentException("Parent ID is required");
        }

        NoteBook parent;
        try {
            parent = get(parentId);
        } catch (org.hibernate.ObjectNotFoundException e) {
            throw new IllegalArgumentException("Parent notebook not found: " + parentId);
        }
        if (parent == null) {
            throw new IllegalArgumentException("Parent notebook not found: " + parentId);
        }

        if (!parent.isParentTemplate()) {
            throw new IllegalArgumentException("Cannot create instance from non-template notebook: " + parentId);
        }

        // Initialize lazy collections from parent (except pages - we'll fetch those
        // separately)
        Hibernate.initialize(parent.getOrganizations());
        Hibernate.initialize(parent.getDepartments());
        Hibernate.initialize(parent.getAllowedRoles());
        Hibernate.initialize(parent.getTags());
        Hibernate.initialize(parent.getInventoryInstrumentIds());

        // Create new child instance
        NoteBook child = new NoteBook();
        child.setTitle(title != null ? title : parent.getTitle() + " - Instance");
        child.setIsTemplate(false);
        child.setParentNotebook(parent);
        child.setStatus(NoteBookStatus.ACTIVE);
        child.setDateCreated(new Date());
        child.setType(parent.getType());

        // Copy metadata (editable by child)
        child.setObjective(parent.getObjective());
        child.setProtocol(parent.getProtocol());
        child.setContent(parent.getContent());
        child.setQuestionnaireFhirUuid(parent.getQuestionnaireFhirUuid());
        child.setWorkflowType(parent.getWorkflowType());

        // Copy project metadata
        child.setPrincipalInvestigator(parent.getPrincipalInvestigator());
        child.setFundingSource(parent.getFundingSource());
        child.setBudget(parent.getBudget());
        child.setProjectTimeline(parent.getProjectTimeline());

        // Copy tags
        if (parent.getTags() != null) {
            child.setTags(new ArrayList<>(parent.getTags()));
        }

        // Copy access control (editable by child)
        if (parent.getOrganizations() != null) {
            child.setOrganizations(new HashSet<>(parent.getOrganizations()));
        }
        if (parent.getDepartments() != null) {
            child.setDepartments(new HashSet<>(parent.getDepartments()));
        }
        if (parent.getAllowedRoles() != null) {
            child.setAllowedRoles(new HashSet<>(parent.getAllowedRoles()));
        }

        // Copy instruments
        if (parent.getInventoryInstrumentIds() != null && !parent.getInventoryInstrumentIds().isEmpty()) {
            child.setInventoryInstrumentIds(new ArrayList<>(parent.getInventoryInstrumentIds()));
        }

        // Set creator
        if (sysUserId != null) {
            child.setSysUserId(sysUserId);
            child.setCreator(systemUserService.get(sysUserId));
            child.setTechnician(systemUserService.get(sysUserId));
        }

        // Fetch parent pages directly via DAO to avoid Hibernate session/cache issues
        // Using the entity's lazy collection can cause stale data problems when
        // multiple children are created
        List<NoteBookPage> parentPages = noteBookPageDAO.getByNotebookId(parentId);

        // Save child first to get ID
        child = save(child);

        // Copy pages from parent to child - use the DAO-fetched list to avoid session
        // issues
        if (!parentPages.isEmpty()) {
            for (NoteBookPage parentPage : parentPages) {
                NoteBookPage childPage = new NoteBookPage();
                childPage.setNotebook(child);
                childPage.setOrder(parentPage.getOrder());
                childPage.setTitle(parentPage.getTitle());
                childPage.setInstructions(parentPage.getInstructions());
                childPage.setContent(parentPage.getContent());
                childPage.setPageId(parentPage.getPageId());
                childPage.setPageType(parentPage.getPageType());
                childPage.setSampleTypeId(parentPage.getSampleTypeId());
                childPage.setCompleted(false); // Reset completion status for new instance

                // Copy panels and tests lists
                if (parentPage.getPanels() != null) {
                    childPage.setPanels(new ArrayList<>(parentPage.getPanels()));
                }
                if (parentPage.getTests() != null) {
                    childPage.setTests(new ArrayList<>(parentPage.getTests()));
                }

                // Copy allowed roles
                if (parentPage.getAllowedRoles() != null) {
                    childPage.setAllowedRoles(new HashSet<>(parentPage.getAllowedRoles()));
                }

                // Don't copy data - each instance starts fresh
                childPage.setSysUserId(sysUserId);

                // Save page explicitly via DAO
                noteBookPageDAO.insert(childPage);
            }
        }

        // Note: We do NOT add the child to the parent's childInstances collection here.
        // The relationship is already established via child.setParentNotebook(parent)
        // above.
        // Adding to childInstances and calling update(parent) would trigger cascades
        // that
        // can cause the child's pages to be incorrectly re-associated with the parent.
        // The childInstances collection can be loaded lazily via a query when needed.

        return child;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteBook> getChildInstances(Integer parentId) {
        if (parentId == null) {
            return new ArrayList<>();
        }
        return baseObjectDAO.findChildrenByParentId(parentId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotebookHierarchyDTO> getHierarchyTree() {
        List<NoteBook> parentTemplates = baseObjectDAO.findAllParentTemplates();
        List<NotebookHierarchyDTO> hierarchy = new ArrayList<>();

        for (NoteBook parent : parentTemplates) {
            NotebookHierarchyDTO parentDTO = new NotebookHierarchyDTO();
            parentDTO.setId(parent.getId());
            parentDTO.setTitle(parent.getTitle());
            parentDTO.setParentTemplate(true);
            parentDTO.setChildInstance(false);

            // Get children linked via parent_notebook_id
            List<NoteBook> children = baseObjectDAO.findChildrenByParentId(parent.getId());
            Set<Integer> childIds = new HashSet<>();
            long totalEntries = 0;
            for (NoteBook child : children) {
                childIds.add(child.getId());
                NotebookHierarchyDTO childDTO = buildChildHierarchyDTO(parent, child);
                totalEntries += childDTO.getEntryCount();
                parentDTO.addChild(childDTO);
            }

            // Legacy instances linked only via notebook_entries join table
            Hibernate.initialize(parent.getEntries());
            int trueOrphanEntries = 0;
            if (parent.getEntries() != null) {
                for (NoteBook legacy : parent.getEntries()) {
                    if (legacy == null) {
                        continue;
                    }
                    Hibernate.initialize(legacy.getParentNotebook());
                    if (!Boolean.TRUE.equals(legacy.getIsTemplate()) && legacy.getParentNotebook() == null) {
                        if (childIds.add(legacy.getId())) {
                            NotebookHierarchyDTO childDTO = buildChildHierarchyDTO(parent, legacy);
                            totalEntries += childDTO.getEntryCount();
                            parentDTO.addChild(childDTO);
                        }
                    } else {
                        trueOrphanEntries++;
                    }
                }
            }

            parentDTO.setOrphanEntryCount(trueOrphanEntries);
            parentDTO.setEntryCount(trueOrphanEntries); // For backwards compatibility

            // Total entries includes both children's entries and orphan entries
            parentDTO.setTotalEntries((int) totalEntries + trueOrphanEntries);

            hierarchy.add(parentDTO);
        }

        return hierarchy;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getAggregatedStatistics(Integer parentId) {
        Map<String, Long> stats = new HashMap<>();
        stats.put("totalEntries", 0L);
        stats.put("drafts", 0L);
        stats.put("pendingReview", 0L);
        stats.put("finalizedThisWeek", 0L);

        if (parentId == null) {
            return stats;
        }

        // Get all child instances
        List<NoteBook> children = baseObjectDAO.findChildrenByParentId(parentId);
        if (children.isEmpty()) {
            return stats;
        }

        // Calculate stats from all children's entries
        long totalEntries = 0;
        long drafts = 0;
        long pendingReview = 0;
        long finalizedThisWeek = 0;

        // Get the start of this week for finalized count
        LocalDateTime startOfWeek = LocalDateTime.now().minusDays(7);
        Timestamp weekStart = Timestamp.valueOf(startOfWeek);

        for (NoteBook child : children) {
            Hibernate.initialize(child.getEntries());
            List<NoteBook> entries = child.getEntries();
            if (entries != null) {
                for (NoteBook entry : entries) {
                    totalEntries++;

                    if (entry.getStatus() == NoteBookStatus.DRAFT) {
                        drafts++;
                    } else if (entry.getStatus() == NoteBookStatus.SUBMITTED) {
                        pendingReview++;
                    } else if (entry.getStatus() == NoteBookStatus.FINALIZED) {
                        // Check if finalized this week
                        if (entry.getLastupdated() != null && entry.getLastupdated().after(weekStart)) {
                            finalizedThisWeek++;
                        }
                    }
                }
            }
        }

        stats.put("totalEntries", totalEntries);
        stats.put("drafts", drafts);
        stats.put("pendingReview", pendingReview);
        stats.put("finalizedThisWeek", finalizedThisWeek);

        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canAcceptEntries(Integer notebookId) {
        if (notebookId == null) {
            return false;
        }

        try {
            NoteBook notebook = get(notebookId);
            if (notebook == null) {
                return false;
            }

            // Only child instances can accept entries directly
            return notebook.isChildInstance();
        } catch (org.hibernate.ObjectNotFoundException e) {
            return false;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteBook> getAllParentTemplates() {
        List<NoteBook> parents = baseObjectDAO.findAllParentTemplates();
        // Initialize lazy collections for security checks
        for (NoteBook parent : parents) {
            Hibernate.initialize(parent.getOrganizations());
            Hibernate.initialize(parent.getDepartments());
            Hibernate.initialize(parent.getAllowedRoles());
        }
        return parents;
    }

    @Override
    @Transactional
    public void addEntry(Integer notebookId, NoteBook entry, String sysUserId) {
        if (notebookId == null || entry == null) {
            throw new IllegalArgumentException("Notebook ID and entry are required");
        }

        NoteBook notebook = get(notebookId);
        if (notebook == null) {
            throw new IllegalArgumentException("Notebook not found: " + notebookId);
        }

        // Initialize the entries collection within this transaction
        Hibernate.initialize(notebook.getEntries());

        // Add the entry to the collection
        notebook.getEntries().add(entry);

        // Set sysUserId for audit trail
        if (sysUserId != null) {
            notebook.setSysUserId(sysUserId);
        }

        // Save the changes
        update(notebook);
    }

    @Override
    @Transactional
    public Integer insert(NoteBook notebook) {
        // Note: Audit logging handled by save() method to avoid duplicates
        return super.insert(notebook);
    }

    @Override
    @Transactional
    public NoteBook save(NoteBook notebook) {
        boolean isNew = notebook.getId() == null;
        NoteBook saved = super.save(notebook);
        try {
            String activity = isNew ? "I" : "U";
            String sysUserId = saved.getSysUserId();
            if (sysUserId == null || sysUserId.isEmpty()) {
                LogEvent.logDebug("NoteBookService", "save",
                        "sysUserId is null, audit log will be created without user info");
            }
            notebookAuditService.saveAuditLog(saved, "notebook", activity, sysUserId);
        } catch (Exception e) {
            LogEvent.logWarn("NoteBookService", "save", "Failed to save notebook audit log: " + e.getMessage());
        }
        return saved;
    }

    @Override
    @Transactional
    public NoteBook update(NoteBook notebook) {
        NoteBook updated = super.update(notebook);
        try {
            String sysUserId = updated.getSysUserId();
            if (sysUserId == null || sysUserId.isEmpty()) {
                LogEvent.logDebug("NoteBookService", "update",
                        "sysUserId is null, audit log will be created without user info");
            }
            notebookAuditService.saveAuditLog(updated, "notebook", "U", sysUserId);
        } catch (Exception e) {
            LogEvent.logWarn("NoteBookService", "update", "Failed to save notebook audit log: " + e.getMessage());
        }
        return updated;
    }

    @Override
    @Transactional
    public void delete(NoteBook notebook) {
        try {
            String sysUserId = notebook.getSysUserId();
            if (sysUserId == null || sysUserId.isEmpty()) {
                LogEvent.logDebug("NoteBookService", "delete",
                        "sysUserId is null, audit log will be created without user info");
            }
            notebookAuditService.saveAuditLog(notebook, "notebook", "D", sysUserId);
        } catch (Exception e) {
            LogEvent.logWarn("NoteBookService", "delete", "Failed to save notebook audit log: " + e.getMessage());
        }
        super.delete(notebook);
    }

    @Override
    @Transactional(readOnly = true)
    public String getEffectiveWorkflowType(NoteBook noteBook) {
        if (noteBook == null) {
            return null;
        }
        String workflowType = getWorkflowTypeIfPresent(noteBook);
        if (workflowType != null) {
            return workflowType;
        }

        if (noteBook.isChildInstance()) {
            workflowType = getWorkflowTypeIfPresent(noteBook.getParentNotebook());
            if (workflowType != null) {
                return workflowType;
            }
        }

        if (!Boolean.TRUE.equals(noteBook.getIsTemplate())) {
            NoteBook parentTemplate = baseObjectDAO.findParentTemplate(noteBook.getId());
            workflowType = getWorkflowTypeIfPresent(parentTemplate);
            if (workflowType != null) {
                return workflowType;
            }

            if (parentTemplate != null && parentTemplate.isChildInstance()) {
                workflowType = getWorkflowTypeIfPresent(parentTemplate.getParentNotebook());
                if (workflowType != null) {
                    return workflowType;
                }
            }
        }

        return null;
    }

    private String getWorkflowTypeIfPresent(NoteBook noteBook) {
        if (noteBook == null || noteBook.getWorkflowType() == null) {
            return null;
        }
        String normalizedPathologyType = PathologyWorkflowTypeConfig.normalizeWorkflowType(noteBook.getWorkflowType());
        return normalizedPathologyType != null ? normalizedPathologyType : noteBook.getWorkflowType();
    }

    private boolean isStageApplicableForWorkflow(String workflowType, NoteBookPage page) {
        if (page == null) {
            return true;
        }
        if (!PathologyWorkflowTypeConfig.isPathologyWorkflowType(workflowType)) {
            return true;
        }
        return PathologyWorkflowTypeConfig.isStageEnabledForPage(workflowType, page.getTitle(), page.getOrder());
    }

    private Integer getWorkflowStageOrder(NoteBookPage page) {
        if (page == null) {
            return null;
        }
        return PathologyWorkflowTypeConfig.canonicalStageOrder(page.getTitle(), page.getOrder());
    }

    private Dictionary resolveExperimentTypeDictionary(String typeName) {
        if (GenericValidator.isBlankOrNull(typeName)) {
            return null;
        }

        String trimmed = typeName.trim();
        Dictionary existing = dictionaryService.getDictionaryByDictEntry(trimmed);
        if (existing != null) {
            return existing;
        }

        DictionaryCategory category = dictionaryCategoryService.getDictionaryCategoryByName("notebook_experiment_type");
        if (category == null) {
            LogEvent.logWarn(this.getClass().getSimpleName(), "resolveExperimentTypeDictionary",
                    "notebook_experiment_type category not found for type: " + trimmed);
            return null;
        }

        Dictionary newEntry = new Dictionary();
        newEntry.setDictEntry(trimmed);
        newEntry.setLocalAbbreviation(trimmed);
        newEntry.setIsActive(IActionConstants.YES);
        newEntry.setDictionaryCategory(category);
        String id = dictionaryService.insert(newEntry);
        newEntry.setId(id);
        return newEntry;
    }

}
