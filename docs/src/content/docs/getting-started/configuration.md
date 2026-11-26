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
    # Other site keys, by name: endpoint, secret_key and verify_url each. See "Several site keys"
    site_keys: {}
    # false renders no widget and accepts every submission: for the test environment
    enabled: true
    # The tokens every site key accepts without calling the Cap server: for the test environment only
    test_tokens: []
    # Adds a Cap panel to the Symfony profiler
    profiler: false
    # PSR-18 HTTP client service ID calling /siteverify. null: Symfony's psr18.http_client
    http_client: null
    # PSR-17 request and stream factory service IDs. null: the HTTP client (psr18.http_client is both)
    request_factory: null
    stream_factory: null
    # Framework adapters of the JavaScript, opt-in: turbo forgets the tokens Turbo Drive submitted or cached,
    # live sends the token of Live Component forms with their action only
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

## Several site keys

Each site key of Cap has its own difficulty: a light one for a newsletter, a harder one for signing up. `endpoint` and
`secret_key` are the default site key; name the others under `site_keys`:

```yaml
cap:
    endpoint: '%env(CAP_ENDPOINT)%'
    secret_key: '%env(CAP_SECRET_KEY)%'
    site_keys:
        signup:
            endpoint: '%env(CAP_SIGNUP_ENDPOINT)%'
            secret_key: '%env(CAP_SIGNUP_SECRET_KEY)%'
            # verify_url: 'http://cap:3000/%env(CAP_SIGNUP_SITE_KEY)%/siteverify'
```

The [`site_key` option](/guides/form-type/#options) of `CapType` picks one, and verifies the token with its secret:

```php
$builder->add('captcha', CapType::class, ['site_key' => 'signup']);
```

So does the constraint, `#[Cap(siteKey: 'signup')]`, and each site key has its own verifier, autowired by name:

```php
public function __construct(private readonly CapVerifierInterface $signupCapVerifier) {}
```

or `#[Target('signup.cap_verifier')]`. `default` names the site key of `endpoint` and `secret_key`: it cannot be used
under `site_keys`.

## The HTTP client

The token is redeemed with a [PSR-18](https://www.php-fig.org/psr/psr-18/) HTTP client: Symfony's
`psr18.http_client` by default, which FrameworkBundle registers once `symfony/http-client` is installed. It needs a
PSR-17 implementation such as `nyholm/psr7`: `php-http/discovery`, which the bundle requires, installs both when the
application has neither. Set `http_client`, `request_factory` and `stream_factory` to your own service IDs to use
another client. Guzzle, for instance (both classes registered as
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

## Logs

The bundle logs on the `cap` channel. A token the visitor got wrong (`Token not found`, `Token expired`, a malformed
token) is an `info`. Anything else rejects every submission, and is an `error`: a wrong `secret_key`, an endpoint
pointing to another site key, a secret made by an older Cap release, Cap's rate limit, a Cap server out of reach.

## The profiler

```yaml
when@dev:
    cap:
        profiler: true
```

adds a Cap panel to the Symfony profiler: the tokens verified during the request with their site key, the answer of
the Cap server and how long it took, and the site keys of the configuration. The verifications also show up in the
Performance panel, under `cap.verify`. It needs `symfony/web-profiler-bundle`.

## The widget

The bundle serves the widget and its solvers from your domain; `widget.script`, `widget.wasm_url` and
`widget.hashwx_url` point them elsewhere: see [self-hosting the widget](/guides/self-hosting/). `render_scripts` is covered in [JavaScript](/guides/javascript/).
