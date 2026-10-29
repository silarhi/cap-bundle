import { installLive } from './live'
import { installTurbo } from './turbo'

/** The adapters CapType can ask for, by the name of its `adapters` option. */
const adapters: Record<string, () => void> = {
    live: installLive,
    turbo: installTurbo,
}

/**
 * Installs the adapters a challenge lists in `data-silarhi-cap-adapters` (space-separated), as CapType renders them
 * from the `cap.adapters` configuration.
 */
export function installAdapters(element: HTMLElement): void {
    for (const name of (element.dataset.silarhiCapAdapters ?? '').split(' ')) {
        adapters[name]?.()
    }
}
