export interface PhoneInputConfig {
  inputMode: "tel" | "numeric" | "text";
  maxLength: number;
  allowsNonNumeric: boolean;
}

export interface PincodeInputConfig {
  label: string;
  inputMode: "text" | "numeric";
  pattern: string;
  maxLength: number;
  required: boolean;
  allowsLetters: boolean;
}

const ALPHANUMERIC_POSTAL_CODES: string[] = [
  "GB",
  "CA",
  "NL",
  "IE",
];

const NO_POSTAL_CODES: string[] = [
  "AE",
  "AG",
  "AW",
  "BS",
  "BQ",
  "CV",
  "CI",
  "CK",
  "CM",
  "CU",
  "DJ",
  "DM",
  "ER",
  "FJ",
  "GA",
  "GD",
  "GY",
  "HK",
  "KI",
  "KM",
  "KN",
  "KP",
  "KW",
  "LY",
  "MH",
  "MO",
  "MR",
  "MU",
  "NA",
  "OM",
  "PA",
  "QA",
  "RW",
  "SB",
  "SC",
  "ST",
  "SY",
  "TC",
  "TO",
  "TT",
  "TV",
  "VC",
  "VG",
  "WS",
  "YE",
];

export function getCountryPhoneConfig(_countryCode: string): PhoneInputConfig {
  return {
    inputMode: "tel",
    maxLength: 15,
    allowsNonNumeric: false,
  };
}

export function getCountryPincodeConfig(countryCode: string): PincodeInputConfig {
  const normalizedCode = countryCode.toUpperCase();
  const hasAlphanumericPincode = ALPHANUMERIC_POSTAL_CODES.includes(normalizedCode);
  const hasNoPincode = NO_POSTAL_CODES.includes(normalizedCode);

  if (normalizedCode === "GB") {
    return {
      label: "Postcode",
      inputMode: "text",
      pattern: "[A-Z0-9 ]*",
      maxLength: 8,
      required: true,
      allowsLetters: true,
    };
  }

  if (normalizedCode === "CA") {
    return {
      label: "Postal Code",
      inputMode: "text",
      pattern: "[A-Z0-9 ]*",
      maxLength: 7,
      required: true,
      allowsLetters: true,
    };
  }

  if (normalizedCode === "NL") {
    return {
      label: "Postal Code",
      inputMode: "text",
      pattern: "[A-Z0-9 ]*",
      maxLength: 7,
      required: true,
      allowsLetters: true,
    };
  }

  if (normalizedCode === "IE") {
    return {
      label: "Eircode",
      inputMode: "text",
      pattern: "[A-Z0-9 ]*",
      maxLength: 8,
      required: true,
      allowsLetters: true,
    };
  }

  if (hasNoPincode) {
    return {
      label: "Postal Code (optional)",
      inputMode: "text",
      pattern: "[A-Z0-9 ]*",
      maxLength: 10,
      required: false,
      allowsLetters: false,
    };
  }

  if (normalizedCode === "US") {
    return {
      label: "ZIP Code",
      inputMode: "numeric",
      pattern: "[0-9]*",
      maxLength: 10,
      required: true,
      allowsLetters: false,
    };
  }

  if (hasAlphanumericPincode) {
    return {
      label: "Postal Code",
      inputMode: "text",
      pattern: "[A-Z0-9 ]*",
      maxLength: 10,
      required: true,
      allowsLetters: true,
    };
  }

  return {
    label: "Pincode",
    inputMode: "numeric",
    pattern: "[0-9]*",
    maxLength: 10,
    required: true,
    allowsLetters: false,
  };
}
