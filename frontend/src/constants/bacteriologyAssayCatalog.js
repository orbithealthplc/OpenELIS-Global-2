/**
 * Standard bacteriology assay catalogs (antibiotics, enzymes).
 * Source: AHRI bacteriology workflow reference list.
 */

const toAntibiotic = (id, name, abbreviation) => ({
  id,
  name,
  abbreviation,
  text: abbreviation ? `${name} (${abbreviation})` : name,
});

/** @type {Array<{id: string, name: string, abbreviation?: string, text: string}>} */
export const BACTERIOLOGY_ANTIBIOTIC_CATALOG = [
  toAntibiotic("AMK", "Amikacin", "AMK"),
  toAntibiotic("AMX", "Amoxicillin", "AMX"),
  toAntibiotic("AMC", "Amoxicillin–Clavulanic Acid", "AMC"),
  toAntibiotic("AMP", "Ampicillin", "AMP"),
  toAntibiotic("SAM", "Ampicillin–Sulbactam", "SAM"),
  toAntibiotic("AZM", "Azithromycin", "AZM"),
  toAntibiotic("ATM", "Aztreonam", "ATM"),
  toAntibiotic("CFZ", "Cefazolin", "CFZ"),
  toAntibiotic("FEP", "Cefepime", "FEP"),
  toAntibiotic("CTX", "Cefotaxime", "CTX"),
  toAntibiotic("CPD", "Cefpodoxime", "CPD"),
  toAntibiotic("CRO", "Ceftriaxone", "CRO"),
  toAntibiotic("CXM", "Cefuroxime", "CXM"),
  toAntibiotic("FOX", "Cefoxitin", "FOX"),
  toAntibiotic("CAZ", "Ceftazidime", "CAZ"),
  toAntibiotic("CFP", "Cefoperazone", "CFP"),
  toAntibiotic("CHL", "Chloramphenicol", "CHL"),
  toAntibiotic("CIP", "Ciprofloxacin", "CIP"),
  toAntibiotic("CLI", "Clindamycin", "CLI"),
  toAntibiotic("CST", "Colistin (Polymyxin E)", "CST"),
  toAntibiotic("DAP", "Daptomycin", "DAP"),
  toAntibiotic("DOX", "Doxycycline", "DOX"),
  toAntibiotic("ERY", "Erythromycin", "ERY"),
  toAntibiotic("FOS", "Fosfomycin", "FOS"),
  toAntibiotic("GEN", "Gentamicin", "GEN"),
  toAntibiotic("IPM", "Imipenem", "IPM"),
  toAntibiotic("LEV", "Levofloxacin", "LEV"),
  toAntibiotic("LZD", "Linezolid", "LZD"),
  toAntibiotic("MEM", "Meropenem", "MEM"),
  toAntibiotic("MIN", "Minocycline", "MIN"),
  toAntibiotic("NAL", "Nalidixic Acid", "NAL"),
  toAntibiotic("NIT", "Nitrofurantoin", "NIT"),
  toAntibiotic("NOR", "Norfloxacin", "NOR"),
  toAntibiotic("OXA", "Oxacillin", "OXA"),
  toAntibiotic("PEN", "Penicillin G", "PEN"),
  toAntibiotic("TZP", "Piperacillin–Tazobactam", "TZP"),
  toAntibiotic("PB", "Polymyxin B", "PB"),
  toAntibiotic("RIF", "Rifampicin", "RIF"),
  toAntibiotic("STR", "Streptomycin", "STR"),
  toAntibiotic("SXT", "Sulphamethoxazole–Trimethoprim", "SXT"),
  toAntibiotic("TET", "Tetracycline", "TET"),
  toAntibiotic("TIM", "Ticarcillin–Clavulanic Acid", "TIM"),
  toAntibiotic("TGC", "Tigecycline", "TGC"),
  toAntibiotic("TOB", "Tobramycin", "TOB"),
  toAntibiotic("VAN", "Vancomycin", "VAN"),
  toAntibiotic("CAZ_CLA", "Ceftazidime + Clavulanic acid", "CAZ/CLA"),
  toAntibiotic("CTX_CLA", "Cefotaxime + Clavulanic acid", "CTX/CLA"),
  toAntibiotic("CPD_CLA", "Cefpodoxime + Clavulanic acid", "CPD/CLA"),
  toAntibiotic("CRO_CLA", "Ceftriaxone + Clavulanic acid", "CRO/CLA"),
  toAntibiotic(
    "AMC_CENTRAL",
    "Amoxicillin–Clavulanic Acid (central disk)",
    "AMC",
  ),
];

