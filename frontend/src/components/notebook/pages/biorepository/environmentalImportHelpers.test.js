import {
  buildDeviceTemplateCsv,
  buildRoomTemplateCsv,
  parseDeviceImportCsv,
  parseRoomImportCsv,
} from "./environmentalImportHelpers";

describe("environmentalImportHelpers", () => {
  const devices = [
    { id: 1, name: "FREEZER-01", code: "FREEZER-01", deviceType: "Freezer-80" },
  ];
  const rooms = [{ id: 10, name: "BR-ROOM-A", code: "BR-ROOM-A" }];

  test("buildDeviceTemplateCsv includes required headers", () => {
    const csv = buildDeviceTemplateCsv();
    expect(csv).toContain("device_code");
    expect(csv).toContain("temperature_value");
    expect(csv).toContain("checked_date_time");
  });

  test("buildRoomTemplateCsv includes required headers", () => {
    const csv = buildRoomTemplateCsv();
    expect(csv).toContain("zone_code");
    expect(csv).toContain("oxygen_level");
    expect(csv).toContain("humidity");
  });

  test("parseDeviceImportCsv validates scoped device import", () => {
    const csv = [
      "checked_date_time,temperature_value,temperature_unit,checked_by",
      "2026-06-11T08:00,-80,C,AB",
    ].join("\n");

    const result = parseDeviceImportCsv(csv, devices, devices[0]);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].deviceCode).toBe("FREEZER-01");
    expect(result.validRows[0].temperatureValue).toBe(-80);
  });

  test("parseRoomImportCsv validates scoped room import", () => {
    const csv = [
      "checked_date_time,oxygen_level,humidity,checked_by",
      "2026-06-11T08:00,20.5,45,AB",
    ].join("\n");

    const result = parseRoomImportCsv(csv, rooms, rooms[0]);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].roomCode).toBe("BR-ROOM-A");
    expect(result.validRows[0].oxygenLevel).toBe(20.5);
  });

  test("parseRoomImportCsv accepts zone_code header alias", () => {
    const csv = [
      "zone_code,checked_date_time,oxygen_level,humidity,checked_by",
      "BR-ROOM-A,2026-06-11T08:00,20.5,45,AB",
    ].join("\n");

    const result = parseRoomImportCsv(csv, rooms, null);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].roomCode).toBe("BR-ROOM-A");
  });

  test("parseDeviceImportCsv flags unknown device codes in bulk import", () => {
    const csv = [
      "device_code,checked_date_time,temperature_value",
      "UNKNOWN-01,2026-06-11T08:00,-80",
    ].join("\n");

    const result = parseDeviceImportCsv(csv, devices, null);
    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0].message).toContain("Unknown device_code");
  });
});
