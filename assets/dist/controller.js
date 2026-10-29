import { a as solve, i as reset, n as configure, r as install } from "./core.js";
import { Controller } from "@hotwired/stimulus";
// src/controller.ts
/**
* Registered by StimulusBundle as "silarhi--cap-bundle--cap", the controller CapType puts on every challenge: it
* loads the cap-widget package the first time a protected form shows up, and installs the submit handling.
*/
var controller_default = class extends Controller {
	connect() {
		configure(this.element);
		install();
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