const toEnzyme = (id, name) => ({
  id,
  name,
  text: name,
});

/** @type {Array<{id: string, name: string, text: string}>} */
export const BACTERIOLOGY_ENZYME_CATALOG = [
  toEnzyme("TAG_DNA_POLYMERASE", "Tag DNA polymerase"),
  toEnzyme("PFU_POLYMERASE", "Pfu Polymerase"),
  toEnzyme("PHUSION_POLYMERASE", "Phusion Polymerase"),
  toEnzyme("Q5_POLYMERASE", "Q5 Polymerase"),
  toEnzyme("REVERSE_TRANSCRIPTASE", "Reverse transcriptase"),
  toEnzyme("PLATINUM_SUPERFI", "Platinum SuperFi"),
];

/**
 * Merge reference catalog with notebook inventory items (inventory supplements catalog).
 */
export function mergeAssayCatalogWithInventory(catalog, inventoryItems = []) {
  const merged = catalog.map((item) => ({ ...item }));

  (inventoryItems || []).forEach((item) => {
    const inventoryName = (item.name || item.text || "").toLowerCase();
    if (!inventoryName) {
      return;
    }

    const alreadyListed = merged.some(
      (catalogItem) =>
        (catalogItem.name || catalogItem.text || "").toLowerCase() ===
        inventoryName,
    );

    if (!alreadyListed) {
      merged.push({
        id: item.id,
        name: item.name,
        text: item.text || item.name,
        catalogNumber: item.catalogNumber,
        manufacturer: item.manufacturer,
        fromInventory: true,
        ...item,
      });
    }
  });

  return merged.sort((a, b) =>
    (a.text || a.name).localeCompare(b.text || a.name),
  );
}

/**
 * Resolve a saved antibiotic result row to a dropdown option.
 */
export function findAntibioticOption(options, result) {
  if (!result || !options?.length) {
    return null;
  }

  if (result.antibioticId) {
    const byId = options.find(
      (option) => String(option.id) === String(result.antibioticId),
    );
    if (byId) {
      return byId;
    }
  }

  const savedName = (result.antibiotic || "").toLowerCase();
  if (!savedName) {
    return null;
  }

  return (
    options.find((option) => {
      const optionName = (option.name || "").toLowerCase();
      const optionText = (option.text || "").toLowerCase();
      return (
        optionName === savedName ||
        optionText === savedName ||
        optionText.startsWith(`${savedName} (`)
      );
    }) || null
  );
}

/**
 * Ensure saved antibiotic rows include stable ids for dropdown reload.
 */
export function normalizeAntibioticResults(options, results) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((result) => {
    const match = findAntibioticOption(options, result);
    return {
      ...result,
      antibioticId: result.antibioticId || match?.id || "",
      antibiotic: result.antibiotic || match?.name || match?.text || "",
    };
  });
}

/**
 * Build result rows from a multi-select antibiotic picker, preserving zone/MIC.
 */
export function buildAntibioticResultsFromSelection(
  selectedItems,
  existingResults = [],
) {
  return (selectedItems || []).map((item) => {
    const existing = (existingResults || []).find(
      (result) => String(result.antibioticId) === String(item.id),
    );
    return (
      existing || {
        antibiotic: item.name,
        antibioticId: item.id,
        zoneDiameter: "",
        mic: "",
      }
    );
  });
}
