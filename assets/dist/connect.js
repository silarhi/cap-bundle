import { i as loadWidget, n as configure, r as install } from "./core.js";
import { installLive } from "./live.js";
import { installTurbo } from "./turbo.js";
// src/adapters/index.ts
/** The adapters CapType can ask for, by the name of its `adapters` option. */
const adapters = {
	live: installLive,
	turbo: installTurbo
};
/**
* Installs the adapters a challenge lists in `data-silarhi-cap-adapters` (space-separated), as CapType renders them
* from the `cap.adapters` configuration.
*/
function installAdapters(element) {
	for (const name of (element.dataset.silarhiCapAdapters ?? "").split(" ")) adapters[name]?.();
}
// src/connect.ts
/**
* Everything a challenge needs once it is in the page: the submit handling, the adapters CapType lists, the widget
* settings and the widget script. What the Stimulus controller and the bundle's script do, for any other way of
* reacting to elements that show up (a listener library, Alpine, htmx...). Idempotent: call it for each challenge.
*/
function connect(element) {
	install();
	installAdapters(element);
	configure(element);
	loadWidget(element);
}
export { connect as t };
