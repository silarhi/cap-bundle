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

## Test tokens

To test the protection itself, give the test environment the tokens it accepts:

```yaml
# config/packages/cap.yaml
when@test:
    cap:
        test_tokens: ['valid-cap-token']
```

Every site key accepts them, as often as they are sent, and rejects any other token like Cap rejects an unknown one
(`Token not found`), without calling the Cap server. The form still renders the widget.

```php
$form = static::getContainer()->get('form.factory')->create(ContactType::class, null, ['csrf_protection' => false]);
$form->submit(['email' => 'jane@example.com', 'captcha' => 'valid-cap-token']);
self::assertTrue($form->isValid());

$form = static::getContainer()->get('form.factory')->create(ContactType::class, null, ['csrf_protection' => false]);
$form->submit(['email' => 'jane@example.com', 'captcha' => 'forged']);
self::assertFalse($form->isValid());
```

In a `WebTestCase`, `$client->submitForm()` fills the hidden input of an invisible challenge. A checkbox or floating
widget creates its input in the browser only: the page has none for `submitForm()` to fill. The bundle refuses
`test_tokens` in the `prod` environment.

`TestCapVerifier` is the verifier behind them: use it in a unit test of a service that takes a
`CapVerifierInterface`, `new TestCapVerifier(['valid-cap-token'])`.

## Mocking the Cap server

To test the answers of the Cap server, keep the bundle enabled in a dedicated environment, and answer for it with the
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
