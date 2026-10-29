/**
 * Copies the Cap widget and its WebAssembly solvers to public/widget/, served from /bundles/silarhicap/widget/ once
 * assets:install ran: the bundle ships the release it is tested against, and the visitor's browser never calls a CDN.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const widget = dirname(require.resolve('cap-widget/package.json'))
const wasm = dirname(require.resolve('@cap.js/wasm/package.json'))
const target = new URL('../../public/widget/', import.meta.url)

// The widget fetches the solvers of one @cap.js/wasm release: Renovate must bump both packages together
const expected = readFileSync(join(widget, 'src/cap.js'), 'utf8').match(/WASM_VERSION = "([^"]+)"/)?.[1]
const installed = JSON.parse(readFileSync(join(wasm, 'package.json'), 'utf8')).version
if (!expected) {
    throw new Error('cap-widget: WASM_VERSION not found in src/cap.js, update scripts/copy-widget.mjs.')
}
if (expected !== installed) {
    throw new Error(`cap-widget expects @cap.js/wasm ${expected}, ${installed} is installed: run "pnpm add -D @cap.js/wasm@${expected}".`)
}

const files = {
    'cap.min.js': join(widget, 'cap.min.js'),
    'cap_wasm_bg.wasm': join(wasm, 'browser/cap_wasm_bg.wasm'),
    'hashwx.wasm': join(wasm, 'browser/hashwx.wasm'),
    // Both packages are Apache-2.0: redistributing them requires a copy of the license
    LICENSE: join(widget, 'LICENSE'),
}

mkdirSync(target, { recursive: true })
for (const [name, source] of Object.entries(files)) {
    // Read and write rather than copy: the published hashwx.wasm is executable
    writeFileSync(new URL(name, target), readFileSync(source))
}
