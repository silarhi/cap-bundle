type SolveResult = { success: boolean; token: string } | undefined

/** Stands in for Cap's <cap-widget>: solve() succeeds with "token-<n>" unless `fail` is set. */
export class FakeWidget extends HTMLElement {
    static fail = false
    static solves = 0
    token: string | null = null

    async solve(): Promise<SolveResult> {
        const solve = ++FakeWidget.solves
        await Promise.resolve()
        if (FakeWidget.fail) {
            this.dispatchEvent(new CustomEvent('error', { detail: { message: 'failed' } }))
            return undefined
        }
        this.token = `token-${solve}`
        this.dispatchEvent(new CustomEvent('solve', { detail: { token: this.token } }))
        return { success: true, token: this.token }
    }

    reset(): void {
        this.token = null
        this.dispatchEvent(new CustomEvent('reset'))
    }
}

/** Stands in for Cap's programmatic mode, backed by a FakeWidget like the real one. */
export class FakeCap {
    static configs: Array<Record<string, string>> = []
    readonly widget: FakeWidget

    constructor(config: Record<string, string>) {
        FakeCap.configs.push(config)
        this.widget = document.createElement('cap-widget') as FakeWidget
        document.documentElement.appendChild(this.widget)
    }

    get token(): string | null {
        return this.widget.token
    }

    solve(): Promise<SolveResult> {
        return this.widget.solve()
    }

    reset(): void {
        this.widget.reset()
    }

    addEventListener(type: string, listener: EventListener): void {
        this.widget.addEventListener(type, listener)
    }
}

/** Resolves once the form reaches its own submit listeners, i.e. once Cap let it through. */
export function submitted(form: HTMLFormElement): Promise<SubmitEvent> {
    return new Promise((resolve) => {
        form.addEventListener(
            'submit',
            (event) => {
                event.preventDefault()
                resolve(event)
            },
            { once: true }
        )
    })
}

export function render(html: string): HTMLFormElement {
    document.body.innerHTML = html
    return document.querySelector('form') as HTMLFormElement
}

/** Defines the fake <cap-widget> and window.Cap, once per test file. */
export function defineFakes(): void {
    customElements.define('cap-widget', FakeWidget)
    ;(window as unknown as { Cap: typeof FakeCap }).Cap = FakeCap
}

export function resetFakes(): void {
    FakeWidget.fail = false
    FakeWidget.solves = 0
    FakeCap.configs = []
    document.body.innerHTML = ''
    for (const widget of document.documentElement.querySelectorAll(':scope > cap-widget')) {
        widget.remove()
    }
}
