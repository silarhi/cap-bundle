// src/core.ts
/**
* Glue between CapType and the Cap widget, whatever brings the form to the page (a full page load, Turbo, htmx, any
* SPA): listeners delegated to the document, so there is nothing to mount or unmount per form. Nothing here knows a
* framework: the adapters (adapters/) add what one needs, such as forgetting the tokens Turbo submitted.
*/
/** The elements CapType renders: `data-silarhi-cap="checkbox"` on a `<cap-widget>`, `"invisible"` on a hidden input. */
const SELECTOR = "[data-silarhi-cap]";
/** How long the submit of an invisible challenge waits for the cap-widget script before giving up. */
const WIDGET_TIMEOUT = 1e4;
/** Shared by every copy of this module on the page: the bundle's script and an application bundle may both load it. */
const INSTALLED = Symbol.for("@silarhi/cap-bundle");
const solving = /* @__PURE__ */ new WeakMap();
const invisibleCaps = /* @__PURE__ */ new Map();
const busyForms = /* @__PURE__ */ new WeakSet();
const bypassedForms = /* @__PURE__ */ new WeakSet();
/**
* Listens to the document for the forms protected by Cap. Idempotent: call it as often as you like.
*/
function install() {
	const registry = window;
	if (registry[INSTALLED]) return;
	registry[INSTALLED] = true;
	document.addEventListener("submit", onSubmit, true);
	document.addEventListener("focusin", onFocusIn);
	window.addEventListener("pageshow", (event) => {
		if (event.persisted) reset(document);
	});
}
/**
* Copies the widget settings CapType renders on the element (`data-silarhi-cap-*`) to the globals the widget reads.
* The first one wins: they are application-wide, and the nonce of the first page is the one its CSP accepts.
*/
function configure(element) {
	const { silarhiCapWasmUrl, silarhiCapHashwxUrl, silarhiCapNonce } = element.dataset;
	window.CAP_CUSTOM_WASM_URL ??= silarhiCapWasmUrl;
	window.CAP_CUSTOM_HASHWX_URL ??= silarhiCapHashwxUrl;
	window.CAP_CSS_NONCE ??= silarhiCapNonce;
	window.CAP_SCRIPT_NONCE ??= silarhiCapNonce;
}
/**
* Solves the challenges of a form (or a single challenge) that have no token yet.
*
* Resolves false when one failed: the widget shows why, an invisible challenge stays empty.
*/
async function solve(target) {
	return (await Promise.all(fieldsOf(target).map(solveField))).every(Boolean);
}
/**
* Forgets the tokens of a form, a field or the whole document. The Turbo adapter resets them for you; call it after
* submitting a form with fetch() yourself and keeping it on the page, as a token is single-use.
*/
function reset(target) {
	for (const field of fieldsOf(target)) if (isInvisible(field)) {
		field.value = "";
		invisibleCaps.get(field)?.reset();
	} else if (hasToken(field)) field.reset();
}
function fieldsOf(target) {
	if (target instanceof Element && target.matches("[data-silarhi-cap]")) return [target];
	return Array.from(target.querySelectorAll(SELECTOR));
}
function isInvisible(field) {
	return field instanceof HTMLInputElement;
}
function hasToken(field) {
	return isInvisible(field) ? field.value !== "" : Boolean(field.token);
}
function solveField(field) {
	if (hasToken(field)) return Promise.resolve(true);
	let pending = solving.get(field);
	if (!pending) {
		pending = (isInvisible(field) ? solveInvisible(field) : solveWidget(field)).finally(() => solving.delete(field));
		solving.set(field, pending);
	}
	return pending;
}
async function solveWidget(widget) {
	if (!await widgetDefined()) return false;
	if (widget.token) return true;
	return new Promise((resolve) => {
		const settle = (solved) => {
			widget.removeEventListener("solve", onSolve);
			widget.removeEventListener("error", onError);
			resolve(solved);
		};
		const onSolve = () => settle(true);
		const onError = () => settle(false);
		widget.addEventListener("solve", onSolve);
		widget.addEventListener("error", onError);
		Promise.resolve(widget.solve()).catch(() => settle(false));
	});
}
async function solveInvisible(input) {
	if (!await widgetDefined()) return false;
	let cap = invisibleCaps.get(input);
	if (!cap) cap = createInvisibleCap(window.Cap, input);
	try {
		const token = (await cap.solve())?.token ?? cap.token;
		if (token) {
			input.value = token;
			return true;
		}
	} catch {}
	return false;
}
function createInvisibleCap(CapClass, input) {
	for (const [field, cap] of invisibleCaps) if (!field.isConnected) {
		cap.widget.remove();
		invisibleCaps.delete(field);
	}
	const config = { apiEndpoint: input.dataset.capApiEndpoint ?? "" };
	for (const attribute of ["data-cap-worker-count", "data-cap-lang"]) {
		const value = input.getAttribute(attribute);
		if (value !== null) config[attribute] = value;
	}
	const cap = new CapClass(config);
	cap.addEventListener("reset", () => {
		input.value = "";
	});
	invisibleCaps.set(input, cap);
	return cap;
}
function widgetDefined() {
	let timer;
	return Promise.race([customElements.whenDefined("cap-widget").then(() => true), new Promise((resolve) => {
		timer = setTimeout(() => resolve(false), WIDGET_TIMEOUT);
	})]).finally(() => clearTimeout(timer));
}
function onSubmit(event) {
	const form = event.target;
	if (!(form instanceof HTMLFormElement)) return;
	if (bypassedForms.has(form)) return;
	const pending = fieldsOf(form).filter((field) => !hasToken(field));
	if (pending.length === 0) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	if (busyForms.has(form)) return;
	busyForms.add(form);
	form.setAttribute("aria-busy", "true");
	form.dispatchEvent(new CustomEvent("cap:solving", { bubbles: true }));
	const submitter = event.submitter;
	Promise.all(pending.map(solveField)).then((results) => {
		busyForms.delete(form);
		form.removeAttribute("aria-busy");
		const solved = results.every(Boolean);
		form.dispatchEvent(new CustomEvent(solved ? "cap:solved" : "cap:failed", { bubbles: true }));
		if (!form.isConnected) return;
		bypassedForms.add(form);
		try {
			if (submitter?.isConnected && submitter.closest("form") === form) form.requestSubmit(submitter);
			else form.requestSubmit();
		} finally {
			bypassedForms.delete(form);
		}
	});
}
function onFocusIn(event) {
	const form = event.target instanceof Element ? event.target.closest("form") : null;
	if (!form) return;
	for (const field of fieldsOf(form)) if (isInvisible(field) && !hasToken(field)) solveField(field);
}
export { solve as a, reset as i, configure as n, install as r, SELECTOR as t };
