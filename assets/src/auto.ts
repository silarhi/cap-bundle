/**
 * The script CapType renders next to each challenge (public/cap.js, served from /bundles/silarhicap/cap.js): no build
 * step needed. A module runs once per page, however many forms render it and however many SPA visits follow.
 */
import { connect } from './connect'
import { install, SELECTOR } from './core'

install()

// Every challenge carries the same application-wide settings: the first one is enough
const challenge = document.querySelector<HTMLElement>(SELECTOR)
if (challenge) {
    connect(challenge)
}
