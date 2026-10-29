import { Controller } from "@hotwired/stimulus";
/**
 * Registered by StimulusBundle as "silarhi--cap-bundle--cap", the controller CapType puts on every challenge: it
 * loads the cap-widget package the first time a protected form shows up, and installs the submit handling.
 */
export default class export_default extends Controller<HTMLElement> {
  connect(): void;
  /** Solves the challenge now, e.g. `data-action="click->silarhi--cap-bundle--cap#solve"`. */
  solve(): Promise<boolean>;
  /** Forgets the token, after submitting the form with fetch() yourself. */
  reset(): void;
}