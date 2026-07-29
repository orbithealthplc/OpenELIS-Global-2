import React, { useState, useCallback } from "react";
import {
  Tile,
  TextInput,
  NumberInput,
  Button,
  InlineNotification,
} from "@carbon/react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  getFromOpenElisServer,
  postToOpenElisServerJsonResponse,
} from "../../../utils/Utils";

/**
 * SampleDuplicationSection - User-defined sub-sample creation from a parent sample.
 */
function SampleDuplicationSection({ onSamplesCreated }) {
  const intl = useIntl();
  const [parentBarcode, setParentBarcode] = useState("");
  const [subsampleCount, setSubsampleCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleCreateSubsamples = useCallback(() => {
    const barcode = parentBarcode.trim();
    const count = Number(subsampleCount);
    if (!barcode) {
      setError(
        intl.formatMessage({
          id: "biorepository.duplication.error.parentRequired",
          defaultMessage: "Enter the parent sample ID (barcode).",
        }),
      );
      return;
    }
    if (!Number.isFinite(count) || count < 2 || count > 99) {
      setError(
        intl.formatMessage({
          id: "biorepository.duplication.error.invalidCount",
          defaultMessage: "Sub-sample count must be between 2 and 99.",
        }),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    getFromOpenElisServer(
      `/rest/biorepository/sample/search?externalId=${encodeURIComponent(barcode)}&limit=1`,
      (searchData) => {
        const parent = Array.isArray(searchData) ? searchData[0] : null;
        if (!parent) {
          setLoading(false);
          setError(
            intl.formatMessage({
              id: "biorepository.duplication.error.parentNotFound",
              defaultMessage: "Parent sample not found.",
            }),
          );
          return;
        }

        const samples = Array.from({ length: count }, (_, index) => ({
          externalId: `${barcode}-${String(index + 1).padStart(2, "0")}`,
          sampleType: parent.sampleType || parent.sampleTypeName,
          originLab: parent.originLab,
          biosafetyLevel: parent.biosafetyLevel || "BSL_2",
          projectName: parent.projectName || parent.projectId,
          parentExternalId: barcode,
          notes: `Sub-sample ${index + 1} of ${count} from parent ${barcode}`,
        }));

        postToOpenElisServerJsonResponse(
          "/rest/biorepository/sample/register-bulk",
          JSON.stringify({ samples }),
          (result) => {
            setLoading(false);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setSuccess(
              intl.formatMessage(
                {
                  id: "biorepository.duplication.success",
                  defaultMessage: "Created {count} sub-samples from {parent}.",
                },
                { count, parent: barcode },
              ),
            );
            setParentBarcode("");
            setSubsampleCount(2);
            if (onSamplesCreated) {
              onSamplesCreated();
            }
          },
        );
      },
    );
  }, [parentBarcode, subsampleCount, intl, onSamplesCreated]);

  return (
    <Tile style={{ marginTop: "1rem" }}>
      <h4 style={{ marginBottom: "0.75rem" }}>
        <FormattedMessage
          id="biorepository.duplication.title"
          defaultMessage="User-Defined Sample Duplication"
        />
      </h4>
      <p
        style={{ color: "#525252", marginBottom: "1rem", fontSize: "0.875rem" }}
      >
        <FormattedMessage
          id="biorepository.duplication.description"
          defaultMessage="Create multiple sub-samples from one registered parent sample (e.g., 30 aliquots from one patient sample)."
        />
      </p>

      {error && (
        <InlineNotification
          kind="error"
          title={intl.formatMessage({
            id: "error.title",
            defaultMessage: "Error",
          })}
          subtitle={error}
          lowContrast
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}
      {success && (
        <InlineNotification
          kind="success"
          title={success}
          lowContrast
          onCloseButtonClick={() => setSuccess(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          alignItems: "end",
        }}
      >
        <TextInput
          id="duplication-parent-barcode"
          labelText={intl.formatMessage({
            id: "biorepository.duplication.parentBarcode",
            defaultMessage: "Parent Sample ID",
          })}
          value={parentBarcode}
          onChange={(e) => setParentBarcode(e.target.value)}
        />
        <NumberInput
          id="duplication-count"
          label={intl.formatMessage({
            id: "biorepository.duplication.count",
            defaultMessage: "Number of sub-samples",
          })}
          min={2}
          max={99}
          value={subsampleCount}
          onChange={(_, { value }) => setSubsampleCount(value)}
        />
        <Button
          kind="primary"
          onClick={handleCreateSubsamples}
          disabled={loading}
        >
          <FormattedMessage
            id="biorepository.duplication.create"
            defaultMessage="Create Sub-samples"
          />
        </Button>
      </div>
    </Tile>
  );
}

export default SampleDuplicationSection;
