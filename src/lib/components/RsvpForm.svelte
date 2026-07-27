<script lang="ts">
    import { REGISTRY_URL, WEDDING } from "$lib/config";
    import {
        addressIsComplete,
        blankAddress,
        type PartyAddress,
        type PartyCandidate,
        type PublicParty,
    } from "$lib/types";
    import Icon from "./Icon.svelte";
    import Seal from "./Seal.svelte";

    let { party = null }: { party?: PublicParty | null } = $props();

    type Row = {
        id: string;
        name: string;
        is_plus_one: boolean;
        attending: boolean;
        /* There's no menu yet, so nothing collects this — it's carried through
           untouched so a value already on the record survives a re-save. */
        meal: string;
        dietary: string;
        /** Plus-one seats stay folded away until someone actually asks for one. */
        revealed: boolean;
    };

    // deliberately seed from the prop's initial value — a deep-linked party
    // is server-rendered straight into the form stage
    // svelte-ignore state_referenced_locally
    const initialParty = party;
    let stage = $state<"lookup" | "code" | "form" | "done">(
        initialParty ? "form" : "lookup",
    );
    let query = $state("");
    let code = $state("");
    let searching = $state(false);
    let opening = $state(false);
    let submitting = $state(false);
    let errorMsg = $state("");
    let matches = $state<PartyCandidate[]>([]);
    let pending = $state<PartyCandidate | null>(null);
    let selected = $state<PublicParty | null>(initialParty);
    let rows = $state<Row[]>(initialParty ? toRows(initialParty) : []);
    let songRequests = $state(initialParty?.song_requests ?? "");
    let message = $state(initialParty?.message ?? "");
    let contactEmail = $state(initialParty?.contact_email ?? "");
    let address = $state<PartyAddress>(toAddress(initialParty));
    /** Address errors stay quiet until a field is left or the form is submitted. */
    let attempted = $state(false);
    let touched = $state<Record<string, boolean>>({});

    function toAddress(p: PublicParty | null): PartyAddress {
        const a = p ? { ...p.address } : blankAddress();
        if (!a.country.trim()) a.country = "United States";
        return a;
    }

    function toRows(p: PublicParty): Row[] {
        return p.guests.map((g) => ({
            id: g.id,
            name: g.name,
            is_plus_one: g.is_plus_one,
            // An unclaimed plus-one seat starts empty, not accepted on the party's behalf.
            attending: g.is_plus_one
                ? g.attending === true
                : (g.attending ?? true),
            meal: g.meal,
            dietary: g.dietary,
            revealed: !g.is_plus_one || !!g.name.trim() || g.attending === true,
        }));
    }

    function choose(p: PublicParty) {
        selected = p;
        rows = toRows(p);
        address = toAddress(p);
        songRequests = p.song_requests;
        message = p.message;
        contactEmail = p.contact_email;
        attempted = false;
        touched = {};
        stage = "form";
        errorMsg = "";
    }

    /** Step 1 — a chosen family now needs its invite code to open. */
    function pick(c: PartyCandidate) {
        pending = c;
        code = "";
        matches = [];
        errorMsg = "";
        stage = "code";
    }

    /** "Devin O. · Jessica R. · +1 guest" — how a household tells itself apart from a namesake. */
    function roster(c: PartyCandidate): string {
        const extra = c.plus_ones
            ? [`+${c.plus_ones} guest${c.plus_ones === 1 ? "" : "s"}`]
            : [];
        return [...c.members, ...extra].join(" · ");
    }

    async function lookup(e: SubmitEvent) {
        e.preventDefault();
        errorMsg = "";
        searching = true;
        matches = [];
        try {
            const res = await fetch("/api/rsvp/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (!res.ok) {
                errorMsg =
                    data.error ?? "Something went wrong — please try again.";
            } else if (!data.parties.length) {
                errorMsg =
                    "We couldn’t find that name. Try just your last name — or reach out to us directly.";
            } else if (data.parties.length === 1) {
                pick(data.parties[0]);
            } else {
                matches = data.parties;
            }
        } catch {
            errorMsg =
                "Something went wrong — please check your connection and try again.";
        } finally {
            searching = false;
        }
    }

    /** Step 2 — verify the code server-side; on success the full party comes back. */
    async function openParty(e: SubmitEvent) {
        e.preventDefault();
        if (!pending) return;
        errorMsg = "";
        opening = true;
        try {
            const res = await fetch("/api/rsvp/open", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ partyId: pending.id, code }),
            });
            const data = await res.json();
            if (!res.ok) {
                errorMsg =
                    data.error ?? "That code did not work — please try again.";
            } else {
                choose(data.party);
            }
        } catch {
            errorMsg =
                "Something went wrong — please check your connection and try again.";
        } finally {
            opening = false;
        }
    }

    // ── plus-one seats ────────────────────────────────────────────────────────
    const hiddenPlusOnes = $derived(
        rows.filter((r) => r.is_plus_one && !r.revealed).length,
    );

    function addPlusOne() {
        const i = rows.findIndex((r) => r.is_plus_one && !r.revealed);
        if (i < 0) return;
        rows[i].revealed = true;
        rows[i].attending = true;
    }
    function dropPlusOne(i: number) {
        rows[i].revealed = false;
        rows[i].attending = false;
        rows[i].name = "";
        rows[i].dietary = "";
    }

    // ── address ───────────────────────────────────────────────────────────────
    const addressErrors = $derived({
        address_line1: address.address_line1.trim()
            ? ""
            : "Please add your street address.",
        city: address.city.trim() ? "" : "Please add your city.",
        state_region: address.state_region.trim()
            ? ""
            : "Please add your state.",
        postal_code: address.postal_code.trim()
            ? ""
            : "Please add your ZIP or postal code.",
    });
    const addressOk = $derived(addressIsComplete(address));
    const showErr = (f: keyof typeof addressErrors) =>
        (attempted || touched[f]) && addressErrors[f] ? addressErrors[f] : "";
    const touch = (f: string) => (touched[f] = true);

    async function submit(e: SubmitEvent) {
        e.preventDefault();
        if (!selected) return;
        attempted = true;
        errorMsg = "";
        // An accepted seat with no name is a plate the caterer can't account for.
        if (
            rows.some(
                (r) =>
                    r.is_plus_one &&
                    r.revealed &&
                    r.attending &&
                    !r.name.trim(),
            )
        ) {
            errorMsg =
                "Please tell us your guest’s name — or remove the extra seat with the ×.";
            return;
        }
        if (!addressOk) {
            errorMsg = "We need your mailing address before you can seal this.";
            return;
        }
        submitting = true;
        try {
            const res = await fetch("/api/rsvp/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    partyId: selected.id,
                    guests: rows.map((r) => ({
                        id: r.id,
                        attending: r.attending,
                        meal: r.attending ? r.meal : "",
                        dietary: r.attending ? r.dietary : "",
                        ...(r.is_plus_one
                            ? { name: r.revealed ? r.name : "" }
                            : {}),
                    })),
                    address,
                    songRequests,
                    message,
                    contactEmail,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                errorMsg =
                    data.error ??
                    "Could not save your reply — please try again.";
            } else {
                stage = "done";
            }
        } catch {
            errorMsg =
                "Could not save your reply — please check your connection and try again.";
        } finally {
            submitting = false;
        }
    }

    const seatWord = (n: number) =>
        [
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
        ][n] ?? String(n);

    /** Seats that count toward the head count — an unclaimed plus-one isn't one. */
    const seatCount = $derived(
        rows.filter((r) => !r.is_plus_one || r.revealed).length,
    );
    const goingCount = $derived(rows.filter((r) => r.attending).length);
