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

use function is_string;

use Override;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\Exception\DecodingExceptionInterface;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final readonly class CapVerifier implements CapVerifierInterface
{
    private HttpClientInterface $httpClient;

    /**
     * @param string $verifyUrl the /siteverify URL of the site key, e.g. https://cap.example.com/<site-key>/siteverify
     */
    public function __construct(
        private string $verifyUrl,
        #[SensitiveParameter]
        private string $secretKey,
        ?HttpClientInterface $httpClient = null,
        private ?LoggerInterface $logger = null,
    ) {
        $this->httpClient = $httpClient ?? HttpClient::create();
    }

    /**
     * @param string      $endpoint  the API endpoint of the site key, e.g. https://cap.example.com/<site-key>/
     * @param string|null $verifyUrl the /siteverify URL, when the server reaches Cap at another address than the browser
     */
    public static function fromEndpoint(
        string $endpoint,
        #[SensitiveParameter]
        string $secretKey,
        ?string $verifyUrl = null,
        ?HttpClientInterface $httpClient = null,
        ?LoggerInterface $logger = null,
    ): self {
        return new self($verifyUrl ?? rtrim($endpoint, '/') . '/siteverify', $secretKey, $httpClient, $logger);
    }

    #[Override]
    public function verify(string $token): VerificationResult
    {
        if ('' === $token) {
            return VerificationResult::failure(VerificationResult::ERROR_MISSING_RESPONSE);
        }

        try {
            $response = $this->httpClient->request('POST', $this->verifyUrl, [
                'json' => ['secret' => $this->secretKey, 'response' => $token],
            ]);

            if ($response->getStatusCode() >= 500) {
                $this->logger?->error('Cap server answered {status} to the token verification.', [
                    'status' => $response->getStatusCode(),
                    'url' => $this->verifyUrl,
                ]);

                return VerificationResult::failure(VerificationResult::ERROR_BAD_RESPONSE);
            }

            // Cap answers 4xx with a JSON body for invalid tokens: read it instead of throwing
            $data = $response->toArray(false);
        } catch (DecodingExceptionInterface $e) {
            $this->logger?->error('Cap server answered an invalid JSON to the token verification.', [
                'exception' => $e,
                'url' => $this->verifyUrl,
            ]);

            return VerificationResult::failure(VerificationResult::ERROR_INVALID_JSON);
        } catch (ExceptionInterface $e) {
            $this->logger?->error('Cap server could not be reached to verify the token.', [
                'exception' => $e,
                'url' => $this->verifyUrl,
            ]);

            return VerificationResult::failure(VerificationResult::ERROR_CONNECTION_FAILED);
        }

        if (true === ($data['success'] ?? null)) {
            return VerificationResult::success();
        }

        $error = $data['error'] ?? null;
        $result = VerificationResult::failure(is_string($error) && '' !== $error ? $error : VerificationResult::ERROR_UNKNOWN);

        $this->logger?->info('Cap token rejected: {error}.', ['error' => $result->error]);

        return $result;
    }
}
