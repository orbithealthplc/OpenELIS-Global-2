package org.openelisglobal.biorepository.demo;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import org.openelisglobal.biorepository.service.BioSampleService;
import org.openelisglobal.biorepository.service.SampleTransferService;
import org.openelisglobal.biorepository.valueholder.BioSample;
import org.openelisglobal.biorepository.valueholder.BioSample.BiosafetyLevel;
import org.openelisglobal.biorepository.valueholder.BioSample.WorkflowStatus;
import org.openelisglobal.biorepository.valueholder.SampleTransferRequest;
import org.openelisglobal.sample.service.SampleService;
import org.openelisglobal.sample.valueholder.Sample;
import org.openelisglobal.sampleitem.service.SampleItemService;
import org.openelisglobal.sampleitem.valueholder.SampleItem;
import org.openelisglobal.systemuser.service.SystemUserService;
import org.openelisglobal.systemuser.valueholder.SystemUser;
import org.openelisglobal.typeofsample.service.TypeOfSampleService;
import org.openelisglobal.typeofsample.valueholder.TypeOfSample;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.stereotype.Component;

/**
 * Optionally seeds biorepository demo rows so the two main custody paths can be exercised without manual SQL:
 * <strong>Sample Request &amp; Retrieval</strong> for already stored specimens and <strong>Sample Transfer
 * Queue</strong> for inbound samples from another lab.
 *
 * <p><strong>Enable</strong> (then restart Tomcat): set in {@code common.properties}:
 *
 * <pre>
 * org.openelisglobal.biorepository.seedRetrievalDemo=true
 * </pre>
 *
 * <p>The seed is idempotent: retrieval and transfer demo rows are checked independently, so enabling the property
 * later can still add the transfer queue demo even if retrieval specimens already exist.
 *
 * <p><strong>How to search in New Request:</strong>
 *
 * <ul>
 *   <li>Barcode: {@code DEMO-RETRIEVAL-ALPHA} or {@code DEMO-RETRIEVAL-BETA}
 *   <li>Origin lab (exact): {@code DEMO National Lab}
 *   <li>Project ID (exact): {@code DEMO-RETR-PROJ}
 *   <li>Transfer Queue source lab: {@code DEMO Pathology Lab}
 * </ul>
 */
@Component
@Conditional(OnRetrievalDemoSeedPropertyCondition.class)
public class BiorepositoryRetrievalDemoSeed implements ApplicationListener<ContextRefreshedEvent> {

    private static final Logger LOGGER = LoggerFactory.getLogger(BiorepositoryRetrievalDemoSeed.class);

    public static final String DEMO_BARCODE_ALPHA = "DEMO-RETRIEVAL-ALPHA";
    public static final String DEMO_BARCODE_BETA = "DEMO-RETRIEVAL-BETA";
    public static final String DEMO_TRANSFER_BARCODE_ALPHA = "DEMO-TRANSFER-ALPHA";
    public static final String DEMO_TRANSFER_BARCODE_BETA = "DEMO-TRANSFER-BETA";

    private static final String DEMO_ORIGIN_LAB = "DEMO National Lab";
    private static final String DEMO_PROJECT_ID = "DEMO-RETR-PROJ";
    private static final String DEMO_TRANSFER_SOURCE_LAB = "DEMO Pathology Lab";

    private final AtomicBoolean seeded = new AtomicBoolean(false);

    @Autowired
    private BioSampleService bioSampleService;

    @Autowired
    private SampleService sampleService;

    @Autowired
    private SampleItemService sampleItemService;

    @Autowired
    private SampleTransferService sampleTransferService;

    @Autowired
    private TypeOfSampleService typeOfSampleService;

    @Autowired
    private SystemUserService systemUserService;

    @Override
    public void onApplicationEvent(ContextRefreshedEvent event) {
        if (event.getApplicationContext().getParent() != null) {
            return;
        }
        if (!seeded.compareAndSet(false, true)) {
            return;
        }

        try {
            runSeed();
        } catch (Exception ex) {
            LOGGER.warn("Biorepository retrieval demo seed failed: {}", ex.getMessage(), ex);
        }
    }

