export type Guest = {
	id: string;
	name: string;
	is_plus_one: boolean;
	attending: boolean | null;
	meal: string;
	dietary: string;
	sort_order: number;
	// Optional per-person contact — only populated for admin/server reads, never sent to guest browsers.
	first_name?: string;
	last_name?: string;
	email?: string;
	phone?: string;
};

/** The party's mailing address — required on the RSVP form, editable in /admin. */
export type PartyAddress = {
	address_line1: string;
	address_line2: string;
	city: string;
	state_region: string;
	postal_code: string;
	country: string;
};

export const blankAddress = (): PartyAddress => ({
	address_line1: '',
	address_line2: '',
	city: '',
	state_region: '',
	postal_code: '',
	country: ''
});

/** Every part of the address a guest must fill in before they can seal a reply. */
export const REQUIRED_ADDRESS_FIELDS = [
	'address_line1',
	'city',
	'state_region',
	'postal_code'
] as const;

export const addressIsComplete = (a: PartyAddress) =>
	REQUIRED_ADDRESS_FIELDS.every((f) => a[f].trim().length > 0);

/**
 * A party as its own household sees it, once the invite code has unlocked it.
 * Everything here is safe to send to a browser that proved it holds the code —
 * including their previous answers, so re-opening an RSVP shows what they said
 * instead of silently blanking it on the next save.
 */
export type PublicParty = {
	id: string;
	display_name: string;
	responded_at: string | null;
	song_requests: string;
	message: string;
	contact_email: string;
	address: PartyAddress;
	guests: Guest[];
};

/**
 * A lookup hit, before any code has been entered. Deliberately thin: the family
 * name plus masked member names ("Devin O.") — enough to tell two households with
 * the same display name apart, never enough to read anyone's RSVP.
 */
export type PartyCandidate = {
	id: string;
	display_name: string;
	members: string[];
	plus_ones: number;
};

export type GuestbookEntry = {
	id: string;
	name: string;
	message: string;
	created_at: string;
};
