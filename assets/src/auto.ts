/**
 * The script CapType renders next to each challenge (public/cap.js, served from /bundles/silarhicap/cap.js): no build
 * step needed. A module runs once per page, however many forms render it and however many Turbo visits follow.
 */
import { configure, install, SELECTOR } from './core'

install()

const element = document.querySelector<HTMLElement>(`${SELECTOR}[data-silarhi-cap-script]`)
if (element?.dataset.silarhiCapScript) {
    // Before the widget renders: it reads the nonce of its <style> when it connects
    configure(element)
    // Loaded from here rather than by its own <script> tag, so that it always comes after configure()
    import(/* webpackIgnore: true */ element.dataset.silarhiCapScript).catch((error: unknown) => {
        console.error('Cap: the widget script could not be loaded.', error)
    })
}
