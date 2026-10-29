import { a as solve, i as reset, n as configure, r as install } from "./core.js";
import { installTurbo } from "./turbo.js";
import { Controller } from "@hotwired/stimulus";
// src/adapters/index.ts
/** The adapters CapType can ask for, by the name of its `adapters` option. */
const adapters = { turbo: installTurbo };
/**
* Installs the adapters a challenge lists in `data-silarhi-cap-adapters` (space-separated), as CapType renders them
* from the `cap.adapters` configuration.
*/
function installAdapters(element) {
	for (const name of (element.dataset.silarhiCapAdapters ?? "").split(" ")) adapters[name]?.();
}
// src/controller.ts
/**
* Registered by StimulusBundle as "silarhi--cap-bundle--cap", the controller CapType puts on every challenge: it
* loads the cap-widget package the first time a protected form shows up, and installs the submit handling and the
* adapters the `cap.adapters` configuration lists.
*/
var controller_default = class extends Controller {
	connect() {
		configure(this.element);
		install();
		installAdapters(this.element);
		import("cap-widget");
	}
	/** Solves the challenge now, e.g. `data-action="click->silarhi--cap-bundle--cap#solve"`. */
	solve() {
		return solve(this.element);
	}
	/** Forgets the token, after submitting the form with fetch() yourself. */
	reset() {
		reset(this.element);
	}
};
export { controller_default as default };
