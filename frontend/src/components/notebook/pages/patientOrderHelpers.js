/**
 * Helpers for MedLab Page 1 patient registration and lab orders.
 */

export const REGISTER_MODE = {
  PATIENT: "patient",
  PARTICIPANT: "participant",
};

/**
 * Derive backend birthDateForDisplay (MM/dd/yyyy) from age in years.
 * Uses Jan 1 of the estimated birth year.
 */
export function birthDateForDisplayFromAge(age, referenceDate = new Date()) {
  const years = parseInt(String(age).trim(), 10);
  if (Number.isNaN(years) || years < 0) {
    return "";
  }
  const year = referenceDate.getFullYear() - years;
  return `01/01/${year}`;
}

export function getPatientId(patient) {
  if (!patient) {
    return null;
  }
  return patient.patientID ?? patient.id ?? null;
}

export function normalizePatientForOrder(patient) {
  if (!patient) {
    return null;
  }
  const patientId = getPatientId(patient);
  return {
    ...patient,
    id: patientId,
    patientID: patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    birthDateForDisplay: patient.birthDateForDisplay,
    age: patient.age,
    gender: patient.gender,
    nationalId: patient.nationalId,
    subjectNumber: patient.subjectNumber,
  };
}

export function isRegistrationFormValid(form, mode = REGISTER_MODE.PATIENT) {
  const firstOk = (form.firstName || "").trim() !== "";
  const lastOk =
    mode === REGISTER_MODE.PARTICIPANT || (form.lastName || "").trim() !== "";
  const genderOk = (form.gender || "").trim() !== "";
  return firstOk && lastOk && genderOk;
}

export function buildPatientManagementPayload(
  form,
  mode = REGISTER_MODE.PATIENT,
) {
  const birthDateForDisplay = (form.dateOfBirth ?? "").toString().trim();

  const lastName =
    mode === REGISTER_MODE.PARTICIPANT && (form.lastName || "").trim() === ""
      ? "-"
      : form.lastName;

  const payload = {
    firstName: form.firstName,
    lastName,
    birthDateForDisplay,
    gender: form.gender,
    nationalId: form.nationalId || "",
    patientUpdateStatus: "ADD",
  };

  const participantOrPatientId = (form.firstName || "").trim();
  const protocolId = (form.fatherNameOrProtocolId || "").trim();
  if (protocolId) {
    payload.subjectNumber = protocolId;
  } else if (mode === REGISTER_MODE.PARTICIPANT && participantOrPatientId) {
    payload.subjectNumber = participantOrPatientId;
  }

  return { payload, birthDateForDisplay };
}

export function buildRegisteredPatientSnapshot(
  patientPk,
  form,
  birthDateForDisplay,
  mode = REGISTER_MODE.PATIENT,
) {
  const lastName =
    (form.lastName || "").trim() !== ""
      ? form.lastName
      : mode === REGISTER_MODE.PARTICIPANT
        ? "-"
        : form.lastName;
  const snapshot = {
    id: patientPk,
    firstName: form.firstName,
    lastName,
    birthDateForDisplay: birthDateForDisplay || "",
    gender: form.gender,
    nationalId: form.nationalId || "",
  };
  const protocolId = (form.fatherNameOrProtocolId || "").trim();
  if (protocolId) {
    snapshot.subjectNumber = protocolId;
  }
  return snapshot;
}

export function formatPatientBirthDateDisplay(patient) {
  if (patient?.birthDateForDisplay) {
    return patient.birthDateForDisplay;
  }
  if (patient?.age != null && String(patient.age).trim() !== "") {
    return birthDateForDisplayFromAge(patient.age);
  }
  return "-";
}

/** @deprecated Use formatPatientBirthDateDisplay */
export const formatPatientAgeDisplay = formatPatientBirthDateDisplay;

export function normalizeOrderableTestList(response) {
  if (!Array.isArray(response)) {
    return [];
  }
  return response
    .map((test) => ({
      id: String(test.id ?? test.testId ?? ""),
      value:
        test.value ||
        test.localizedTestName ||
        test.testName ||
        test.name ||
        "",
    }))
    .filter((test) => test.id);
}

export function formatRegistrationError(response, fallbackMessage) {
  if (!response) {
    return fallbackMessage;
  }
  if (response.error) {
    return String(response.error);
  }
  if (response.message && response.message !== "No action required") {
    const message = String(response.message);
    if (
      message === "Not Authorized" ||
      response.statusCode === 401 ||
      response.status === 401
    ) {
      return `${message}. Your role may be missing patient registration access — ask an admin to assign Sample Collector or Laboratory Technician on CTD, then log out and back in.`;
    }
    return message;
  }
  if (typeof response.statusCode === "number") {
    if (response.statusCode === 401) {
      return `${fallbackMessage}: Not Authorized. Log out and back in after your admin updates your CTD lab-unit roles.`;
    }
    return `${fallbackMessage} (HTTP ${response.statusCode})`;
  }
  if (response.success && !response.patientPK) {
    return `${fallbackMessage}: patient ID was not returned by the server`;
  }
  return fallbackMessage;
}
