const CTD_SAMPLE_TYPE_MATCHERS = [
  /^(whole\s+blood|whole\s+bld)$/i,
  /^(urine|urines)$/i,
  /^(stool|stools|faeces|feces)$/i,
  /^(csf|cerebrospinal\s+fluid|csf\s*\(cerebrospinal\s+fluid\))$/i,
  /^(body\s+fluids?|other\s+body\s+fluid)$/i,
  /^(synovial|synovial\s+fluid|joint\s+fluid)$/i,
  /^(peritoneal|peritoneal\s+fluid|ascitic|ascitic\s+fluid)$/i,
  /^(amniotic|amniotic\s+fluid)$/i,
  /^(skin\s+scraping|skin\s+scrapings|skin\s+slit\s+smear)$/i,
];

export const getSampleTypeLabel = (sampleType) =>
  String(
    sampleType?.value || sampleType?.description || sampleType?.label || "",
  ).trim();

export const getSampleTypeId = (sampleType) =>
  String(sampleType?.id || sampleType?.valueId || "").trim();

export const filterCtdSampleTypes = (sampleTypes = []) =>
  sampleTypes
    .filter((sampleType) => {
      const label = getSampleTypeLabel(sampleType);
      return CTD_SAMPLE_TYPE_MATCHERS.some((matcher) => matcher.test(label));
    })
    .filter((sampleType) => getSampleTypeId(sampleType));
