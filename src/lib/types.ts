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

export type PublicParty = {
	id: string;
	display_name: string;
	responded_at: string | null;
	guests: Guest[];
};

export type GuestbookEntry = {
	id: string;
	name: string;
	message: string;
	created_at: string;
};