    private void runSeed() {
        TypeOfSample sampleType = resolveSampleType();
        if (sampleType == null) {
            LOGGER.warn("Skipping biorepository demo seed: no sample type configured.");
            return;
        }

        String actorSysUserId = resolveActorSysUserId();
        Timestamp nowTs = Timestamp.from(Instant.now());

        seedRetrievalSamples(sampleType, actorSysUserId, nowTs);
        seedTransferQueue(sampleType, actorSysUserId, nowTs);
    }

    private void seedRetrievalSamples(TypeOfSample sampleType, String actorSysUserId, Timestamp nowTs) {
        if (bioSampleService.barcodeExists(DEMO_BARCODE_ALPHA)) {
            LOGGER.info("Biorepository retrieval demo samples already present (barcode {}); skipping seed.",
                    DEMO_BARCODE_ALPHA);
            return;
        }

        Sample sampleAlpha = persistSample(actorSysUserId, "DEMO-ACC-ALPHA", nowTs);
        Sample sampleBeta = persistSample(actorSysUserId, "DEMO-ACC-BETA", nowTs);

        SampleItem itemAlpha = persistSampleItem(sampleAlpha, sampleType, actorSysUserId, DEMO_BARCODE_ALPHA, nowTs);
        SampleItem itemBeta = persistSampleItem(sampleBeta, sampleType, actorSysUserId, DEMO_BARCODE_BETA, nowTs);

        persistBioSample(itemAlpha, actorSysUserId, "Demonstration specimen A — safe to request/return.");
        persistBioSample(itemBeta, actorSysUserId, "Demonstration specimen B — for multi-line manifest tests.");

        LOGGER.info(
                "Biorepository retrieval demo samples created. Search by barcode {}, {}, origin lab [{}], project [{}].",
                DEMO_BARCODE_ALPHA, DEMO_BARCODE_BETA, DEMO_ORIGIN_LAB, DEMO_PROJECT_ID);
    }

    private void seedTransferQueue(TypeOfSample sampleType, String actorSysUserId, Timestamp nowTs) {
        List<SampleItem> transferItems = findSampleItems(DEMO_TRANSFER_BARCODE_ALPHA);
        if (!transferItems.isEmpty()) {
            Integer sampleItemId = toIntegerId(transferItems.get(0));
            if (sampleItemId != null && (sampleTransferService.hasPendingTransfer(sampleItemId)
                    || bioSampleService.existsBySampleItemId(sampleItemId))) {
                LOGGER.info("Biorepository transfer demo already present for barcode {}; skipping transfer seed.",
                        DEMO_TRANSFER_BARCODE_ALPHA);
                return;
            }
        }

        SampleItem itemAlpha = ensureTransferSampleItem(sampleType, actorSysUserId, DEMO_TRANSFER_BARCODE_ALPHA,
                "DEMO-XFER-ACC-ALPHA", nowTs);
        SampleItem itemBeta = ensureTransferSampleItem(sampleType, actorSysUserId, DEMO_TRANSFER_BARCODE_BETA,
                "DEMO-XFER-ACC-BETA", nowTs);

        List<Integer> sampleItemIds = new ArrayList<>();
        addTransferEligibleSampleItem(sampleItemIds, itemAlpha);
        addTransferEligibleSampleItem(sampleItemIds, itemBeta);
        if (sampleItemIds.isEmpty()) {
            LOGGER.info("Biorepository transfer demo already present or unavailable; skipping transfer seed.");
            return;
        }

        SampleTransferRequest request = sampleTransferService.createTransferRequest(DEMO_TRANSFER_SOURCE_LAB,
                sampleItemIds,
                "Demo inbound transfer to Biorepository. Accept one item to create a PENDING_STORAGE BioSample.",
                actorSysUserId);

        LOGGER.info("Biorepository transfer demo request created: id={}, sourceLab={}, barcodes={}, {}.",
                request.getId(), DEMO_TRANSFER_SOURCE_LAB, DEMO_TRANSFER_BARCODE_ALPHA, DEMO_TRANSFER_BARCODE_BETA);
    }

