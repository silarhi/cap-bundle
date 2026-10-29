---
title: JSON endpoints and DTOs
description: Protect an API endpoint, a DTO or any object with the Cap constraint or the CapVerifierInterface service.
sidebar:
    order: 7
---

## The constraint

`#[Cap]` validates any property holding a token:

```php
use Silarhi\CapBundle\Validator\Cap;

final class ContactRequest
{
    public string $email;

    #[Cap]
    public ?string $capToken = null;
}
```

```php
#[Route('/api/contact', methods: ['POST'])]
public function contact(#[MapRequestPayload] ContactRequest $request): JsonResponse
```

On the client, solve the challenge with Cap's [programmatic mode](https://trycap.dev/guide/programmatic) and send the
token with the payload:

```js
const cap = new Cap({ apiEndpoint: 'https://cap.example.com/<site-key>/' })
const { token } = await cap.solve()

await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, capToken: token }),
})
```

## The verifier

`CapVerifierInterface` redeems a token directly:

```php
use Silarhi\CapBundle\Verifier\CapVerifierInterface;

public function __construct(private readonly CapVerifierInterface $capVerifier) {}

public function __invoke(Request $request): Response
{
    $result = $this->capVerifier->verify($request->getPayload()->getString('cap-token'));

    if (!$result->isSuccess()) {
        throw new AccessDeniedHttpException(sprintf('Cap: %s', $result->error));
    }
    // ...
}
```

`verify()` never throws: a Cap server out of reach is a failed verification with the `connection-failed` error.
It sends the request with the [PSR-18 client](/getting-started/configuration/#the-http-client) of the
configuration.
Unlike the constraint, it ignores `enabled: false`.

| `VerificationResult::$error` | Meaning                                           |
| ---------------------------- | ------------------------------------------------- |
| `null`                       | Success                                           |
| `Token not found`            | Unknown or already redeemed token (Cap's message) |
| `Token expired`              | Solved too long ago (Cap's message)               |
| `Invalid site key or secret` | Check `secret_key` and the site key of `endpoint` |
| `missing-input-response`     | Empty token: no request sent                      |
| `connection-failed`          | DNS, connection or timeout error                  |
| `bad-response`               | Cap answered a 5xx                                |
| `invalid-json`               | Cap answered something else than JSON             |
| `unknown-error`              | Cap said no without a reason                      |
