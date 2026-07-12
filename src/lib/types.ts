export type Guest = {
	id: string;
	name: string;
	is_plus_one: boolean;
	attending: boolean | null;
	meal: string;
	dietary: string;
	sort_order: number;
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
