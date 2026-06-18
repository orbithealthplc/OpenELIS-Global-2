import React from "react";
import {
  Modal,
  StructuredListWrapper,
  StructuredListBody,
  StructuredListRow,
  StructuredListCell,
} from "@carbon/react";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";

const DETAIL_FIELDS = [
  {
    key: "barcode",
    id: "biorepository.sample.field.barcode",
    defaultMessage: "Barcode / Sample ID",
  },
  {
    key: "accessionNumber",
    id: "biorepository.sample.field.accessionNumber",
    defaultMessage: "Accession Number",
  },
  {
    key: "sampleType",
    id: "biorepository.sample.field.sampleType",
    defaultMessage: "Sample Type",
  },
  {
    key: "originLab",
    id: "biorepository.sample.field.originLab",
    defaultMessage: "Origin Lab",
  },
  {
    key: "projectId",
    id: "biorepository.sample.field.projectId",
    defaultMessage: "Project",
  },
  {
    key: "receiptDate",
    id: "biorepository.sample.field.receiptDate",
    defaultMessage: "Receipt Date",
  },
  {
    key: "collectionDate",
    id: "biorepository.sample.field.collectionDate",
    defaultMessage: "Collection Date",
  },
  {
    key: "biosafetyLevel",
    id: "biorepository.sample.field.biosafetyLevel",
    defaultMessage: "Biosafety Classification Level",
  },
  {
    key: "principalInvestigator",
    id: "biorepository.sample.field.principalInvestigator",
    defaultMessage: "Principal Investigator",
  },
  {
    key: "consentId",
    id: "biorepository.sample.field.consentId",
    defaultMessage: "Consent ID",
  },
  {
    key: "ethicsApprovalRef",
    id: "biorepository.sample.field.ethicsApprovalRef",
    defaultMessage: "Ethics Approval Ref",
  },
  {
    key: "mtaReference",
    id: "biorepository.sample.field.mtaReference",
    defaultMessage: "MTA Reference",
  },
  {
    key: "preservationMedium",
    id: "biorepository.sample.field.preservationMedium",
    defaultMessage: "Preservation Medium",
  },
  {
    key: "arrivalCondition",
    id: "biorepository.sample.field.arrivalCondition",
    defaultMessage: "Arrival Condition",
  },
  {
    key: "requiredTempMin",
    id: "biorepository.sample.field.requiredTempMin",
    defaultMessage: "Required Temp Min",
  },
  {
    key: "requiredTempMax",
    id: "biorepository.sample.field.requiredTempMax",
    defaultMessage: "Required Temp Max",
  },
  {
    key: "specialHandling",
    id: "biorepository.sample.field.specialHandling",
    defaultMessage: "Sample Detail / Notes",
  },
  {
    key: "workflowStatus",
    id: "biorepository.sample.field.status",
    defaultMessage: "Status",
  },
  {
    key: "documentationStatus",
    id: "biorepository.sample.field.documentationStatus",
    defaultMessage: "Documentation",
  },
];

function formatDetailValue(sample, key) {
  if (!sample) {
    return "-";
  }
  if (key === "sampleType") {
    return sample.sampleType?.description || "-";
  }
  if (key === "receiptDate" && sample.receiptDate) {
    return new Date(sample.receiptDate).toLocaleString();
  }
  if (key === "collectionDate" && sample.collectionDate) {
    return new Date(sample.collectionDate).toLocaleString();
  }
  const value = sample[key];
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function BioSampleDetailModal({ open, sample, onClose }) {
  const intl = useIntl();

  return (
    <Modal
      open={open}
      modalHeading={intl.formatMessage({
        id: "biorepository.inventory.sampleDetail.title",
        defaultMessage: "Sample Details",
      })}
      primaryButtonText={intl.formatMessage({
        id: "button.close",
        defaultMessage: "Close",
      })}
      onRequestClose={onClose}
      onRequestSubmit={onClose}
      size="md"
    >
      <StructuredListWrapper>
        <StructuredListBody>
          {DETAIL_FIELDS.map((field) => (
            <StructuredListRow key={field.key}>
              <StructuredListCell head>
                <FormattedMessage
                  id={field.id}
                  defaultMessage={field.defaultMessage}
                />
              </StructuredListCell>
              <StructuredListCell>
                {formatDetailValue(sample, field.key)}
              </StructuredListCell>
            </StructuredListRow>
          ))}
        </StructuredListBody>
      </StructuredListWrapper>
    </Modal>
  );
}

BioSampleDetailModal.propTypes = {
  open: PropTypes.bool.isRequired,
  sample: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

export default BioSampleDetailModal;
