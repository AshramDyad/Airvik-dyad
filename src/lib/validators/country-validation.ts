// Countries without postal codes
const NO_POSTAL_CODES: string[] = [
  'AE', 'AG', 'AW', 'BS', 'BQ', 'CV', 'CI', 'CK', 'CM', 'CU', 'DJ', 'DM', 'ER',
  'FJ', 'GA', 'GD', 'GY', 'HK', 'KI', 'KM', 'KN', 'KP', 'KW', 'LY', 'MH',
  'MO', 'MR', 'MU', 'NA', 'OM', 'PA', 'QA', 'RW', 'SB', 'SC', 'ST', 'SY',
  'TC', 'TO', 'TT', 'TV', 'VC', 'VG', 'WS', 'YE',
];

export function validatePhoneByCountry(phone: string, countryCode: string): boolean {
  const digitsOnly = phone.replace(/\D/g, '');

  if (!digitsOnly) {
    return false;
  }

  const length = digitsOnly.length;

  switch (countryCode) {
    case 'IN':
      return length === 10;
    case 'US':
      return length === 10;
    case 'GB':
      return length >= 10 && length <= 11;
    case 'CA':
      return length === 10;
    case 'AU':
      return length === 10;
    case 'DE':
      return length >= 10 && length <= 11;
    case 'FR':
      return length === 9;
    case 'JP':
      return length >= 10 && length <= 11;
    case 'CN':
      return length === 11;
    case 'BR':
      return length >= 10 && length <= 11;
    case 'MX':
      return length === 10;
    case 'RU':
      return length === 10;
    default:
      return length >= 6 && length <= 15;
  }
}

export function validatePincodeByCountry(pincode: string, countryCode: string): boolean {
  const normalizedCode = countryCode.toUpperCase();

  // Countries without postal codes - allow empty or alphanumeric
  if (NO_POSTAL_CODES.includes(normalizedCode)) {
    if (!pincode || pincode.trim().length === 0) {
      return true;
    }
    // For countries without postal codes, allow any 3-10 character alphanumeric string
    const cleanPincode = pincode.trim();
    return /^[A-Z0-9]{3,10}$/i.test(cleanPincode);
  }

  if (!pincode || pincode.trim().length === 0) {
    return false;
  }

  const cleanPincode = pincode.trim();

  switch (normalizedCode) {
    case 'IN':
      return /^\d{6}$/.test(cleanPincode);
    case 'US':
      return /^\d{5}(-\d{4})?$/.test(cleanPincode);
    case 'GB':
      // UK Postcode format: A9 9AA or AA9 9AA or A9A 9AA or AA9A 9AA
      return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(cleanPincode);
    case 'CA':
      // Canada Postal Code format: A1A 1A1
      return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(cleanPincode);
    case 'NL':
      // Netherlands Postal Code format: 1234 AB
      return /^\d{4}\s?[A-Z]{2}$/i.test(cleanPincode);
    case 'IE':
      // Ireland Eircode format: A65 F4E2
      return /^[A-Z]\d{2}\s?[A-Z]\d{2}$/i.test(cleanPincode);
    case 'AU':
      return /^\d{4}$/.test(cleanPincode);
    case 'DE':
      return /^\d{5}$/.test(cleanPincode);
    case 'FR':
      return /^\d{5}$/.test(cleanPincode);
    case 'JP':
      return /^\d{3}-\d{4}$/.test(cleanPincode);
    case 'CN':
      return /^\d{6}$/.test(cleanPincode);
    case 'BR':
      return /^\d{5}-\d{3}$/.test(cleanPincode);
    case 'MX':
      return /^\d{5}$/.test(cleanPincode);
    case 'RU':
      return /^\d{6}$/.test(cleanPincode);
    default:
      // Fallback for unknown countries: allow 3-10 alphanumeric characters
      return /^[A-Z0-9]{3,10}$/i.test(cleanPincode);
  }
}

export function validateCountryCode(countryCode: string): boolean {
  return /^[A-Z]{2}$/i.test(countryCode.trim());
}