</script>

{#if stage === "lookup"}
    <h2 class="card-title">Kindly respond</h2>
    <p class="sub">Enter a name from your invitation to find your party.</p>
    <form class="rsvp-form" onsubmit={lookup}>
        <div class="field">
            <label for="rsvp-lookup">Your invitation</label>
            <input
                id="rsvp-lookup"
                type="text"
                bind:value={query}
                placeholder="your last name is enough"
                autocomplete="name"
                required
                minlength="3"
            />
        </div>
        {#if matches.length > 1}
            <div class="matches">
                <div class="matches-label">Which invitation is yours?</div>
                {#each matches as m (m.id)}
                    <button type="button" class="match" onclick={() => pick(m)}>
                        <b>{m.display_name}</b>
                        {#if roster(m)}
                            <i>{roster(m)}</i>
                        {:else}
                            <i>enter your code to open</i>
                        {/if}
                    </button>
                {/each}
                <p class="matches-note">
                    Two households can share a name — pick the one listing your
                    people.
                </p>
            </div>
        {/if}
        {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
        <button class="claret-btn" type="submit" disabled={searching}>
            {searching ? "Searching…" : "Find my invitation"}
        </button>
    </form>
{:else if stage === "code" && pending}
    <h2 class="card-title">Kindly respond</h2>
    <p class="sub">
        Opening <b>{pending.display_name}</b> — enter the code from your invitation
        or text message.
    </p>
    {#if roster(pending)}
        <p class="roster-line">{roster(pending)}</p>
    {/if}
    <form class="rsvp-form" onsubmit={openParty}>
        <div class="field">
            <label for="rsvp-code">Invitation code</label>
            <input
                id="rsvp-code"
                type="text"
                bind:value={code}
                placeholder="e.g. K7M2PQ"
                autocapitalize="characters"
                autocomplete="off"
                spellcheck="false"
                required
                minlength="4"
            />
        </div>
        {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
        <button class="claret-btn" type="submit" disabled={opening}>
            {opening ? "Opening…" : "Open our invitation"}
        </button>
        <button
            type="button"
            class="link-btn"
            onclick={() => {
                pending = null;
                errorMsg = "";
                stage = "lookup";
            }}
        >
            ← search a different name
        </button>
    </form>
{:else if stage === "form" && selected}
    <h2 class="card-title">{selected.display_name}</h2>
    {#if selected.responded_at}
        <p class="replied-tag">
            Your reply is in — change anything below and seal it again.
        </p>
    {:else}
        <p class="sub">
            We found your invitation — reply for everyone in your party.
        </p>
    {/if}
    <form class="rsvp-form" onsubmit={submit}>
        <div class="party-box">
            <div class="party-head">
                Your party
                <i>
                    {seatWord(seatCount)}
                    {seatCount === 1 ? "seat" : "seats"}{goingCount
                        ? ` · ${goingCount} attending`
                        : ""}
                </i>
            </div>
            {#each rows as row, i (row.id)}
                {#if !row.is_plus_one || row.revealed}
                    <div class="guest-row" class:is-plus={row.is_plus_one}>
                        {#if row.is_plus_one}
                            <div class="plus-field">
                                <input
                                    class="plus-name"
                                    type="text"
                                    bind:value={rows[i].name}
                                    placeholder="your guest’s name"
                                    aria-label="Guest name"
                                />
                                <button
                                    type="button"
                                    class="plus-drop"
                                    aria-label="Remove this guest"
                                    title="Remove this guest"
                                    onclick={() => dropPlusOne(i)}
                                >
                                    ×
                                </button>
                            </div>
                        {:else}
                            <span class="g-name">{row.name}</span>
                        {/if}
                        <div
                            class="g-pills"
                            role="group"
                            aria-label="Attendance for {row.name || 'guest'}"
                        >
                            <button
                                type="button"
                                class="pill"
                                class:on={row.attending}
                                onclick={() => (rows[i].attending = true)}
                            >
                                Accepts
                            </button>
                            <button
                                type="button"
                                class="pill"
                                class:on={!row.attending}
                                onclick={() => (rows[i].attending = false)}
                            >
                                Declines
                            </button>
                        </div>
                        {#if row.attending}
                            <input
                                class="g-diet"
                                type="text"
                                bind:value={rows[i].dietary}
                                placeholder="allergies or dietary needs"
                                aria-label="Dietary needs for {row.name ||
                                    'guest'}"
                            />
                        {/if}
                    </div>
                {/if}
            {/each}

            {#if hiddenPlusOnes > 0}
                <div class="plus-add-wrap">
                    <button type="button" class="plus-add" onclick={addPlusOne}>
                        <span aria-hidden="true">+</span> Bring a guest
                        <i>optional</i>
                    </button>
                </div>
            {/if}
        </div>

        <fieldset class="addr">
            <legend>Your mailing address</legend>
            <p class="addr-why">
                For thank-you notes and anything else we send by post.
            </p>
            <div class="addr-grid">
                <div class="field span-2">
                    <label for="addr-1">Street address</label>
                    <input
                        id="addr-1"
                        type="text"
                        bind:value={address.address_line1}
                        placeholder="123 Magnolia Lane"
                        autocomplete="address-line1"
                        class:bad={!!showErr("address_line1")}
                        onblur={() => touch("address_line1")}
                    />
                    {#if showErr("address_line1")}<em class="f-err"
                            >{showErr("address_line1")}</em
                        >{/if}
                </div>
                <div class="field span-2">
                    <label for="addr-2"
                        >Apartment, suite <span class="opt">optional</span
                        ></label
                    >
                    <input
                        id="addr-2"
                        type="text"
                        bind:value={address.address_line2}
                        placeholder="Apt 4B"
                        autocomplete="address-line2"
                    />
                </div>
                <div class="field">
                    <label for="addr-city">City</label>
                    <input
                        id="addr-city"
                        type="text"
                        bind:value={address.city}
                        placeholder="Birmingham"
                        autocomplete="address-level2"
                        class:bad={!!showErr("city")}
                        onblur={() => touch("city")}
                    />
                    {#if showErr("city")}<em class="f-err">{showErr("city")}</em
                        >{/if}
                </div>
                <div class="field">
                    <label for="addr-state">State / region</label>
                    <input
                        id="addr-state"
                        type="text"
                        bind:value={address.state_region}
                        placeholder="Alabama"
                        autocomplete="address-level1"
                        class:bad={!!showErr("state_region")}
                        onblur={() => touch("state_region")}
                    />
                    {#if showErr("state_region")}<em class="f-err"
                            >{showErr("state_region")}</em
                        >{/if}
                </div>
                <div class="field">
                    <label for="addr-zip">ZIP / postal code</label>
                    <input
                        id="addr-zip"
                        type="text"
                        bind:value={address.postal_code}
                        placeholder="35203"
                        autocomplete="postal-code"
                        class:bad={!!showErr("postal_code")}
                        onblur={() => touch("postal_code")}
                    />
                    {#if showErr("postal_code")}<em class="f-err"
                            >{showErr("postal_code")}</em
                        >{/if}
                </div>
                <div class="field span-country">
                    <label for="addr-country">Country</label>
                    <input
                        id="addr-country"
                        type="text"
                        bind:value={address.country}
                        placeholder="United States"
                        autocomplete="country-name"
                    />
                </div>
            </div>
        </fieldset>

        <div class="tail-pair">
            <div class="field">
                <label for="rsvp-email">Email for your confirmation</label>
                <input
                    id="rsvp-email"
                    type="email"
                    bind:value={contactEmail}
                    placeholder="you@example.com"
                    autocomplete="email"
                />
            </div>
            <div class="field">
                <label for="rsvp-songs">Song requests</label>
                <input
                    id="rsvp-songs"
                    type="text"
                    bind:value={songRequests}
                    placeholder="the song that gets you dancing"
                />
            </div>
        </div>
        <div class="field">
            <label for="rsvp-message">A note for us</label>
            <textarea
                id="rsvp-message"
                rows="2"
                bind:value={message}
                placeholder="entirely optional"></textarea>
        </div>

        {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
        <button class="claret-btn" type="submit" disabled={submitting}>
            {submitting
                ? "Sealing…"
                : selected.responded_at
                  ? "Update & re-seal"
                  : "Seal & send"}
        </button>
    </form>
{:else}
    <div class="done">
        <div class="done-seal"><Seal size={84} /></div>
        <h2 class="card-title">Sealed &amp; sent</h2>
        <p class="sub">
            Thank you — your reply is safely on its way.
            {#if contactEmail}A confirmation is headed to {contactEmail}.{/if}
        </p>
        <p class="sub"><i>Until {WEDDING.dateLabel} —</i></p>
        {#if selected}
            <button
                type="button"
                class="link-btn"
                onclick={() => (stage = "form")}
            >
                change something
            </button>
        {/if}
        <a
            class="after-link"
            href={REGISTRY_URL}
            target="_blank"
            rel="noopener"
        >
            Looking for our registry? It lives with The Knot <Icon name="out" />
        </a>
    </div>
{/if}

<style>
    .card-title {
        font-size: clamp(1.9rem, 5vw, 2.4rem);
        color: var(--claret);
        text-align: center;
    }
    .sub {
        font-style: italic;
        font-weight: 600;
        font-size: 1.1rem;
        color: var(--ink-on-paper);
        margin: 0.4rem 0 1.6rem;
        text-align: center;
    }
    .replied-tag {
        margin: 0.5rem auto 1.5rem;
        text-align: center;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-label);
        border: 1px solid rgba(58, 36, 32, 0.45);
        padding: 0.5rem 0.9rem;
        max-width: max-content;
    }
    .roster-line {
        margin: -0.9rem 0 1.5rem;
        text-align: center;
        font-size: 1rem;
        font-weight: 600;
        font-style: italic;
        color: var(--chocolate);
    }
    .rsvp-form {
        display: grid;
        gap: 1.35rem;
        text-align: left;
    }
    /* Errors are the one thing on this card that must interrupt — given a tinted
       band and a rule so they don't read as more italic garden prose. */
    .error {
        margin: 0;
        color: #6b1a22;
        font-weight: 600;
        font-style: italic;
        font-size: 1.05rem;
        background: rgba(122, 31, 40, 0.09);
        border-left: 3px solid #7a1f28;
        padding: 0.6rem 0.8rem;
    }
    .f-err {
        display: block;
        margin-top: 0.3rem;
        font-style: normal;
        font-weight: 600;
        font-size: 0.9rem;
        color: #6b1a22;
    }
    .field input.bad {
        border-bottom-color: #7a1f28;
        background: rgba(122, 31, 40, 0.06);
    }
    .link-btn {
        background: none;
        border: none;
        color: var(--chocolate);
        font-family: var(--body);
        font-style: italic;
        font-weight: 600;
        font-size: 1.05rem;
        text-decoration: underline;
        text-underline-offset: 0.25em;
        text-decoration-color: rgba(58, 36, 32, 0.4);
        cursor: pointer;
        justify-self: center;
        padding: 0.4rem;
    }
    .link-btn:hover {
        color: var(--claret);
    }
    .matches {
        display: grid;
        gap: 0.6rem;
    }
    .matches-label {
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--ink-label);
    }
    .matches-note {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        font-style: italic;
        color: var(--chocolate);
    }
    .match {
        border: 1px solid rgba(58, 36, 32, 0.45);
        background: rgba(255, 253, 247, 0.3);
        padding: 0.8rem 1rem;
        text-align: left;
        cursor: pointer;
        font-family: var(--body);
        font-size: 1.1rem;
        display: grid;
        gap: 0.15rem;
        color: var(--ink-on-paper);
    }
    .match:hover {
        background: rgba(58, 36, 32, 0.07);
    }
    .match b {
        font-weight: 700;
    }
    .match i {
        font-size: 0.98rem;
        font-weight: 500;
        opacity: 0.85;
    }
    .party-box {
        border: 1px solid rgba(58, 36, 32, 0.4);
        padding: 1.1rem 1.15rem 1.25rem;
        display: grid;
        gap: 1.15rem;
    }
    .party-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.8rem;
        flex-wrap: wrap;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--ink-label);
        border-bottom: 1px solid rgba(58, 36, 32, 0.35);
        padding-bottom: 0.6rem;
    }
    .party-head i {
        font-style: italic;
        font-weight: 600;
        text-transform: none;
        letter-spacing: 0.03em;
        font-size: 1rem;
    }
    .guest-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.6rem 0.8rem;
        align-items: center;
    }
    /* Each guest owns a name, two pills, a meal and a diet box — without a rule
       between them the rows read as one long list of controls and it stops being
       obvious which meal belongs to whom. */
    .guest-row + .guest-row {
        border-top: 1px solid rgba(58, 36, 32, 0.22);
        padding-top: 1rem;
    }
    .g-name {
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--ink-on-paper);
    }

    /* ── plus-one: kept quiet and off to the side until it's wanted ────────── */
    .plus-add-wrap {
        display: flex;
        justify-content: flex-end;
    }
    .plus-add {
        background: none;
        border: 1px dashed rgba(58, 36, 32, 0.5);
        color: var(--chocolate);
        font-family: var(--body);
        font-size: 0.98rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        padding: 0.5rem 0.9rem;
        cursor: pointer;
        opacity: 0.9;
        display: inline-flex;
        align-items: baseline;
        gap: 0.4rem;
        transition:
            opacity 0.2s ease,
            border-color 0.2s ease;
    }
    .plus-add:hover {
        opacity: 1;
        border-color: var(--claret);
        color: var(--claret);
    }
    .plus-add i {
        font-size: 0.85rem;
        font-weight: 500;
        opacity: 0.8;
    }
    .guest-row.is-plus {
        border-top-style: dotted;
    }
    .plus-field {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        /* A name is a name however wide the card gets — left to fill the column it
           dwarfs the named guests sitting above it. */
        max-width: 24rem;
    }
    .plus-name {
        flex: 1;
        min-width: 0;
        background: rgba(255, 253, 247, 0.35);
        border: none;
        border-bottom: 2px dashed rgba(58, 36, 32, 0.55);
        font-family: var(--body);
        font-size: 1.1rem;
        font-weight: 600;
        font-style: italic;
        color: var(--ink-on-paper);
        padding: 0.45rem 0.5rem;
    }
    .plus-name:focus {
        outline: none;
        background: rgba(255, 253, 247, 0.75);
        border-bottom-color: var(--claret);
    }
    /* Was a bare glyph that read as punctuation; given an outline and a real
       target so it's recognisable as the way to give the seat back. */
    .plus-drop {
        flex: none;
        display: grid;
        place-items: center;
        width: 2.1rem;
        height: 2.1rem;
        background: none;
        border: 1px solid rgba(58, 36, 32, 0.4);
        color: var(--chocolate);
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        padding: 0;
    }
    .plus-drop:hover {
        color: var(--parchment);
        background: var(--claret);
        border-color: var(--claret);
    }

    .g-pills {
        display: flex;
        gap: 0.45rem;
        justify-self: end;
    }
    /* Accept/decline is the one decision every guest has to make, so the pills get
       a real tap target and enough weight to be read at arm's length. */
    .pill {
        border: 1px solid rgba(58, 36, 32, 0.5);
        background: rgba(255, 253, 247, 0.3);
        font-family: var(--body);
        font-size: 0.98rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: var(--ink-on-paper);
        padding: 0.55rem 1.1rem;
        cursor: pointer;
        transition:
            background 0.2s ease,
            color 0.2s ease;
    }
    .pill.on {
        background: var(--claret);
        color: var(--parchment);
        border-color: var(--claret);
        font-weight: 700;
    }
    /* With the meal picker gone the allergies box is the whole second line of a
       guest's row, so let it run the full width rather than sit in one column. */
    .g-diet {
        grid-column: 1 / -1;
        width: 100%;
        background: rgba(255, 253, 247, 0.3);
        border: none;
        border-bottom: 2px solid rgba(58, 36, 32, 0.4);
        font-family: var(--body);
        font-size: 1.05rem;
        font-weight: 500;
        font-style: italic;
        color: var(--ink-on-paper);
        padding: 0.45rem 0.5rem;
    }
    .g-diet:focus {
        outline: none;
        background: rgba(255, 253, 247, 0.75);
        border-bottom-color: var(--claret);
    }
    .g-diet::placeholder,
    .plus-name::placeholder {
        color: rgba(58, 36, 32, 0.55);
    }

    /* ── mailing address ───────────────────────────────────────────────────── */
    .addr {
        border: 1px solid rgba(58, 36, 32, 0.4);
        padding: 0.4rem 1.15rem 1.25rem;
        margin: 0;
    }
    .addr legend {
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--ink-label);
        padding: 0 0.5rem;
    }
    .addr-why {
        margin: 0 0 1.1rem;
        font-size: 0.98rem;
        font-weight: 600;
        font-style: italic;
        color: var(--chocolate);
    }
    .addr-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.15rem 0.9rem;
    }
    .addr-grid .span-2 {
        grid-column: 1 / -1;
    }
    /* The card is wide enough on a desktop to lay the address out the way it's
       actually written — city, state and ZIP on one line — instead of pairing ZIP
       with country because two columns was all there was room for. */
    @media (min-width: 700px) {
        .addr-grid {
            grid-template-columns: repeat(3, 1fr);
        }
        .addr-grid .span-country {
            grid-column: 1 / -1;
        }
    }
    .opt {
        font-weight: 500;
        letter-spacing: 0.1em;
        opacity: 0.75;
    }
    /* Two short one-line answers; side by side on a wide card, stacked on a phone. */
    .tail-pair {
        display: grid;
        gap: 1.35rem;
    }
    @media (min-width: 700px) {
        .tail-pair {
            grid-template-columns: 1fr 1fr;
            gap: 1.35rem 0.9rem;
        }
    }

    @media (max-width: 560px) {
        .guest-row {
            grid-template-columns: 1fr;
        }
        /* Stacked, the pills have the whole width — split it between them rather
           than leaving two small targets huddled on the left. */
        .g-pills {
            justify-self: stretch;
        }
        .g-pills .pill {
            flex: 1;
            padding: 0.7rem 0.5rem;
        }
        .addr-grid {
            grid-template-columns: 1fr;
        }
    }
    .done {
        text-align: center;
        display: grid;
        gap: 0.6rem;
        justify-items: center;
        padding: 1rem 0 0.5rem;
    }
    .done-seal {
        animation: press 0.5s ease;
    }
    .after-link {
        font-style: italic;
        font-weight: 600;
        color: var(--chocolate);
        font-size: 1.05rem;
    }
    @keyframes press {
        0% {
            transform: scale(1.5);
            opacity: 0;
        }
        60% {
            transform: scale(0.92);
            opacity: 1;
        }
        100% {
            transform: scale(1);
        }
    }
</style>
