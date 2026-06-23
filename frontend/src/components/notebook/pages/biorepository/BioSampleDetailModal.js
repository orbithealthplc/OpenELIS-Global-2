import React from "react";
import {
  Modal,
  StructuredListWrapper,
  StructuredListBody,
  StructuredListRow,
  StructuredListCell,
} from "@carbon/react";
import { useIntl } from "react-intl";
import PropTypes from "prop-types";
import {
  buildDetailModalFields,
  formatDetailFieldValue,
  mapBioSampleToExcelFields,
} from "./biorepositoryExcelColumns";

function BioSampleDetailModal({ open, sample, onClose }) {
  const intl = useIntl();
  const fields = mapBioSampleToExcelFields(sample);
  const detailFields = buildDetailModalFields(intl);

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
      size="lg"
    >
      <StructuredListWrapper>
        <StructuredListBody>
          {detailFields.map((field) => (
            <StructuredListRow key={field.key}>
              <StructuredListCell head>{field.label}</StructuredListCell>
              <StructuredListCell>
                {formatDetailFieldValue(fields, field.key)}
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
