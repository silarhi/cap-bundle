import { Controller } from '@hotwired/stimulus'
import { configure, install, reset, solve } from './core'

/**
 * Registered by StimulusBundle as "silarhi--cap-bundle--cap", the controller CapType puts on every challenge: it
 * loads the cap-widget package the first time a protected form shows up, and installs the submit handling.
 */
export default class extends Controller<HTMLElement> {
    connect(): void {
        // Before the widget renders: it reads the nonce of its <style> when it connects
        configure(this.element)
        install()
        void import('cap-widget')
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
