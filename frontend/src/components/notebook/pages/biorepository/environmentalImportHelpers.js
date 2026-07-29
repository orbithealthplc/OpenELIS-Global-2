/**
 * CSV parse/validate helpers for biorepository environmental monitoring import.
 */

import { normalizeDateValue } from "./manifestImportHelpers";

export const DEVICE_IMPORT_FIELDS = [
  "device_code",
  "checked_date_time",
  "temperature_value",
  "temperature_unit",
  "check_time",
  "checked_by",
  "notes",
];

export const ROOM_IMPORT_FIELDS = [
  "zone_code",
  "checked_date_time",
  "oxygen_level",
  "humidity",
  "checked_by",
  "notes",
];

const DEVICE_HEADER_ALIASES = {
  devicecode: "device_code",
  freezerid: "device_code",
  freezer: "device_code",
  checkeddatetime: "checked_date_time",
  datetime: "checked_date_time",
  timestamp: "checked_date_time",
  temperaturevalue: "temperature_value",
  temperature: "temperature_value",
  temp: "temperature_value",
  temperatureunit: "temperature_unit",
  unit: "temperature_unit",
  checktime: "check_time",
  checkedby: "checked_by",
  staff: "checked_by",
};

const ROOM_HEADER_ALIASES = {
  roomcode: "room_code",
  roomid: "room_code",
  room: "room_code",
  zonecode: "room_code",
  zoneid: "room_code",
  zone: "room_code",
  zone_code: "room_code",
  checkeddatetime: "checked_date_time",
  datetime: "checked_date_time",
  timestamp: "checked_date_time",
  oxygenlevel: "oxygen_level",
  o2: "oxygen_level",
  oxygen: "oxygen_level",
  humidity: "humidity",
  rh: "humidity",
  checkedby: "checked_by",
  staff: "checked_by",
};

export const normalizeHeaderToken = (header) =>
  String(header || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
};

export const parseCsvText = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
};

const mapHeaders = (headers, aliasMap) => {
  const mapped = [];
  headers.forEach((header) => {
    const token = normalizeHeaderToken(header);
    mapped.push(aliasMap[token] || token);
  });
  return mapped;
};

const rowToObject = (headers, values) => {
  const row = {};
  headers.forEach((header, index) => {
    if (!header) {
      return;
    }
    row[header] = values[index] != null ? String(values[index]).trim() : "";
  });
  return row;
};

const resolveDeviceCode = (device) =>
  device?.name || device?.code || device?.label || "";

const resolveRoomCode = (room) =>
  room?.code || room?.name || String(room?.id || "");

const deviceCodes = (devices) =>
  new Set(
    (devices || [])
      .map((device) => resolveDeviceCode(device))
      .filter(Boolean)
      .map((code) => code.toLowerCase()),
  );

const roomCodes = (rooms) =>
  new Set(
    (rooms || [])
      .map((room) => resolveRoomCode(room))
      .filter(Boolean)
      .map((code) => code.toLowerCase()),
  );

const findDeviceByCode = (devices, code) =>
  (devices || []).find(
    (device) => resolveDeviceCode(device).toLowerCase() === code.toLowerCase(),
  );

const findRoomByCode = (rooms, code) =>
  (rooms || []).find(
    (room) => resolveRoomCode(room).toLowerCase() === code.toLowerCase(),
  );

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateTimeForApi = (value) => {
  const normalized = normalizeDateValue(value, true);
  if (!normalized) {
    return null;
  }
  if (normalized.length === 10) {
    return `${normalized}T00:00`;
  }
  return normalized.replace(" ", "T").slice(0, 16);
};

export const buildDeviceTemplateCsv = () => {
  const headers = DEVICE_IMPORT_FIELDS.join(",");
  const example = "FREEZER-01,2026-06-11T08:00,-80,C,AM,AB,Auto logger export";
  return `${headers}\n${example}`;
};

export const buildRoomTemplateCsv = () => {
  const headers = ROOM_IMPORT_FIELDS.join(",");
  const example = "BR-ZONE-A,2026-06-11T08:00,20.5,45,AB,Auto logger export";
  return `${headers}\n${example}`;
};

