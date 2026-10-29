---
title: Testing
description: Test forms protected by Cap without a Cap server.
sidebar:
    order: 8
---

## Functional tests

Disable the bundle in the test environment:

```yaml
# config/packages/silarhi_cap.yaml
when@test:
    silarhi_cap:
        enabled: false
```

`CapType` renders nothing and the `Cap` constraint accepts every value, so `$client->submitForm()` works without a
token, and no request reaches a Cap server.

## Testing the protection itself

Keep the bundle enabled in a dedicated environment and replace its HTTP client with a `MockHttpClient`:

```yaml
# config/packages/silarhi_cap.yaml
when@test_cap:
    silarhi_cap:
        http_client: 'test.cap_client'
    services:
        test.cap_client:
            class: Symfony\Component\HttpClient\MockHttpClient
            public: true
```

```php
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\JsonMockResponse;

static::getContainer()->get('test.cap_client')
    ->setResponseFactory(new JsonMockResponse(['success' => false, 'error' => 'Token expired'], ['http_code' => 403]));
```

Or mock `CapVerifierInterface` in a unit test of your own service.
