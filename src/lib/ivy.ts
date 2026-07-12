/**
 * Procedural ivy — each leaf is drawn inline along a curve with seeded
 * variation in size, angle, and pigment, so no two vines repeat.
 * Vines *grow* the first time they enter the viewport: the stem draws
 * itself and leaves unfurl one by one (skipped under reduced motion).
 * Exposed as Svelte actions: use:flankIvy, use:cornerIvy, use:dividerIvy.
 */

const NS = 'http://www.w3.org/2000/svg';
const LEAF_D =
	'M0 0 C -1.5 -1 -4.5 -1.5 -5 -4.5 C -5.3 -6.5 -3.5 -8 -1.8 -7.6 C -1.6 -9.4 1.6 -9.4 1.8 -7.6 C 3.5 -8 5.3 -6.5 5 -4.5 C 4.5 -1.5 1.5 -1 0 0 Z';
const LEAF_COLORS = ['#4B5A3A', '#57683F', '#3E4A31', '#8B907F', '#4B5A3A', '#57683F', '#6A4A50'];

const srand = (i: number) => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

export function drawVine(
	svg: SVGSVGElement,
	d: string,
	seed: number,
	spacing = 12,
	size = 1,
	animate = false,
	baseDelay = 0
) {
	const stem = document.createElementNS(NS, 'path');
	stem.setAttribute('d', d);
	stem.setAttribute('fill', 'none');
	stem.setAttribute('stroke', '#3E4A2E');
	stem.setAttribute('stroke-width', '1.4');
	stem.setAttribute('stroke-linecap', 'round');
	stem.setAttribute('opacity', '0.95');
	svg.appendChild(stem);
	const len = stem.getTotalLength();
	if (animate) {
		stem.setAttribute('stroke-dasharray', String(len));
		stem.setAttribute('stroke-dashoffset', String(len));
		stem.style.animation = `stem-draw 1.1s ease ${baseDelay}ms both`;
	}
	const n = Math.max(4, Math.floor(len / spacing));
	for (let i = 1; i <= n; i++) {
		const t = i / n;
		const p = stem.getPointAtLength(t * len);
		const p2 = stem.getPointAtLength(Math.min(len, t * len + 2));
		const ang = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
		const side = i % 2 ? 1 : -1;
		const r1 = srand(i + seed * 100);
		const r2 = srand(i * 7 + seed * 100);
		const holder = document.createElementNS(NS, 'g');
		const s = (0.9 + r1 * 0.8) * size;
		holder.setAttribute(
			'transform',
			`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(ang + side * (50 + r2 * 45) + 90).toFixed(1)}) scale(${s.toFixed(2)})`
		);
		const leaf = document.createElementNS(NS, 'path');
		leaf.setAttribute('d', LEAF_D);
		leaf.setAttribute('fill', LEAF_COLORS[Math.floor(r1 * LEAF_COLORS.length)]);
		leaf.setAttribute('opacity', (0.85 + r2 * 0.15).toFixed(2));
		if (animate) {
			// leaves unfurl in stem order, just behind the drawing tip
			leaf.style.transformBox = 'fill-box';
			leaf.style.transformOrigin = '50% 100%';
			leaf.style.animation = `leaf-in 0.5s ease ${Math.round(baseDelay + (i / n) * 1100)}ms both`;
		}
		holder.appendChild(leaf);
		svg.appendChild(holder);
	}
}

function clearSvg(svg: SVGSVGElement) {
	while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function makeOverlay(el: HTMLElement): SVGSVGElement {
	const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
	svg.setAttribute('class', 'vines');
	svg.setAttribute('aria-hidden', 'true');
	el.appendChild(svg);
	return svg;
}

/**
 * Grow once when the element first becomes visible (animated), then
 * redraw instantly on any later resize.
 */
function observed(el: Element, grow: (animate: boolean) => boolean) {
	let grown = false;
	let timer: ReturnType<typeof setTimeout>;
	const schedule = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (grown) grown = grow(false) || grown;
			else if (grow(true)) grown = true;
		}, 120);
	};
	let io: IntersectionObserver | undefined;
	let ro: ResizeObserver | undefined;
	try {
		io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting) && !grown) {
					if (grow(true)) grown = true;
					if (grown) io?.disconnect();
				}
			},
			{ threshold: 0.15 }
		);
		io.observe(el);
		ro = new ResizeObserver(() => {
			if (grown) schedule();
		});
		ro.observe(el);
	} catch {
		grown = grow(false);
	}
	return {
		destroy() {
			clearTimeout(timer);
			io?.disconnect();
			ro?.disconnect();
		}
	};
}

