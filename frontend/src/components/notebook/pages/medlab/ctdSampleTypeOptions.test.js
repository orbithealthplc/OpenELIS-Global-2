/* eslint-env jest */
import {
  filterCtdSampleTypes,
  getSampleTypeId,
  getSampleTypeLabel,
} from "./ctdSampleTypeOptions";

describe("CTD sample type options", () => {
  it("keeps only the CTD collection specimen types", () => {
    const options = [
      { id: "1", value: "Whole Blood" },
      { id: "2", value: "Urines" },
      { id: "3", value: "Stool" },
      { id: "4", value: "CSF (Cerebrospinal Fluid)" },
      { id: "5", value: "Other Body Fluid" },
      { id: "6", value: "Synovial Fluid" },
      { id: "7", value: "Peritoneal Fluid" },
      { id: "8", value: "Amniotic Fluid" },
      { id: "9", value: "Skin scrapings" },
      { id: "10", value: "Immunohistochemistry specimen" },
      { id: "11", value: "Serum" },
    ];

    expect(filterCtdSampleTypes(options).map(getSampleTypeId)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
    expect(filterCtdSampleTypes(options).map(getSampleTypeLabel)).not.toContain(
      "Immunohistochemistry specimen",
    );
  });
});
