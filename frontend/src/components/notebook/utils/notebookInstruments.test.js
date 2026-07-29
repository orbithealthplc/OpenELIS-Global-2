import {
  mapNotebookInstrumentsToOptions,
  resolveNotebookInstruments,
} from "./notebookInstruments";

describe("notebookInstruments", () => {
  it("prefers linkedInstruments from parent form over notebook analyzers", () => {
    expect(
      resolveNotebookInstruments(
        [{ id: "1", value: "machine" }],
        [{ id: "2", value: "other" }],
      ),
    ).toEqual([{ id: "1", value: "machine" }]);
  });

  it("falls back to notebook analyzers when linkedInstruments is undefined", () => {
    expect(
      resolveNotebookInstruments(undefined, [{ id: "2", value: "Centrifuge" }]),
    ).toEqual([{ id: "2", value: "Centrifuge" }]);
  });

  it("uses empty linkedInstruments when user cleared selections", () => {
    expect(
      resolveNotebookInstruments([], [{ id: "2", value: "Centrifuge" }]),
    ).toEqual([]);
  });

  it("maps IdValuePair analyzers to dropdown options", () => {
    const options = mapNotebookInstrumentsToOptions([
      { id: 5, value: "machine", serialNumber: "SN-001" },
    ]);
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe("5");
    expect(options[0].text).toBe("machine");
    expect(options[0].physicalId).toBe("SN-001");
  });
});
