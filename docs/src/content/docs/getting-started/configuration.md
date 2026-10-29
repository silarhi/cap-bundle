---
title: Configuration
description: Every option of the cap configuration, with its default value.
sidebar:
    order: 2
---

```yaml
# config/packages/cap.yaml
cap:
    # The API endpoint of the site key, as the browser reaches it: https://<your-instance>/<site-key>/
    endpoint: '%env(CAP_ENDPOINT)%'
    # The secret key of the site key (not the ADMIN_KEY of the dashboard)
    secret_key: '%env(CAP_SECRET_KEY)%'
    # The /siteverify URL, as the server reaches it. Defaults to <endpoint>siteverify
    verify_url: null
    # false renders no widget and accepts every submission: for the test environment
    enabled: true
    # PSR-18 HTTP client service ID calling /siteverify. null: Symfony's psr18.http_client
    http_client: null
    # PSR-17 request and stream factory service IDs. null: the HTTP client (psr18.http_client is both)
    request_factory: null
    stream_factory: null
    # Framework adapters of the JavaScript, opt-in: [turbo] forgets the tokens Turbo Drive submitted or cached
    adapters: []
    # Renders the <script> of the bundle with each widget. false with the Stimulus controller or your own install()
    render_scripts: true
    # Asset paths or URLs. By default, the copies the bundle ships
    widget:
        # The cap-widget script. null when you import cap-widget yourself
        script: 'bundles/silarhicap/widget/cap.min.js'
        # The WebAssembly solvers. null for the widget's default, jsDelivr
        wasm_url: 'bundles/silarhicap/widget/cap_wasm_bg.wasm'
        hashwx_url: 'bundles/silarhicap/widget/hashwx.wasm'
```

The trailing slash of `endpoint` is optional.

## The server-side URL

The server redeems tokens at `verify_url`, `<endpoint>siteverify` by default. Set it when your application reaches
Cap through another address than the browser, a Docker network for instance:

```yaml
cap:
    endpoint: 'https://cap.example.com/%env(CAP_SITE_KEY)%/'
    verify_url: 'http://cap:3000/%env(CAP_SITE_KEY)%/siteverify'
```

## The HTTP client

The token is redeemed with a [PSR-18](https://www.php-fig.org/psr/psr-18/) HTTP client: Symfony's
`psr18.http_client` by default, which FrameworkBundle registers on top of `symfony/http-client`. It needs a PSR-17
implementation such as `nyholm/psr7` (or `php-http/discovery` with one). Set `http_client`, `request_factory` and
`stream_factory` to your own service IDs to use another client. Guzzle, for instance (both classes registered as
services):

```yaml
cap:
    http_client: 'GuzzleHttp\Client'
    request_factory: 'GuzzleHttp\Psr7\HttpFactory'
    stream_factory: 'GuzzleHttp\Psr7\HttpFactory'
```

### Timeouts and proxies

Wrap a [scoped client](https://symfony.com/doc/current/http_client.html#scoping-client) in a `Psr18Client`:

```yaml
framework:
    http_client:
        scoped_clients:
            cap.client:
                base_uri: 'https://cap.example.com'
                timeout: 3

services:
    cap.psr18_client:
        class: Symfony\Component\HttpClient\Psr18Client
        arguments: ['@cap.client']

cap:
    http_client: 'cap.psr18_client'
```

A Cap server out of reach, answering a 5xx or something else than JSON rejects the submission (the bundle fails
closed) and logs an error on the `cap` channel.

## The widget

The bundle serves the widget and its solvers from your domain; `widget.script`, `widget.wasm_url` and
`widget.hashwx_url` point them elsewhere: see [self-hosting the widget](/guides/self-hosting/). `render_scripts` is covered in [JavaScript](/guides/javascript/).
