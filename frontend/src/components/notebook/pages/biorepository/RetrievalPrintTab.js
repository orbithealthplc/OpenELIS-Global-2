import React, { useState, useCallback } from "react";
import {
  Button,
  InlineNotification,
  InlineLoading,
  DatePicker,
  DatePickerInput,
} from "@carbon/react";
import { DocumentPdf, Download } from "@carbon/icons-react";
import { FormattedMessage, useIntl } from "react-intl";
import PropTypes from "prop-types";
import config from "../../../../config.json";

/**
 * RetrievalPrintTab - Export all sample retrieval transactions to PDF.
 */
function RetrievalPrintTab({ refreshToken }) {
  const intl = useIntl();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const formatDateParam = (dateArr) => {
    if (!dateArr || !dateArr[0]) return "";
    const d = dateArr[0];
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const query = params.toString();
    const url = `${config.serverBaseUrl}/rest/biorepository/custody/export/pdf${query ? `?${query}` : ""}`;

    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        let message = "Export failed";
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {
          // not JSON
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `biorepository_retrieval_transactions_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to export PDF");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <div className="retrieval-print-tab" style={{ padding: "1rem 0" }}>
      <p style={{ color: "#525252", marginBottom: "1rem" }}>
        <FormattedMessage
          id="biorepository.retrieval.print.description"
          defaultMessage="Export chain-of-custody and retrieval transaction records to a printable PDF. Optionally filter by date range."
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
          title={intl.formatMessage({
            id: "biorepository.retrieval.print.success",
            defaultMessage: "PDF downloaded",
          })}
          subtitle={intl.formatMessage({
            id: "biorepository.retrieval.print.successDetail",
            defaultMessage:
              "Retrieval transaction report saved to your downloads folder.",
          })}
          lowContrast
          onCloseButtonClick={() => setSuccess(false)}
          style={{ marginBottom: "1rem" }}
        />
      )}

      <div
        style={{
          display: "grid",
          gap: "1rem",
          maxWidth: "32rem",
          marginBottom: "1.5rem",
        }}
      >
        <DatePicker
          datePickerType="single"
          onChange={(dates) => setStartDate(formatDateParam(dates))}
        >
          <DatePickerInput
            id="retrieval-print-start"
            labelText={intl.formatMessage({
              id: "biorepository.retrieval.print.startDate",
              defaultMessage: "Start date (optional)",
            })}
            placeholder="yyyy-mm-dd"
          />
        </DatePicker>
        <DatePicker
          datePickerType="single"
          onChange={(dates) => setEndDate(formatDateParam(dates))}
        >
          <DatePickerInput
            id="retrieval-print-end"
            labelText={intl.formatMessage({
              id: "biorepository.retrieval.print.endDate",
              defaultMessage: "End date (optional)",
            })}
            placeholder="yyyy-mm-dd"
          />
        </DatePicker>
      </div>

      {loading ? (
        <InlineLoading
          description={intl.formatMessage({
            id: "biorepository.retrieval.print.generating",
            defaultMessage: "Generating PDF...",
          })}
        />
      ) : (
        <Button
          kind="primary"
          renderIcon={DocumentPdf}
          onClick={handleExport}
          disabled={loading}
        >
          <FormattedMessage
            id="biorepository.retrieval.print.download"
            defaultMessage="Download Retrieval Transactions PDF"
          />
        </Button>
      )}

      <div style={{ marginTop: "2rem" }}>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Download}
          onClick={handleExport}
          disabled={loading}
        >
          <FormattedMessage
            id="biorepository.retrieval.print.exportAll"
            defaultMessage="Export all transactions (no date filter)"
          />
        </Button>
      </div>
    </div>
  );
}

RetrievalPrintTab.propTypes = {
  refreshToken: PropTypes.number,
};

export default RetrievalPrintTab;
