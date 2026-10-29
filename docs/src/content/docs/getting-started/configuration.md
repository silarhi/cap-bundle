---
title: Configuration
description: Every option of the silarhi_cap configuration, with its default value.
sidebar:
    order: 2
---

```yaml
# config/packages/silarhi_cap.yaml
silarhi_cap:
    # The API endpoint of the site key, as the browser reaches it: https://<your-instance>/<site-key>/
    endpoint: '%env(CAP_ENDPOINT)%'
    # The secret key of the site key (not the ADMIN_KEY of the dashboard)
    secret_key: '%env(CAP_SECRET_KEY)%'
    # The /siteverify URL, as the server reaches it. Defaults to <endpoint>siteverify
    verify_url: null
    # false renders no widget and accepts every submission: for the test environment
    enabled: true
    # The HTTP client service calling /siteverify: a scoped client to set a timeout or a proxy
    http_client: 'http_client'
    # Renders the <script> of the bundle with each widget. false with the Stimulus controller or your own install()
    render_scripts: true
    widget:
        # The cap-widget script the bundle's script loads. null when you import cap-widget yourself
        script: 'https://cdn.jsdelivr.net/npm/cap-widget@0.1.58'
        # cap_wasm_bg.wasm and hashwx.wasm, to serve the solver from your domain
        wasm_url: null
        hashwx_url: null
```

The trailing slash of `endpoint` is optional.

## The server-side URL

The server redeems tokens at `verify_url`, `<endpoint>siteverify` by default. Set it when your application reaches
Cap through another address than the browser, a Docker network for instance:

```yaml
silarhi_cap:
    endpoint: 'https://cap.example.com/%env(CAP_SITE_KEY)%/'
    verify_url: 'http://cap:3000/%env(CAP_SITE_KEY)%/siteverify'
```

## Timeouts and proxies

Requests to `/siteverify` go through the `http_client` service. Point `http_client` to a
[scoped client](https://symfony.com/doc/current/http_client.html#scoping-client) to tune them:

```yaml
framework:
    http_client:
        scoped_clients:
            cap.client:
                base_uri: 'https://cap.example.com'
                timeout: 3

silarhi_cap:
    http_client: 'cap.client'
```

A Cap server out of reach, answering a 5xx or something else than JSON rejects the submission (the bundle fails
closed) and logs an error on the `cap` channel.

## The widget

`widget.script`, `widget.wasm_url` and `widget.hashwx_url` serve Cap from your own domain instead of jsDelivr: see
[self-hosting the widget](/guides/self-hosting/). `render_scripts` is covered in [JavaScript](/guides/javascript/).
