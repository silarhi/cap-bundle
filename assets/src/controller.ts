import { Controller } from '@hotwired/stimulus'
import { connect } from './connect'
import { reset, solve } from './core'

/**
 * Registered by StimulusBundle as "silarhi--cap-bundle--cap", the controller CapType puts on every challenge: it
 * loads the widget script the first time a protected form shows up, and installs the submit handling and the adapters
 * the `cap.adapters` configuration lists.
 */
export default class extends Controller<HTMLElement> {
    connect(): void {
        connect(this.element)
    }

    /** Solves the challenge now, e.g. `data-action="click->silarhi--cap-bundle--cap#solve"`. */
    solve(): Promise<boolean> {
        return solve(this.element)
    }

    /** Forgets the token, after submitting the form with fetch() yourself. */
    reset(): void {
        reset(this.element)
    }
}
