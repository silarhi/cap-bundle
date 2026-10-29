---
title: Self-hosting the widget
description: Serve the Cap widget script and its WebAssembly solver from your own domain instead of jsDelivr.
sidebar:
    order: 5
---

By default the widget script comes from jsDelivr (a pinned `cap-widget` release), and the widget downloads its
WebAssembly solver from jsDelivr when it solves. Your Cap server can serve both: start it with
`ENABLE_ASSETS_SERVER=true` (see Cap's [asset server](https://trycap.dev/guide/standalone/options#asset-server)).

```yaml
# config/packages/silarhi_cap.yaml
silarhi_cap:
    endpoint: 'https://cap.example.com/%env(CAP_SITE_KEY)%/'
    secret_key: '%env(CAP_SECRET_KEY)%'
    widget:
        script: 'https://cap.example.com/assets/widget.js'
        wasm_url: 'https://cap.example.com/assets/cap_wasm_bg.wasm'
        hashwx_url: 'https://cap.example.com/assets/hashwx.wasm'
```

The URLs can point anywhere: copy the files of the `cap-widget` and `@cap.js/wasm` packages to your `public/` folder
if you prefer.

`wasm_url` and `hashwx_url` become `data-silarhi-cap-wasm-url` and `data-silarhi-cap-hashwx-url` attributes, which the
script of the bundle (or the Stimulus controller) copies to `window.CAP_CUSTOM_WASM_URL` and
`window.CAP_CUSTOM_HASHWX_URL` before the widget solves anything.

## With a bundler

With the [Stimulus controller](/guides/javascript/#with-stimulus) or your own bundle, `cap-widget` comes from your
`node_modules` (or your importmap) and `widget.script` is not used: only `wasm_url` and `hashwx_url` matter.
