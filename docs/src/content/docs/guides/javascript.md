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

which loads the `cap-widget` script of [`widget.script`](/getting-started/configuration/) (jsDelivr by default).
A module runs once per page, however many forms render it: two forms on a page, or ten Turbo visits, load it once.

It works with Webpack Encore, AssetMapper, or no front-end tooling at all, as long as `assets:install` copied
`public/bundles/silarhicap/cap.js` (Flex does it after `composer install`).

## With Stimulus

StimulusBundle (Webpack Encore or AssetMapper) or Symfony Reprise (Vite or Rsbuild) registers the
`silarhi--cap-bundle--cap` controller that every `CapType` carries. It is lazy: the controller, and the `cap-widget` package it imports, only load on pages with a
protected form.

Turn off the script of the bundle:

```yaml
# config/packages/cap.yaml
cap:
    render_scripts: false
```

### AssetMapper

```bash
php bin/console importmap:require cap-widget
```

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
to `assets/controllers.json`; install them with `cap-widget`:

```bash
pnpm add -D cap-widget
pnpm install
```

### Symfony Reprise (Vite, Rsbuild)

[Symfony Reprise](https://github.com/symfony/reprise) reads the same `controllers.json`. Flex adds
`"@silarhi/cap-bundle": "file:vendor/silarhi/cap-bundle/assets"` to your `package.json` and the controller to
`assets/controllers.json`; install them with `cap-widget`:

```bash
pnpm add -D cap-widget @hotwired/stimulus
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

Vite builds the controller and `cap-widget` into their own chunks, loaded the first time a page shows a protected
form, in production builds as with the dev server. To put your Content-Security-Policy nonce on the tags Reprise
renders, use its `RenderAssetTagEvent`; the `csp_nonce` option of `CapType` still covers the styles of the widget
(see [Content Security Policy](/guides/content-security-policy/)).

The controller has two actions: `solve` (solve now) and `reset` (forget the token), e.g.
`data-action="click->silarhi--cap-bundle--cap#solve"`.

## With your own bundle

Without Stimulus, install the submit handling from your entry point:

```js
import 'cap-widget'
import { install } from '@silarhi/cap-bundle'

install()
```

with `render_scripts: false` and the package installed as above. `install()` is idempotent. Add the adapters your
application needs, for instance [Turbo's](/guides/turbo/#the-turbo-adapter):

```js
import { installTurbo } from '@silarhi/cap-bundle/turbo'

installTurbo()
```

## API

```js
import { configure, install, reset, solve } from '@silarhi/cap-bundle'
```

| Function             | Description                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `install()`          | Listens to the document for protected forms. Call it once; later calls do nothing                  |
| `solve(element)`     | Solves the challenges of a form (or one challenge) that have no token. Resolves `false` on failure |
| `reset(element)`     | Forgets the tokens of a form, a challenge or the `document`                                        |
| `configure(element)` | Copies the `data-silarhi-cap-*` settings of a challenge to the globals Cap reads                   |
| `installTurbo()`     | From `@silarhi/cap-bundle/turbo`: forgets the tokens Turbo submitted or cached                     |

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