/**
 * Vines climbing a pair of flanking .col columns inside `el`,
 * plus an optional crown drape across the top (crown: true).
 */
export function flankIvy(
	el: HTMLElement,
	opts: { seed?: number; crown?: boolean; delay?: number } = {}
) {
	const seed = opts.seed ?? 1;
	const baseDelay = opts.delay ?? 0;
	const svg = makeOverlay(el);
	const grow = (animate: boolean): boolean => {
		try {
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			if (!w || !h) return false;
			clearSvg(svg);
			svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
			const cols = el.querySelectorAll<SVGSVGElement>(':scope > .col');
			if (cols.length === 2 && cols[0].getBoundingClientRect().width > 0) {
				const cw = cols[0].getBoundingClientRect().width;
				const lx = cw * 0.5;
				const rx = w - cw * 0.5;
				drawVine(
					svg,
					`M ${lx - 6} ${h} C ${lx - 18} ${h * 0.82} ${lx + 14} ${h * 0.66} ${lx} ${h * 0.5} C ${lx - 16} ${h * 0.36} ${lx + 12} ${h * 0.26} ${lx + 2} ${h * 0.15}`,
					seed,
					12,
					1,
					animate,
					baseDelay
				);
				drawVine(
					svg,
					`M ${rx + 4} ${h} C ${rx + 16} ${h * 0.84} ${rx - 14} ${h * 0.7} ${rx} ${h * 0.56} C ${rx + 14} ${h * 0.46} ${rx - 10} ${h * 0.42} ${rx - 4} ${h * 0.36}`,
					seed + 1,
					13,
					1,
					animate,
					baseDelay + 180
				);
			}
			if (opts.crown) {
				drawVine(
					svg,
					`M ${w * 0.3} ${h * 0.1} C ${w * 0.4} ${h * 0.015} ${w * 0.6} ${h * 0.015} ${w * 0.7} ${h * 0.1}`,
					seed + 2,
					12,
					0.9,
					animate,
					baseDelay + 500
				);
			}
			return true;
		} catch {
			return true; // decoration only — don't retry forever
		}
	};
	return observed(el, grow);
}

/** Ivy creeping up the left edge and over the shoulder of a frame. */
export function cornerIvy(el: HTMLElement, opts: { seed?: number } = {}) {
	const seed = opts.seed ?? 40;
	const svg = makeOverlay(el);
	const grow = (animate: boolean): boolean => {
		try {
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			if (!w || !h) return false;
			clearSvg(svg);
			svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
			drawVine(
				svg,
				`M 8 ${h + 6} C -8 ${h * 0.72} 20 ${h * 0.58} 6 ${h * 0.42} C -4 ${h * 0.28} 4 ${h * 0.18} ${w * 0.12} ${h * 0.06} C ${w * 0.2} -4 ${w * 0.34} -2 ${w * 0.42} ${h * 0.04}`,
				seed,
				13,
				0.85,
				animate
			);
			return true;
		} catch {
			return true;
		}
	};
	return observed(el, grow);
}

/** Horizontal vine flourish for section headings (fixed 320×34 viewBox). */
export function dividerIvy(svg: SVGSVGElement, opts: { seed?: number } = {}) {
	svg.setAttribute('viewBox', '0 0 320 34');
	const grow = (animate: boolean): boolean => {
		try {
			clearSvg(svg);
			drawVine(svg, 'M 8 20 C 60 6 110 30 160 16 C 200 6 260 8 312 20', opts.seed ?? 10, 12, 0.8, animate);
			return true;
		} catch {
			return true;
		}
	};
	return observed(svg, grow);
}
