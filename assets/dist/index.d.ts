import { CapWidget } from "cap-widget";
/**
 * Glue between CapType and the Cap widget, whatever brings the form to the page (a full page load, Turbo, htmx, any
 * SPA): listeners delegated to the document, so there is nothing to mount or unmount per form. Nothing here knows a
 * framework: the adapters (adapters/) add what one needs, such as forgetting the tokens Turbo submitted.
 */
/** The elements CapType renders: `data-silarhi-cap="checkbox"` on a `<cap-widget>`, `"invisible"` on a hidden input. */
export declare const SELECTOR = "[data-silarhi-cap]";
type CapWidgetElement = CapWidget;
/**
 * Listens to the document for the forms protected by Cap. Idempotent: call it as often as you like.
 */
export declare function install(): void;
/**
 * Copies the widget settings CapType renders on the element (`data-silarhi-cap-*`) to the globals the widget reads.
 * The first one wins: they are application-wide, and the nonce of the first page is the one its CSP accepts.
 */
export declare function configure(element: HTMLElement): void;
/**
 * Solves the challenges of a form (or a single challenge) that have no token yet.
 *
 * Resolves false when one failed: the widget shows why, an invisible challenge stays empty.
 */
export declare function solve(target: Element): Promise<boolean>;
/**
 * Forgets the tokens of a form, a field or the whole document. The Turbo adapter resets them for you; call it after
 * submitting a form with fetch() yourself and keeping it on the page, as a token is single-use.
 */
export declare function reset(target: Element | Document): void;
/**
 * The token of a challenge, an empty string when it has none: for adapters that send it themselves.
 */
export declare function tokenOf(field: Element): string;
export type { CapWidgetElement };