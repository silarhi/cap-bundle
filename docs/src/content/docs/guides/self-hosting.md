---
title: Self-hosting the widget
description: The bundle serves the Cap widget and its WebAssembly solvers from your domain. Point them elsewhere if you like.
sidebar:
    order: 5
---

The bundle ships the `cap-widget` release it is tested against, and the WebAssembly solvers of `@cap.js/wasm` that
release fetches. `assets:install` copies them to `public/bundles/silarhicap/widget/`, and the widget loads them from
there: by default, the browser of your visitors only talks to your application and your Cap server.

| File               | Setting             | Default                                      |
| ------------------ | ------------------- | -------------------------------------------- |
| `cap.min.js`       | `widget.script`     | `bundles/silarhicap/widget/cap.min.js`       |
| `cap_wasm_bg.wasm` | `widget.wasm_url`   | `bundles/silarhicap/widget/cap_wasm_bg.wasm` |
| `hashwx.wasm`      | `widget.hashwx_url` | `bundles/silarhicap/widget/hashwx.wasm`      |

Each setting is an asset path, versioned and prefixed by the Asset component like `asset()` does (a CDN in
`framework.assets.base_urls` included), or a URL.

## Updates

Renovate bumps `cap-widget` and `@cap.js/wasm` in the bundle; a release of the bundle ships them once the end-to-end
tests passed against a real Cap server. Update the bundle to update the widget.

## Another source

Your Cap server can serve the widget too: start it with `ENABLE_ASSETS_SERVER=true` (see Cap's
[asset server](https://trycap.dev/guide/standalone/options#asset-server)).

```yaml
# config/packages/cap.yaml
cap:
    widget:
        script: 'https://cap.example.com/assets/widget.js'
        wasm_url: 'https://cap.example.com/assets/cap_wasm_bg.wasm'
        hashwx_url: 'https://cap.example.com/assets/hashwx.wasm'
```

A widget release fetches the solvers of one `@cap.js/wasm` release: when `script` points elsewhere, point `wasm_url`
and `hashwx_url` to the same source, or set them to `null` for the widget's default, jsDelivr.

`wasm_url` and `hashwx_url` become `data-silarhi-cap-wasm-url` and `data-silarhi-cap-hashwx-url` attributes, which the
script of the bundle (or the Stimulus controller) copies to `window.CAP_CUSTOM_WASM_URL` and
`window.CAP_CUSTOM_HASHWX_URL` before the widget solves anything.

## Importing cap-widget yourself

Set `widget.script` to `null` when your own bundle imports `cap-widget`: the bundle then loads nothing. Set
`wasm_url` and `hashwx_url` to `null` too, unless you serve the solvers of the `@cap.js/wasm` release your
`cap-widget` expects.
