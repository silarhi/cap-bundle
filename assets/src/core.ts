import type { Cap, CapConfig, CapWidget } from 'cap-widget'

/**
 * Glue between CapType and the Cap widget, whatever brings the form to the page (a full page load, Turbo, htmx, any
 * SPA): listeners delegated to the document, so there is nothing to mount or unmount per form. Nothing here knows a
 * framework: the adapters (adapters/) add what one needs, such as forgetting the tokens Turbo submitted.
 */

/** The elements CapType renders: `data-silarhi-cap="checkbox"` on a `<cap-widget>`, `"invisible"` on a hidden input. */
export const SELECTOR = '[data-silarhi-cap]'

/** How long the submit of an invisible challenge waits for the cap-widget script before giving up. */
const WIDGET_TIMEOUT = 10_000

export type CapWidgetElement = CapWidget

/** Shared by every copy of this module on the page: the bundle's script and an application bundle may both load it. */
const INSTALLED = Symbol.for('@silarhi/cap-bundle')

const solving = new WeakMap<Element, Promise<boolean>>()
const invisibleCaps = new Map<HTMLInputElement, Cap>()
const busyForms = new WeakSet<HTMLFormElement>()
const bypassedForms = new WeakSet<HTMLFormElement>()

/**
 * Listens to the document for the forms protected by Cap. Idempotent: call it as often as you like.
 */
export function install(): void {
    const registry = window as unknown as Record<symbol, boolean | undefined>
    if (registry[INSTALLED]) {
        return
    }
    registry[INSTALLED] = true

    // Capture phase: before frameworks and the application's own submit listeners see an unsolved form
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('focusin', onFocusIn)
    // A page the back-forward cache restores holds the tokens of the forms it showed
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            reset(document)
        }
    })
}

/**
 * Copies the widget settings CapType renders on the element (`data-silarhi-cap-*`) to the globals the widget reads.
 * The first one wins: they are application-wide, and the nonce of the first page is the one its CSP accepts.
 */
export function configure(element: HTMLElement): void {
    const { silarhiCapWasmUrl, silarhiCapHashwxUrl, silarhiCapNonce } = element.dataset
    window.CAP_CUSTOM_WASM_URL ??= silarhiCapWasmUrl
    window.CAP_CUSTOM_HASHWX_URL ??= silarhiCapHashwxUrl
    window.CAP_CSS_NONCE ??= silarhiCapNonce
    window.CAP_SCRIPT_NONCE ??= silarhiCapNonce
}

/**
 * Solves the challenges of a form (or a single challenge) that have no token yet.
 *
 * Resolves false when one failed: the widget shows why, an invisible challenge stays empty.
 */
export async function solve(target: Element): Promise<boolean> {
    const results = await Promise.all(fieldsOf(target).map(solveField))

    return results.every(Boolean)
}

/**
 * Forgets the tokens of a form, a field or the whole document. The Turbo adapter resets them for you; call it after
 * submitting a form with fetch() yourself and keeping it on the page, as a token is single-use.
 */
export function reset(target: Element | Document): void {
    for (const field of fieldsOf(target)) {
        if (isInvisible(field)) {
            field.value = ''
            invisibleCaps.get(field)?.reset()
        } else if (hasToken(field)) {
            field.reset()
        }
    }
}

function fieldsOf(target: Element | Document): Array<CapWidgetElement | HTMLInputElement> {
    if (target instanceof Element && target.matches(SELECTOR)) {
        return [target as CapWidgetElement | HTMLInputElement]
    }

    return Array.from(target.querySelectorAll<CapWidgetElement | HTMLInputElement>(SELECTOR))
}

function isInvisible(field: Element): field is HTMLInputElement {
    return field instanceof HTMLInputElement
}

function hasToken(field: CapWidgetElement | HTMLInputElement): boolean {
    return isInvisible(field) ? field.value !== '' : Boolean(field.token)
}

function solveField(field: CapWidgetElement | HTMLInputElement): Promise<boolean> {
    if (hasToken(field)) {
        return Promise.resolve(true)
    }

    let pending = solving.get(field)
    if (!pending) {
        pending = (isInvisible(field) ? solveInvisible(field) : solveWidget(field)).finally(() => solving.delete(field))
        solving.set(field, pending)
    }

    return pending
}

