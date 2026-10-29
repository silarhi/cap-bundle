import { reset, SELECTOR, tokenOf } from '../core'

/** What the adapter needs of a Live Component, as `element.__component` exposes it. */
interface LiveComponent {
    set(model: string, value: unknown, reRender?: boolean): Promise<unknown>
}

const INSTALLED = Symbol.for('@silarhi/cap-bundle/live')

/**
 * Sends the token of a Symfony UX Live Component form with the action its submit triggers, and only then: every
 * re-render submits the form (ComponentWithFormTrait), so a token in the model any earlier would be redeemed by the
 * first field the visitor changes. CapType renders the challenge with data-live-ignore, which keeps it, and its
 * token, out of the re-renders. Install the core first: it solves the challenges before this adapter sees the submit.
 * Idempotent.
 */
export function installLive(): void {
    const registry = window as unknown as Record<symbol, boolean | undefined>
    if (registry[INSTALLED]) {
        return
    }
    registry[INSTALLED] = true

    // Capture phase, after the core: before the live#action listener of the form sends the action
    document.addEventListener('submit', onSubmit, true)
}

function onSubmit(event: Event): void {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) {
        return
    }

    const component = form.closest<HTMLElement & { __component?: LiveComponent }>(
        '[data-controller~="live"]'
    )?.__component
    if (!component) {
        return
    }

    const fields = Array.from(form.querySelectorAll<HTMLElement>(SELECTOR))
    // An unsolved challenge: the core holds the submit back and submits again once solved
    if (fields.some((field) => '' === tokenOf(field))) {
        return
    }

    for (const field of fields) {
        const model = field instanceof HTMLInputElement ? field.name : field.getAttribute('data-cap-hidden-field-name')
        if (!model) {
            continue
        }

        // Resolves once the request that carries the token, the action's, is over
        component
            .set(model, tokenOf(field), false)
            .then(() => {
                // Redeemed, whatever the outcome: a form the component keeps on the page needs a new token, and the
                // re-renders to come must not send the spent one
                reset(field)
                return component.set(model, '', false)
            })
            .catch(() => {
                // The component left the page (redirect, removal): nothing to forget
            })
    }
}
