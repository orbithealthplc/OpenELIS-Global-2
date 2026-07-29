import {
  getPatientId,
  normalizePatientForOrder,
  birthDateForDisplayFromAge,
  isRegistrationFormValid,
  buildPatientManagementPayload,
  REGISTER_MODE,
  formatPatientBirthDateDisplay,
  normalizeOrderableTestList,
  formatRegistrationError,
} from "./patientOrderHelpers";

describe("patientOrderHelpers", () => {
  it("getPatientId prefers patientID then id", () => {
    expect(getPatientId({ patientID: "10", id: "20" })).toBe("10");
    expect(getPatientId({ id: "20" })).toBe("20");
    expect(getPatientId(null)).toBeNull();
  });

  it("normalizePatientForOrder sets both id and patientID", () => {
    const normalized = normalizePatientForOrder({
      id: "42",
      firstName: "Jane",
      lastName: "Doe",
      birthDateForDisplay: "01/01/2000",
      gender: "F",
    });
    expect(normalized.patientID).toBe("42");
    expect(normalized.id).toBe("42");
    expect(normalized.firstName).toBe("Jane");
  });

  it("birthDateForDisplayFromAge uses Jan 1 of birth year", () => {
    expect(birthDateForDisplayFromAge(25, new Date(2026, 5, 4))).toBe(
      "01/01/2001",
    );
    expect(birthDateForDisplayFromAge("", new Date(2026, 5, 4))).toBe("");
    expect(birthDateForDisplayFromAge(0, new Date(2026, 5, 4))).toBe(
      "01/01/2026",
    );
  });

  it("isRegistrationFormValid allows optional last name for participant", () => {
    expect(
      isRegistrationFormValid(
        { firstName: "P1", lastName: "", gender: "M", dateOfBirth: "" },
        REGISTER_MODE.PARTICIPANT,
      ),
    ).toBe(true);
    expect(
      isRegistrationFormValid(
        { firstName: "P1", lastName: "", gender: "", dateOfBirth: "" },
        REGISTER_MODE.PATIENT,
      ),
    ).toBe(false);
  });

  it("buildPatientManagementPayload maps dateOfBirth and subjectNumber", () => {
    const { payload, birthDateForDisplay } = buildPatientManagementPayload(
      {
        firstName: "Test",
        lastName: "User",
        gender: "M",
        dateOfBirth: "01/15/1996",
        nationalId: "",
        fatherNameOrProtocolId: "PROT-001",
      },
      REGISTER_MODE.PATIENT,
    );
    expect(birthDateForDisplay).toBe("01/15/1996");
    expect(payload.birthDateForDisplay).toBe("01/15/1996");
    expect(payload.subjectNumber).toBe("PROT-001");
  });

  it("buildPatientManagementPayload uses participant id as subjectNumber", () => {
    const { payload } = buildPatientManagementPayload(
      {
        firstName: "P-056",
        lastName: "",
        gender: "M",
        dateOfBirth: "",
        nationalId: "",
        fatherNameOrProtocolId: "",
      },
      REGISTER_MODE.PARTICIPANT,
    );
    expect(payload.subjectNumber).toBe("P-056");
  });

  it("formatPatientBirthDateDisplay prefers birthDateForDisplay", () => {
    expect(
      formatPatientBirthDateDisplay({ birthDateForDisplay: "01/01/2000" }),
    ).toBe("01/01/2000");
    expect(formatPatientBirthDateDisplay({ age: "22" })).toBe("01/01/2004");
  });

  it("normalizeOrderableTestList maps id and value", () => {
    expect(
      normalizeOrderableTestList([
        { id: 5, value: "Albumin(Urines)" },
        { testId: "6", testName: "Amylase" },
      ]),
    ).toEqual([
      { id: "5", value: "Albumin(Urines)" },
      { id: "6", value: "Amylase" },
    ]);
  });

  it("formatRegistrationError surfaces backend error text", () => {
    expect(
      formatRegistrationError(
        { error: "Validation errors: birthdate" },
        "Error registering patient",
      ),
    ).toBe("Validation errors: birthdate");
    expect(
      formatRegistrationError({ statusCode: 400 }, "Error registering patient"),
    ).toBe("Error registering patient (HTTP 400)");
    expect(
      formatRegistrationError(
        { message: "Not Authorized", statusCode: 401 },
        "Error registering patient",
      ),
    ).toContain("Not Authorized");
  });
});
