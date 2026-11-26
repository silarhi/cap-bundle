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

/** The wrapper that hides a floating widget until a submit shows it. */
const FLOATING_SELECTOR = '[data-silarhi-cap-floating]'

/** How long a solved floating widget shows its checkmark before the form is submitted. */
const FLOATING_HIDE_DELAY = 500

export type CapWidgetElement = CapWidget

/** A challenge CapType renders: a `<cap-widget>`, or the hidden input of an invisible one. */
export type CapField = CapWidgetElement | HTMLInputElement

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
 * Loads the widget script CapType points to (`data-silarhi-cap-script`: by default the copy the bundle ships), unless
 * `<cap-widget>` is defined already because the application imported cap-widget itself. Call configure() first: the
 * widget reads its globals as it loads.
 */
export function loadWidget(element: HTMLElement): void {
    const script = element.dataset.silarhiCapScript
    if (!script || customElements.get('cap-widget')) {
        return
    }

    // A URL rather than a package: bundlers leave it alone, and the browser imports it once whoever asks. Resolved
    // against the page: under a dev server, a path would resolve against the origin of the module that imports it.
    const url = new URL(script, document.baseURI).href
    import(/* webpackIgnore: true */ /* @vite-ignore */ url).catch((error: unknown) => {
        console.error('Cap: the widget script could not be loaded.', error)
    })
}

/**
 * Solves the challenges of a form (or a single challenge) that have no token yet.
 *
 * Resolves false when one failed: the widget shows why, an invisible challenge stays empty.
 */
export async function solve(target: Element): Promise<boolean> {
    const results = await Promise.all(fieldsOf(target).map((field) => solveField(field)))

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
        if (isFloating(field)) {
            hideFloating(field)
        }
    }
}

/**
 * The token of a challenge, an empty string when it has none: for adapters that send it themselves.
 */
export function tokenOf(field: Element): string {
    if (field instanceof HTMLInputElement) {
        return field.value
    }

    return (field as Partial<CapWidgetElement>).token ?? ''
}

function fieldsOf(target: Element | Document): CapField[] {
    if (target instanceof Element && target.matches(SELECTOR)) {
        return [target as CapField]
    }

    return Array.from(target.querySelectorAll<CapField>(SELECTOR))
}

function isInvisible(field: Element): field is HTMLInputElement {
    return field instanceof HTMLInputElement
}

function isFloating(field: CapField): field is CapWidgetElement {
    return !isInvisible(field) && field.dataset.silarhiCap === 'floating'
}

function hasToken(field: CapField): boolean {
    return isInvisible(field) ? field.value !== '' : Boolean(field.token)
}

/**
 * @param anchor the button a floating widget shows up next to: the submitter, or the first submit button of the form
 */
function solveField(field: CapField, anchor: Element | null = null): Promise<boolean> {
    if (hasToken(field)) {
        return Promise.resolve(true)
    }

    let pending = solving.get(field)
    if (!pending) {
        const solved = isInvisible(field)
            ? solveInvisible(field)
            : isFloating(field)
              ? solveFloating(field, anchor)
              : solveWidget(field)
        pending = solved.finally(() => solving.delete(field))
        solving.set(field, pending)
    }

    return pending
}

async function solveFloating(widget: CapWidgetElement, anchor: Element | null): Promise<boolean> {
    showFloating(widget, anchor ?? widget.closest('form')?.querySelector('[type="submit"]') ?? null)

    const solved = await solveWidget(widget)
    // A solved widget shows its checkmark, then makes way. A failed one stays, with its error.
    if (solved) {
        await new Promise((resolve) => setTimeout(resolve, FLOATING_HIDE_DELAY))
        hideFloating(widget)
    }

    return solved
}

function showFloating(widget: CapWidgetElement, anchor: Element | null): void {
    const wrapper = widget.closest<HTMLElement>(FLOATING_SELECTOR)
    if (!wrapper) {
        return
    }

    wrapper.hidden = false
    if (!anchor) {
        return
    }

    // Set through the CSSOM, not a style attribute: a strict Content-Security-Policy allows it
    wrapper.style.position = 'absolute'
    wrapper.style.zIndex = '99999'

    // `position: absolute` places the wrapper in its containing block, getBoundingClientRect() in the viewport
    const parent = wrapper.offsetParent
    const container =
        parent && (parent !== document.body || getComputedStyle(parent).position !== 'static')
            ? parent
            : document.documentElement
    const containerRect = container.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    const offset = Number.parseInt(widget.dataset.silarhiCapOffset ?? '', 10) || 8

    const left = Math.max(
        2,
        Math.min(
            anchorRect.left + (anchorRect.width - wrapper.offsetWidth) / 2,
            window.innerWidth - wrapper.offsetWidth
        )
    )
    const top =
        widget.dataset.silarhiCapPosition === 'bottom'
            ? Math.min(anchorRect.bottom + offset, window.innerHeight - wrapper.offsetHeight)
            : Math.max(0, anchorRect.top - wrapper.offsetHeight - offset)
    wrapper.style.left = `${left - containerRect.left}px`
    wrapper.style.top = `${top - containerRect.top}px`
}

function hideFloating(widget: CapWidgetElement): void {
    const wrapper = widget.closest<HTMLElement>(FLOATING_SELECTOR)
    if (wrapper) {
        wrapper.hidden = true
    }
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
    void Promise.all(pending.map((field) => solveField(field, submitter))).then((results) => {
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
