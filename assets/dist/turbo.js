import { i as reset } from "./core.js";
// src/adapters/turbo.ts
const INSTALLED = Symbol.for("@silarhi/cap-bundle/turbo");
/**
* Forgets the tokens Turbo Drive would reuse: tokens are single-use, so a form Turbo keeps on the page after
* submitting it (stream response, morphed 422...) needs a new one, and a page restored from the Turbo cache must not
* submit the tokens of its snapshot. Idempotent.
*/
function installTurbo() {
	const registry = window;
	if (registry[INSTALLED]) return;
	registry[INSTALLED] = true;
	document.addEventListener("turbo:submit-end", (event) => {
		if (event.target instanceof HTMLFormElement) reset(event.target);
	});
	document.addEventListener("turbo:before-cache", () => reset(document));
}
export { installTurbo };
