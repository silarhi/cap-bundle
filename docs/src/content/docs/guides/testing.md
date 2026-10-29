---
title: Testing
description: Test forms protected by Cap without a Cap server.
sidebar:
    order: 8
---

## Functional tests

Disable the bundle in the test environment:

```yaml
# config/packages/cap.yaml
when@test:
    cap:
        enabled: false
```

`CapType` renders nothing and the `Cap` constraint accepts every value, so `$client->submitForm()` works without a
token, and no request reaches a Cap server.

## Testing the protection itself

Keep the bundle enabled in a dedicated environment, and answer for the Cap server with the
[`mock_response_factory`](https://symfony.com/doc/current/http_client.html#testing) of Symfony's HTTP client, which
`psr18.http_client` wraps:

```yaml
# config/packages/cap.yaml
when@test_cap:
    framework:
        http_client:
            mock_response_factory: App\Tests\CapServerMock
    services:
        App\Tests\CapServerMock:
            public: true
```

```php
namespace App\Tests;

use Symfony\Component\HttpClient\Response\JsonMockResponse;

final class CapServerMock
{
    public array $answer = ['success' => true];

    public function __invoke(string $method, string $url, array $options): JsonMockResponse
    {
        return new JsonMockResponse($this->answer, ['http_code' => $this->answer['success'] ? 200 : 403]);
    }
}
```

```php
static::getContainer()->get(CapServerMock::class)->answer = ['success' => false, 'error' => 'Token expired'];
```

Or mock `CapVerifierInterface` in a unit test of your own service.
