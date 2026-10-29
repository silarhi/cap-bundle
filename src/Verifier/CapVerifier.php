<?php

declare(strict_types=1);

/*
 * This file is part of the Cap Bundle package.
 *
 * (c) SILARHI <dev@silarhi.fr>
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 */

namespace Silarhi\CapBundle\Verifier;

use function is_array;
use function is_string;
use function json_decode;
use function json_encode;

use JsonException;
use Override;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;
use Psr\Log\LoggerInterface;
use SensitiveParameter;

/**
 * Redeems tokens with any PSR-18 HTTP client: Symfony's psr18.http_client by default, Guzzle, Buzz...
 */
final readonly class CapVerifier implements CapVerifierInterface
{
    /**
     * @param string $verifyUrl the /siteverify URL of the site key, e.g. https://cap.example.com/<site-key>/siteverify
     */
    public function __construct(
        private string $verifyUrl,
        #[SensitiveParameter]
        private string $secretKey,
        private ClientInterface $httpClient,
        private RequestFactoryInterface $requestFactory,
        private StreamFactoryInterface $streamFactory,
        private ?LoggerInterface $logger = null,
    ) {
    }

    /**
     * @param string      $endpoint  the API endpoint of the site key, e.g. https://cap.example.com/<site-key>/
     * @param string|null $verifyUrl the /siteverify URL, when the server reaches Cap at another address than the browser
     */
    public static function fromEndpoint(
        string $endpoint,
        #[SensitiveParameter]
        string $secretKey,
        ?string $verifyUrl,
        ClientInterface $httpClient,
        RequestFactoryInterface $requestFactory,
        StreamFactoryInterface $streamFactory,
        ?LoggerInterface $logger = null,
    ): self {
        return new self(
            $verifyUrl ?? rtrim($endpoint, '/') . '/siteverify',
            $secretKey,
            $httpClient,
            $requestFactory,
            $streamFactory,
            $logger,
        );
    }

    #[Override]
    public function verify(string $token): VerificationResult
    {
        if ('' === $token) {
            return VerificationResult::failure(VerificationResult::ERROR_MISSING_RESPONSE);
        }

        $request = $this->requestFactory->createRequest('POST', $this->verifyUrl)
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Accept', 'application/json')
            ->withBody($this->streamFactory->createStream(json_encode(
                ['secret' => $this->secretKey, 'response' => $token],
                \JSON_THROW_ON_ERROR,
            )));

        try {
            $response = $this->httpClient->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            $this->logger?->error('Cap server could not be reached to verify the token.', [
                'exception' => $e,
                'url' => $this->verifyUrl,
            ]);

            return VerificationResult::failure(VerificationResult::ERROR_CONNECTION_FAILED);
        }

        if ($response->getStatusCode() >= 500) {
            $this->logger?->error('Cap server answered {status} to the token verification.', [
                'status' => $response->getStatusCode(),
                'url' => $this->verifyUrl,
            ]);

            return VerificationResult::failure(VerificationResult::ERROR_BAD_RESPONSE);
        }

        // Cap answers 4xx with a JSON body for invalid tokens: PSR-18 clients return them as they are
        try {
            $data = json_decode((string) $response->getBody(), true, 512, \JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            return $this->invalidJson($response->getStatusCode(), $e);
        }

        if (!is_array($data)) {
            return $this->invalidJson($response->getStatusCode());
        }

        if (true === ($data['success'] ?? null)) {
            return VerificationResult::success();
        }

        $error = $data['error'] ?? null;
        $result = VerificationResult::failure(is_string($error) && '' !== $error ? $error : VerificationResult::ERROR_UNKNOWN);

        $this->logger?->info('Cap token rejected: {error}.', ['error' => $result->error]);

        return $result;
    }

    private function invalidJson(int $status, ?JsonException $exception = null): VerificationResult
    {
        $this->logger?->error('Cap server answered an invalid JSON to the token verification.', [
            'exception' => $exception,
            'status' => $status,
            'url' => $this->verifyUrl,
        ]);

        return VerificationResult::failure(VerificationResult::ERROR_INVALID_JSON);
    }
}
