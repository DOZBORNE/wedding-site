/**
 * Field validation shared by the admin editor and the guest-facing RSVP form.
 * Lives in $lib because both sides — and the submit endpoint — need the same
 * answer; phone validation is next door in $lib/phone.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True for something that could plausibly be delivered to. Empty is not an error. */
export const isEmail = (v: string) => EMAIL_RE.test(v.trim());

export const emailError = (v: string) =>
	v.trim() && !isEmail(v) ? 'This doesn’t look like an email address.' : '';
