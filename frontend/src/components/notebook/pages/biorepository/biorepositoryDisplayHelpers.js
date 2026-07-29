/**
 * User-facing text helpers for Biorepository workflow.
 * Rewrites legacy "Room" hierarchy labels to "Zone" without changing backend fields.
 */

const LEGACY_ROOM_SEGMENT = /^room$/i;

export function normalizeBiorepositoryHierarchyPath(path) {
  if (!path) {
    return path;
  }

  return String(path)
    .split(/\s*>\s*/)
    .map((segment) =>
      LEGACY_ROOM_SEGMENT.test(segment.trim()) ? "Zone" : segment,
    )
    .join(" > ");
}

export function formatBiorepositoryLocationLevel(locationType) {
  if (!locationType) {
    return locationType;
  }
  return String(locationType).toLowerCase() === "room" ? "zone" : locationType;
}

export function formatBiorepositoryUserText(text) {
  if (!text) {
    return text;
  }

  return String(text)
    .replace(/Room > Device/g, "Zone > Device")
    .replace(/Room > Freezer/g, "Zone > Device")
    .replace(/storage hierarchy: Room/gi, "storage hierarchy: Zone")
    .replace(/Storage Room/g, "Storage Zone")
    .replace(/\broom-level\b/gi, "zone-level")
    .replace(/\broom environment\b/gi, "zone environment")
    .replace(/\bthe selected room\b/gi, "the selected zone")
    .replace(/\bstorage room\b/gi, "storage zone")
    .replace(/\bstorage rooms\b/gi, "storage zones")
    .replace(/\bRoom Temperature\b/g, "Ambient Temperature");
}

export function formatBiorepositoryPageInstructions(instructions, pageKey) {
  if (!instructions) {
    return instructions;
  }
  if (pageKey !== "storage_assign" && pageKey !== "monitoring") {
    return instructions;
  }
  return formatBiorepositoryUserText(instructions);
}

export function formatBiorepositoryStorageDisplay(sampleOrPath) {
  if (sampleOrPath == null) {
    return null;
  }
  if (typeof sampleOrPath === "string") {
    return formatBiorepositoryUserText(
      normalizeBiorepositoryHierarchyPath(sampleOrPath),
    );
  }
  return null;
}

/**
 * AHRI Biorepository has 2 physical rooms:
 * 1) Minus 20 Freezer Room (dedicated -20°C freezers)
 * 2) Ultra Low Freezer Room (Reception + Zone 1–6)
 *
 * In DB, zones are still `storage_room` rows (UI label = Zone).
 * Physical rooms are a UI grouping layer above zones.
 */
export const BIOREPOSITORY_PHYSICAL_ROOMS = [
  {
    id: "minus20",
    label: "Minus 20 Freezer Room",
    zoneCodes: ["BIO-M20"],
  },
  {
    id: "ultralow",
    label: "Ultra Low Freezer Room",
    zoneCodes: [
      "BIO-REC",
      "BIO-ZN1",
      "BIO-ZN2",
      "BIO-ZN3",
      "BIO-ZN4",
      "BIO-ZN5",
      "BIO-ZN6",
    ],
  },
];

export function resolveBiorepositoryPhysicalRoomByZoneCode(zoneCode) {
  const code = String(zoneCode || "")
    .trim()
    .toUpperCase();
  if (!code) {
    return null;
  }
  return (
    BIOREPOSITORY_PHYSICAL_ROOMS.find((room) =>
      room.zoneCodes.some((zc) => zc.toUpperCase() === code),
    ) || null
  );
}

export function filterZonesForPhysicalRoom(zones = [], physicalRoomId) {
  if (!physicalRoomId) {
    return [];
  }
  const physicalRoom = BIOREPOSITORY_PHYSICAL_ROOMS.find(
    (room) => room.id === physicalRoomId,
  );
  if (!physicalRoom) {
    return zones;
  }
  const allowed = new Set(physicalRoom.zoneCodes.map((c) => c.toUpperCase()));
  const matched = zones.filter((zone) => {
    const code = String(zone?.code || "")
      .trim()
      .toUpperCase();
    return code && allowed.has(code);
  });
  // If seeded BIO-* zones are not present yet, fall back to all zones
  // so legacy/manual setups still work.
  return matched.length > 0 ? matched : zones;
}

/** Legacy single-label helper (facility / lab unit name). */
export function resolveBiorepositoryPhysicalRoomName(
  loginLabUnit,
  overrideName,
) {
  const candidate = overrideName || loginLabUnit;
  if (candidate && String(candidate).trim()) {
    return String(candidate).trim();
  }
  return "Biorepository Laboratory";
}

/**
 * Storage Management labels for Biorepository lab users (Zone vs Room).
 * @param {import('react-intl').IntlShape} intl
 * @param {boolean} isBiorepo
 */
export function getStorageManagementLabels(intl, isBiorepo) {
  if (!isBiorepo) {
    return {
      roomsTab: intl.formatMessage({ id: "storage.tab.rooms" }),
      addRoom: intl.formatMessage({ id: "storage.add.room" }),
      editRoom: intl.formatMessage({
        id: "storage.edit.room",
        defaultMessage: "Edit Room",
      }),
      searchRoomsPlaceholder: intl.formatMessage({
        id: "storage.search.rooms.placeholder",
      }),
      roomColumn: intl.formatMessage({ id: "storage.device.room" }),
      filterRoom: intl.formatMessage({
        id: "storage.filter.room",
        defaultMessage: "Filter by Room",
      }),
      roomNameHeader: intl.formatMessage({ id: "storage.room.name" }),
      locationName: intl.formatMessage({
        id: "storage.location.name",
        defaultMessage: "Name",
      }),
      createZoneHelper: null,
    };
  }

  return {
    roomsTab: intl.formatMessage({
      id: "biorepository.storage.management.tab.zones",
      defaultMessage: "Zones",
    }),
    addRoom: intl.formatMessage({
      id: "biorepository.storage.management.addZone",
      defaultMessage: "Add Zone",
    }),
    editRoom: intl.formatMessage({
      id: "biorepository.storage.management.editZone",
      defaultMessage: "Edit Zone",
    }),
    searchRoomsPlaceholder: intl.formatMessage({
      id: "biorepository.storage.management.searchZones",
      defaultMessage: "Search by zone name...",
    }),
    roomColumn: intl.formatMessage({
      id: "biorepository.storage.zone",
      defaultMessage: "Zone",
    }),
    filterRoom: intl.formatMessage({
      id: "biorepository.storage.management.filterZone",
      defaultMessage: "Filter by Zone",
    }),
    roomNameHeader: intl.formatMessage({
      id: "biorepository.storage.management.zoneName",
      defaultMessage: "Zone name",
    }),
    locationName: intl.formatMessage({
      id: "biorepository.storage.management.zoneName",
      defaultMessage: "Zone name",
    }),
    createZoneHelper: intl.formatMessage({
      id: "biorepository.storage.management.createZoneHelper",
      defaultMessage:
        "Biorepository has 2 physical rooms. The Ultra Low room is divided into Reception + Zone 1–6. The Minus 20 room holds -20°C freezers only.",
    }),
  };
}
