import { a as reset, o as solve } from "./core.js";
import { t as connect } from "./connect.js";
import { Controller } from "@hotwired/stimulus";
// src/controller.ts
/**
* Registered by StimulusBundle as "silarhi--cap-bundle--cap", the controller CapType puts on every challenge: it
* loads the widget script the first time a protected form shows up, and installs the submit handling and the adapters
* the `cap.adapters` configuration lists.
*/
var controller_default = class extends Controller {
	connect() {
		connect(this.element);
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
