---
title: JavaScript
description: Load the Cap widget and the submit handling without a build step, with Stimulus, or with your bundler.
sidebar:
    order: 2
---

The bundle ships a small script that solves unsolved challenges before a form is submitted, solves invisible ones as
soon as a form is focused, and forgets spent tokens. Pick how it reaches the page.

## Without a build step (default)

Nothing to do. Each `CapType` renders:

```html
<script type="module" src="/bundles/silarhicap/cap.js"></script>
```

which loads the Cap widget the bundle ships (see [self-hosting the widget](/guides/self-hosting/)).
A module runs once per page, however many forms render it: two forms on a page, or ten Turbo visits, load it once.

It works with Webpack Encore, AssetMapper, or no front-end tooling at all, as long as `assets:install` copied
`public/bundles/silarhicap/` (Flex does it after `composer install`).

## With Stimulus

StimulusBundle (Webpack Encore or AssetMapper) or Symfony Reprise (Vite or Rsbuild) registers the
`silarhi--cap-bundle--cap` controller that every `CapType` carries. It is lazy: the controller, and the widget it
loads from `public/bundles/silarhicap/widget/`, only load on pages with a protected form. There is no `cap-widget`
package to install.

Turn off the script of the bundle:

```yaml
# config/packages/cap.yaml
cap:
    render_scripts: false
```

### AssetMapper

`assets/controllers.json` gets the controller when Flex installs the bundle; otherwise add it:

```json
{
    "controllers": {
        "@silarhi/cap-bundle": {
            "cap": { "enabled": true, "fetch": "lazy" }
        }
    }
}
```

### Webpack Encore

Flex adds `"@silarhi/cap-bundle": "file:vendor/silarhi/cap-bundle/assets"` to your `package.json` and the controller
to `assets/controllers.json`; install them:

```bash
pnpm install
```

### Symfony Reprise (Vite, Rsbuild)

[Symfony Reprise](https://github.com/symfony/reprise) reads the same `controllers.json`. Flex adds
`"@silarhi/cap-bundle": "file:vendor/silarhi/cap-bundle/assets"` to your `package.json` and the controller to
`assets/controllers.json`; install them with Stimulus:

```bash
pnpm add -D @hotwired/stimulus
pnpm install
```

Point the plugin to `controllers.json`, and start Stimulus from your entry point:

```js
// vite.config.js
import Symfony from '@symfony/reprise/vite'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [Symfony({ stimulus: 'assets/controllers.json' })],
    build: {
        rollupOptions: {
            input: { app: './assets/app.js' },
        },
    },
})
```

```js
// assets/app.js
import { startStimulusApp } from '@symfony/reprise/stimulus'

startStimulusApp()
```

Vite builds the controller into its own chunk, loaded the first time a page shows a protected form, in production
builds as with the dev server. The widget is not bundled: the controller loads it from your web root. To put your Content-Security-Policy nonce on the tags Reprise
renders, use its `RenderAssetTagEvent`; the `csp_nonce` option of `CapType` still covers the styles of the widget
(see [Content Security Policy](/guides/content-security-policy/)).

The controller has two actions: `solve` (solve now) and `reset` (forget the token), e.g.
`data-action="click->silarhi--cap-bundle--cap#solve"`.

## With a listener library

Your application runs code for each element that shows up, with something else than Stimulus? Call `connect()` for
each challenge: like the Stimulus controller, it installs the submit handling and the adapters of `cap.adapters`, and
loads the widget the bundle ships, from your web root. It is idempotent, and the package comes from
`vendor/silarhi/cap-bundle/assets`, which Flex adds to your `package.json`.

```yaml
# config/packages/cap.yaml
cap:
    render_scripts: false
```

With [`@silarhi/app-js`](https://www.npmjs.com/package/@silarhi/app-js), lazily, so that only the pages of a form
download it:

```js
// assets/listeners/cap.js
import { defineListener } from '@silarhi/app-js'
import { connect, SELECTOR } from '@silarhi/cap-bundle'

export default defineListener({ selector: SELECTOR, connect })
```

```js
// assets/app.js
import { App, lazyListener } from '@silarhi/app-js'

const app = new App({
    listeners: [lazyListener('[data-silarhi-cap]', () => import('./listeners/cap'))],
})
```

With htmx:

```js
import { connect, SELECTOR } from '@silarhi/cap-bundle'

htmx.onLoad((content) => content.querySelectorAll(SELECTOR).forEach(connect))
```

## With your own bundle

Without Stimulus, import the widget and install the submit handling from your entry point:

```bash
pnpm add -D cap-widget
```

```js
import 'cap-widget'
import { install } from '@silarhi/cap-bundle'

install()
```

with `render_scripts: false`, and the widget settings of [importing cap-widget yourself](/guides/self-hosting/#importing-cap-widget-yourself). `install()` is idempotent. Add the adapters your
application needs, for instance [Turbo's](/guides/turbo/#the-turbo-adapter):

```js
import { installTurbo } from '@silarhi/cap-bundle/turbo'

installTurbo()
```

## API

```js
import { configure, connect, install, loadWidget, reset, solve } from '@silarhi/cap-bundle'
```

| Function              | Description                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `connect(element)`    | Everything a challenge needs: `install()`, the adapters it lists, `configure()`, `loadWidget()`    |
| `install()`           | Listens to the document for protected forms. Call it once; later calls do nothing                  |
| `solve(element)`      | Solves the challenges of a form (or one challenge) that have no token. Resolves `false` on failure |
| `reset(element)`      | Forgets the tokens of a form, a challenge or the `document`                                        |
| `configure(element)`  | Copies the widget settings of a challenge (solver URLs, nonce) to the globals the widget reads     |
| `loadWidget(element)` | Loads the widget script of a challenge, unless `<cap-widget>` is defined. Call `configure()` first |
| `installTurbo()`      | From `@silarhi/cap-bundle/turbo`: forgets the tokens Turbo submitted or cached                     |
| `installLive()`       | From `@silarhi/cap-bundle/live`: sends the token of Live Component forms with their action only    |
| `tokenOf(element)`    | The token of a challenge, `''` when it has none                                                    |

## Events

Dispatched on the form, bubbling, when the bundle solves challenges before submitting it:

| Event         | When                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `cap:solving` | The visitor submitted, challenges are being solved: the form is `aria-busy`   |
| `cap:solved`  | Solved: the form is submitted again, with the same submit button              |
| `cap:failed`  | A challenge failed: the form is submitted all the same, the server rejects it |

```js
document.addEventListener('cap:solving', (event) => {
    event.target.querySelector('[type=submit]')?.classList.add('btn-loading')
})
```

Cap's own events (`solve`, `progress`, `error`, `reset`) are dispatched on the `<cap-widget>`.
