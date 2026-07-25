import {
	AsYouType,
	parsePhoneNumberFromString,
	type CountryCode,
	type PhoneNumber
} from 'libphonenumber-js';

/** Most of the guest list is American — anything else is typed with a leading +. */
export const DEFAULT_COUNTRY: CountryCode = 'US';

/** A number typed without a + is read as `country`; a leading + carries its own. */
function parse(raw: string, country: CountryCode = DEFAULT_COUNTRY): PhoneNumber | undefined {
	const v = raw.trim();
	if (!v) return undefined;
	return parsePhoneNumberFromString(v, v.startsWith('+') ? undefined : country);
}

/**
 * What the field shows while someone types — "(217) 779-1753" for a US number,
 * "+44 20 7123 4567" once a + names another country.
 */
export function formatAsTyped(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
	const v = raw.trimStart();
	if (!v) return '';
	return v.startsWith('+') ? new AsYouType().input(v) : new AsYouType(country).input(v);
}

/** Pretty form of a stored value — used to seed the field from the database. */
export function formatPhone(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
	const pn = parse(raw, country);
	if (!pn) return raw.trim();
	// Local numbers read better nationally; everything else keeps its country code.
	return pn.country === country ? pn.formatNational() : pn.formatInternational();
}

/** Canonical +E.164 for storage and for Twilio. '' when the input isn't usable. */
export function toE164(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
	const pn = parse(raw, country);
	return pn?.isValid() ? pn.number : '';
}

/** Empty is fine — a party can be email-only. Anything typed has to be dialable. */
export function phoneError(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
	const v = raw.trim();
	if (!v) return '';
	const pn = parse(v, country);
	if (!pn?.isValid()) {
		return v.startsWith('+')
			? 'This doesn’t look like a valid number for that country code.'
			: 'This doesn’t look like a phone number — add + and the country code if it isn’t US.';
	}
	return '';
}

/** The country a value resolves to, for the badge beside the field. */
export function phoneCountry(
	raw: string,
	country: CountryCode = DEFAULT_COUNTRY
): CountryCode | undefined {
	return parse(raw, country)?.country;
}
