import React, { useMemo, useState } from "react";
import { Checkbox, Search } from "@carbon/react";
import { useIntl } from "react-intl";
import { BACTERIOLOGY_ANTIBIOTIC_CATALOG } from "../../../../constants/bacteriologyAssayCatalog";

/**
 * Scrollable antibiotic picker for DST modals.
 * Uses checkboxes instead of dropdowns so the list is always visible inside Carbon modals.
 */
function BacteriologyAntibioticSelector({
  id = "bacteriology-antibiotic-selector",
  titleText,
  items = BACTERIOLOGY_ANTIBIOTIC_CATALOG,
  selectedIds = [],
  onSelectionChange,
}) {
  const intl = useIntl();
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((item) => {
      const text = (item.text || "").toLowerCase();
      const name = (item.name || "").toLowerCase();
      const abbreviation = (item.abbreviation || "").toLowerCase();
      return (
        text.includes(query) ||
        name.includes(query) ||
        abbreviation.includes(query)
      );
    });
  }, [items, search]);

  const selectedIdSet = useMemo(
    () => new Set(selectedIds.map((value) => String(value))),
    [selectedIds],
  );

  const handleToggle = (item, checked) => {
    const itemId = String(item.id);
    const nextIds = checked
      ? [...selectedIds.map(String), itemId]
      : selectedIds.map(String).filter((value) => value !== itemId);
    const uniqueIds = [...new Set(nextIds)];
    const selectedItems = items.filter((option) =>
      uniqueIds.includes(String(option.id)),
    );
    onSelectionChange(uniqueIds, selectedItems);
  };

  return (
    <div>
      {titleText && (
        <label className="cds--label" htmlFor={`${id}-search`}>
          {titleText}
        </label>
      )}
      <Search
        id={`${id}-search`}
        labelText={intl.formatMessage({
          id: "notebook.bacteriology.assay.searchAntibiotics",
          defaultMessage: "Search antibiotics",
        })}
        placeholder={intl.formatMessage({
          id: "notebook.bacteriology.assay.searchAntibiotics.placeholder",
          defaultMessage: "Type to filter...",
        })}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        size="sm"
      />
      <div
        style={{
          maxHeight: "220px",
          overflowY: "auto",
          border: "1px solid #e0e0e0",
          padding: "0.5rem",
          marginTop: "0.5rem",
          backgroundColor: "#fff",
        }}
      >
        {filteredItems.length === 0 && (
          <p style={{ color: "#6f6f6f", fontStyle: "italic", margin: 0 }}>
            {intl.formatMessage({
              id: "notebook.bacteriology.assay.noAntibioticsMatch",
              defaultMessage: "No antibiotics match your search.",
            })}
          </p>
        )}
        {filteredItems.map((item) => (
          <Checkbox
            key={item.id}
            id={`${id}-${item.id}`}
            labelText={item.text || item.name}
            checked={selectedIdSet.has(String(item.id))}
            onChange={(_, { checked }) => handleToggle(item, checked)}
          />
        ))}
      </div>
      <p className="cds--label-description" style={{ marginTop: "0.25rem" }}>
        {intl.formatMessage(
          {
            id: "notebook.bacteriology.assay.antibioticsSelectedCount",
            defaultMessage: "{count} antibiotic(s) selected",
          },
          { count: selectedIds.length },
        )}
      </p>
    </div>
  );
}

export default BacteriologyAntibioticSelector;