export const downloadCsvTemplate = (filename, content) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseDeviceImportCsv = (
  text,
  devices = [],
  scopeDevice = null,
) => {
  const { headers, rows } = parseCsvText(text);
  if (headers.length === 0) {
    return {
      validRows: [],
      previewRows: [],
      errors: [{ row: 0, message: "CSV is empty" }],
    };
  }

  const mappedHeaders = mapHeaders(headers, DEVICE_HEADER_ALIASES);
  const knownCodes = deviceCodes(devices);
  const validRows = [];
  const previewRows = [];
  const errors = [];

  rows.forEach((values, index) => {
    const rowNumber = index + 2;
    const raw = rowToObject(mappedHeaders, values);
    const deviceCode =
      scopeDevice != null
        ? resolveDeviceCode(scopeDevice)
        : raw.device_code || "";
    const temperatureValue = parseNumber(raw.temperature_value);
    const checkedDateTime = normalizeDateTimeForApi(raw.checked_date_time);

    const rowErrors = [];
    if (!deviceCode) {
      rowErrors.push("device_code is required");
    } else if (
      knownCodes.size > 0 &&
      !knownCodes.has(deviceCode.toLowerCase())
    ) {
      rowErrors.push(`Unknown device_code: ${deviceCode}`);
    }
    if (temperatureValue == null) {
      rowErrors.push("temperature_value is required");
    }
    if (!checkedDateTime) {
      rowErrors.push("checked_date_time is required or invalid");
    }

    const preview = {
      rowNumber,
      device_code: deviceCode,
      checked_date_time: raw.checked_date_time,
      temperature_value: raw.temperature_value,
      temperature_unit: raw.temperature_unit || "C",
      check_time: raw.check_time,
      checked_by: raw.checked_by,
      notes: raw.notes,
      status: rowErrors.length === 0 ? "valid" : "error",
      errors: rowErrors,
    };
    previewRows.push(preview);

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, message: rowErrors.join("; ") });
      return;
    }

    validRows.push({
      deviceCode,
      device_code: deviceCode,
      checkedDateTime,
      checked_date_time: checkedDateTime,
      temperatureValue,
      temperature_value: temperatureValue,
      temperatureUnit: (raw.temperature_unit || "C").toUpperCase(),
      temperature_unit: (raw.temperature_unit || "C").toUpperCase(),
      checkTime: raw.check_time || "",
      check_time: raw.check_time || "",
      checkedBy: raw.checked_by || "",
      checked_by: raw.checked_by || "",
      notes: raw.notes || "",
      deviceType: findDeviceByCode(devices, deviceCode)?.deviceType || "",
    });
  });

  return { validRows, previewRows, errors };
};

export const parseRoomImportCsv = (text, rooms = [], scopeRoom = null) => {
  const { headers, rows } = parseCsvText(text);
  if (headers.length === 0) {
    return {
      validRows: [],
      previewRows: [],
      errors: [{ row: 0, message: "CSV is empty" }],
    };
  }

  const mappedHeaders = mapHeaders(headers, ROOM_HEADER_ALIASES);
  const knownCodes = roomCodes(rooms);
  const validRows = [];
  const previewRows = [];
  const errors = [];

  rows.forEach((values, index) => {
    const rowNumber = index + 2;
    const raw = rowToObject(mappedHeaders, values);
    const roomCode =
      scopeRoom != null ? resolveRoomCode(scopeRoom) : raw.room_code || "";
    const oxygenLevel = parseNumber(raw.oxygen_level);
    const humidity = parseNumber(raw.humidity);
    const checkedDateTime = normalizeDateTimeForApi(raw.checked_date_time);

    const rowErrors = [];
    if (!roomCode) {
      rowErrors.push("zone_code is required");
    } else if (knownCodes.size > 0 && !knownCodes.has(roomCode.toLowerCase())) {
      rowErrors.push(`Unknown zone_code: ${roomCode}`);
    }
    if (oxygenLevel == null && humidity == null) {
      rowErrors.push("At least one of oxygen_level or humidity is required");
    }
    if (!checkedDateTime) {
      rowErrors.push("checked_date_time is required or invalid");
    }

    const matchedRoom = findRoomByCode(rooms, roomCode);
    const preview = {
      rowNumber,
      room_code: roomCode,
      checked_date_time: raw.checked_date_time,
      oxygen_level: raw.oxygen_level,
      humidity: raw.humidity,
      checked_by: raw.checked_by,
      notes: raw.notes,
      status: rowErrors.length === 0 ? "valid" : "error",
      errors: rowErrors,
    };
    previewRows.push(preview);

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, message: rowErrors.join("; ") });
      return;
    }

    validRows.push({
      roomCode,
      room_code: roomCode,
      roomId: String(matchedRoom?.id || roomCode),
      roomName: matchedRoom?.name || roomCode,
      room_name: matchedRoom?.name || roomCode,
      checkedDateTime,
      checked_date_time: checkedDateTime,
      oxygenLevel,
      oxygen_level: oxygenLevel,
      humidity,
      checkedBy: raw.checked_by || "",
      checked_by: raw.checked_by || "",
      notes: raw.notes || "",
    });
  });

  return { validRows, previewRows, errors };
};
