/** Scroll-reveal action: fades sections in as they enter the viewport. */
export function reveal(el: HTMLElement) {
	el.classList.add('reveal');
	let io: IntersectionObserver | undefined;
	try {
		io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						e.target.classList.add('in');
						io?.unobserve(e.target);
					}
				}
			},
			{ threshold: 0.12 }
		);
		io.observe(el);
	} catch {
		el.classList.add('in');
	}
	return {
		destroy() {
			io?.disconnect();
		}
	};
}
