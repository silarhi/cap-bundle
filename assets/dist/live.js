import { i as reset, o as tokenOf, t as SELECTOR } from "./core.js";
// src/adapters/live.ts
const INSTALLED = Symbol.for("@silarhi/cap-bundle/live");
/**
* Sends the token of a Symfony UX Live Component form with the action its submit triggers, and only then: every
* re-render submits the form (ComponentWithFormTrait), so a token in the model any earlier would be redeemed by the
* first field the visitor changes. CapType renders the challenge with data-live-ignore, which keeps it, and its
* token, out of the re-renders. Install the core first: it solves the challenges before this adapter sees the submit.
* Idempotent.
*/
function installLive() {
	const registry = window;
	if (registry[INSTALLED]) return;
	registry[INSTALLED] = true;
	document.addEventListener("submit", onSubmit, true);
}
function onSubmit(event) {
	const form = event.target;
	if (!(form instanceof HTMLFormElement)) return;
	const component = form.closest("[data-controller~=\"live\"]")?.__component;
	if (!component) return;
	const fields = Array.from(form.querySelectorAll(SELECTOR));
	if (fields.some((field) => "" === tokenOf(field))) return;
	for (const field of fields) {
		const model = field instanceof HTMLInputElement ? field.name : field.getAttribute("data-cap-hidden-field-name");
		if (!model) continue;
		component.set(model, tokenOf(field), false).then(() => {
			reset(field);
			return component.set(model, "", false);
		}).catch(() => {});
	}
}
export { installLive };