    private TypeOfSample resolveSampleType() {
        List<TypeOfSample> types = typeOfSampleService.getAll();
        if (types != null && !types.isEmpty()) {
            return types.get(0);
        }
        return null;
    }

    /** Prefer an unrestricted admin/login user pattern if present so department isolation rarely hides demo rows. */
    private String resolveActorSysUserId() {
        List<SystemUser> users = systemUserService.getAllSystemUsers();
        if (users == null || users.isEmpty()) {
            return "1";
        }
        Predicate<SystemUser> active = u -> "Y".equalsIgnoreCase(u.getIsActive());
        Predicate<SystemUser> administrator = u -> u.getLoginName() != null && u.getLoginName().toLowerCase().contains(
                "administrator");
        return users.stream()
                .filter(active)
                .filter(administrator)
                .findFirst()
                .or(() -> users.stream().filter(active).findFirst())
                .map(SystemUser::getId)
                .orElse("1");
    }

    private Sample persistSample(String sysUserId, String accessionNumber, Timestamp nowTs) {
        Sample sample = new Sample();
        sample.setAccessionNumber(accessionNumber);
        sample.setReceivedTimestamp(nowTs);
        sample.setEnteredDate(new java.sql.Date(nowTs.getTime()));
        sample.setDomain("H");
        sample.setSysUserId(sysUserId);
        return sampleService.save(sample);
    }

    private SampleItem ensureTransferSampleItem(TypeOfSample sampleType, String actorSysUserId, String barcode,
            String accessionNumber, Timestamp nowTs) {
        List<SampleItem> existing = findSampleItems(barcode);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        Sample sample = persistSample(actorSysUserId, accessionNumber, nowTs);
        return persistSampleItem(sample, sampleType, actorSysUserId, barcode, nowTs);
    }

    private List<SampleItem> findSampleItems(String barcode) {
        List<SampleItem> items = sampleItemService.getSampleItemsByExternalID(barcode);
        return items != null ? items : List.of();
    }

    private Integer toIntegerId(SampleItem item) {
        if (item == null || item.getId() == null) {
            return null;
        }
        try {
            return Integer.valueOf(item.getId());
        } catch (NumberFormatException e) {
            LOGGER.warn("Biorepository demo sample item has non-numeric id {} for barcode {}; skipping item.",
                    item.getId(), item.getExternalId());
            return null;
        }
    }

    private void addTransferEligibleSampleItem(List<Integer> sampleItemIds, SampleItem item) {
        Integer id = toIntegerId(item);
        if (id == null) {
            return;
        }
        if (sampleTransferService.hasPendingTransfer(id) || bioSampleService.existsBySampleItemId(id)) {
            LOGGER.info("Skipping demo transfer sample {} because it is already pending or accepted.",
                    item.getExternalId());
            return;
        }
        sampleItemIds.add(id);
    }

    private SampleItem persistSampleItem(Sample sample, TypeOfSample sampleType, String sysUserId, String barcode,
            Timestamp nowTs) {
        SampleItem item = new SampleItem();
        item.setSample(sample);
        item.setExternalId(barcode);
        item.setTypeOfSample(sampleType);
        item.setSortOrder("1");
        item.setQuantity(10.0);
        item.setCollectionDate(nowTs);
        item.setStatusId("1");
        item.setSysUserId(sysUserId);
        return sampleItemService.save(item);
    }

    private void persistBioSample(SampleItem sampleItem, String sysUserId, String specialHandlingHint) {
        BioSample bioSample = new BioSample();
        bioSample.setBiosafetyLevel(BiosafetyLevel.BSL_1);
        bioSample.setWorkflowStatus(WorkflowStatus.STORED);
        bioSample.setSysUserId(sysUserId);
        bioSample.setOriginLab(DEMO_ORIGIN_LAB);
        bioSample.setProjectId(DEMO_PROJECT_ID);
        bioSample.setEthicsApprovalRef("DEMO-ETHICS-LOCAL");
        bioSample.setPrincipalInvestigator("Demo PI");
        bioSample.setSpecialHandling(specialHandlingHint);
        bioSampleService.createForSampleItem(sampleItem, bioSample);
    }
}
