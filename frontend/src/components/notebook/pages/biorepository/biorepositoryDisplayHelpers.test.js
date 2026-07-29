import {
  filterZonesForPhysicalRoom,
  formatBiorepositoryLocationLevel,
  formatBiorepositoryPageInstructions,
  formatBiorepositoryUserText,
  getStorageManagementLabels,
  normalizeBiorepositoryHierarchyPath,
  resolveBiorepositoryPhysicalRoomByZoneCode,
  resolveBiorepositoryPhysicalRoomName,
} from "./biorepositoryDisplayHelpers";

describe("biorepositoryDisplayHelpers", () => {
  test("normalizeBiorepositoryHierarchyPath rewrites legacy Room segment only", () => {
    expect(normalizeBiorepositoryHierarchyPath("Room > Freezer-1")).toBe(
      "Zone > Freezer-1",
    );
    expect(normalizeBiorepositoryHierarchyPath("Room-A > Freezer-1")).toBe(
      "Room-A > Freezer-1",
    );
  });

  test("formatBiorepositoryLocationLevel maps room to zone", () => {
    expect(formatBiorepositoryLocationLevel("room")).toBe("zone");
    expect(formatBiorepositoryLocationLevel("device")).toBe("device");
  });

  test("formatBiorepositoryPageInstructions rewrites storage instructions", () => {
    expect(
      formatBiorepositoryPageInstructions(
        "Select storage hierarchy: Room > Device",
        "storage_assign",
      ),
    ).toBe("Select storage hierarchy: Zone > Device");
  });

  test("formatBiorepositoryUserText rewrites common room phrases", () => {
    expect(
      formatBiorepositoryUserText("Biorepository room-level storage"),
    ).toBe("Biorepository zone-level storage");
    expect(formatBiorepositoryUserText("Room Temperature (15-25°C)")).toBe(
      "Ambient Temperature (15-25°C)",
    );
  });

  test("resolveBiorepositoryPhysicalRoomName prefers login lab unit", () => {
    expect(
      resolveBiorepositoryPhysicalRoomName("Biorepository Laboratory"),
    ).toBe("Biorepository Laboratory");
    expect(resolveBiorepositoryPhysicalRoomName(null)).toBe(
      "Biorepository Laboratory",
    );
    expect(resolveBiorepositoryPhysicalRoomName(null, "Custom Facility")).toBe(
      "Custom Facility",
    );
  });

  test("physical rooms map seeded zone codes", () => {
    expect(resolveBiorepositoryPhysicalRoomByZoneCode("BIO-M20")?.id).toBe(
      "minus20",
    );
    expect(resolveBiorepositoryPhysicalRoomByZoneCode("BIO-ZN3")?.id).toBe(
      "ultralow",
    );
    expect(
      filterZonesForPhysicalRoom(
        [
          { id: "1", code: "BIO-M20", label: "Main Storage" },
          { id: "2", code: "BIO-ZN1", label: "Zone 1" },
          { id: "3", code: "BIO-REC", label: "Reception" },
        ],
        "ultralow",
      ).map((z) => z.code),
    ).toEqual(["BIO-ZN1", "BIO-REC"]);
  });

  test("getStorageManagementLabels returns zone labels for biorepository users", () => {
    const intl = {
      formatMessage: ({ id, defaultMessage }) => defaultMessage || id,
    };
    const biorepoLabels = getStorageManagementLabels(intl, true);
    expect(biorepoLabels.roomsTab).toBe("Zones");
    expect(biorepoLabels.addRoom).toBe("Add Zone");
    expect(biorepoLabels.roomColumn).toBe("Zone");
    expect(biorepoLabels.createZoneHelper).toContain("2 physical rooms");

    const defaultLabels = getStorageManagementLabels(intl, false);
    expect(defaultLabels.roomsTab).toBe("storage.tab.rooms");
  });
});