async function solveWidget(widget: CapWidgetElement): Promise<boolean> {
    if (!(await widgetDefined())) {
        return false
    }
    if (widget.token) {
        return true
    }

    return new Promise((resolve) => {
        const settle = (solved: boolean) => {
            widget.removeEventListener('solve', onSolve)
            widget.removeEventListener('error', onError)
            resolve(solved)
        }
        const onSolve = () => settle(true)
        const onError = () => settle(false)
        widget.addEventListener('solve', onSolve)
        widget.addEventListener('error', onError)

        // While a solve the visitor started runs, solve() returns at once: its events settle this one
        Promise.resolve(widget.solve()).catch(() => settle(false))
    })
}

async function solveInvisible(input: HTMLInputElement): Promise<boolean> {
    if (!(await widgetDefined())) {
        return false
    }

    let cap = invisibleCaps.get(input)
    if (!cap) {
        cap = createInvisibleCap(window.Cap, input)
    }

    try {
        const result = await cap.solve()
        const token = result?.token ?? cap.token
        if (token) {
            input.value = token

            return true
        }
    } catch {
        // The widget dispatched an "error" event already
    }

    return false
}

function createInvisibleCap(CapClass: typeof Cap, input: HTMLInputElement): Cap {
    // Cap's programmatic mode appends a hidden <cap-widget> to <html>, which outlives the forms a SPA replaces
    for (const [field, cap] of invisibleCaps) {
        if (!field.isConnected) {
            cap.widget.remove()
            invisibleCaps.delete(field)
        }
    }

    const config: CapConfig & Record<string, string> = { apiEndpoint: input.dataset.capApiEndpoint ?? '' }
    for (const attribute of ['data-cap-worker-count', 'data-cap-lang']) {
        const value = input.getAttribute(attribute)
        if (value !== null) {
            config[attribute] = value
        }
    }

    const cap = new CapClass(config)
    // Fired when the token expires, before the form was submitted
    cap.addEventListener('reset', () => {
        input.value = ''
    })
    invisibleCaps.set(input, cap)

    return cap
}

function widgetDefined(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined

    return Promise.race([
        customElements.whenDefined('cap-widget').then(() => true),
        new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), WIDGET_TIMEOUT)
        }),
    ]).finally(() => clearTimeout(timer))
}

function onSubmit(event: Event): void {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) {
        return
    }
    if (bypassedForms.has(form)) {
        return
    }

    const pending = fieldsOf(form).filter((field) => !hasToken(field))
    if (pending.length === 0) {
        return
    }

    event.preventDefault()
    event.stopImmediatePropagation()

    if (busyForms.has(form)) {
        return
    }
    busyForms.add(form)
    form.setAttribute('aria-busy', 'true')
    form.dispatchEvent(new CustomEvent('cap:solving', { bubbles: true }))

    const submitter = (event as SubmitEvent).submitter
    void Promise.all(pending.map(solveField)).then((results) => {
        busyForms.delete(form)
        form.removeAttribute('aria-busy')

        const solved = results.every(Boolean)
        form.dispatchEvent(new CustomEvent(solved ? 'cap:solved' : 'cap:failed', { bubbles: true }))
        if (!form.isConnected) {
            return
        }

        // A failed challenge is submitted all the same: the server answers with its "verify you are human" error
        bypassedForms.add(form)
        try {
            if (submitter?.isConnected && submitter.closest('form') === form) {
                form.requestSubmit(submitter)
            } else {
                form.requestSubmit()
            }
        } finally {
            bypassedForms.delete(form)
        }
    })
}

function onFocusIn(event: FocusEvent): void {
    const form = event.target instanceof Element ? event.target.closest('form') : null
    if (!form) {
        return
    }

    // Solve while the visitor fills the form, so that submitting does not wait. The widget does it on its own.
    for (const field of fieldsOf(form)) {
        if (isInvisible(field) && !hasToken(field)) {
            void solveField(field)
        }
    }
}
