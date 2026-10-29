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

namespace Silarhi\CapBundle\Tests\Verifier;

use Closure;
use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Silarhi\CapBundle\Verifier\CapVerifier;
use Silarhi\CapBundle\Verifier\VerificationResult;
use Symfony\Component\ErrorHandler\BufferingLogger;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Psr18Client;
use Symfony\Component\HttpClient\Response\JsonMockResponse;
use Symfony\Component\HttpClient\Response\MockResponse;

final class CapVerifierTest extends TestCase
{
    public function testPostsTheSecretAndTheTokenAsJson(): void
    {
        $response = new JsonMockResponse(['success' => true]);

        $result = $this->verifier($response)->verify('key:abc:def');

        self::assertTrue($result->isSuccess());
        self::assertNull($result->error);
        self::assertSame('POST', $response->getRequestMethod());
        self::assertSame('https://cap.example.com/key/siteverify', $response->getRequestUrl());
        self::assertSame('{"secret":"secret","response":"key:abc:def"}', $response->getRequestOptions()['body']);
        $headers = $response->getRequestOptions()['headers'] ?? null;
        self::assertIsArray($headers);
        self::assertContains('Content-Type: application/json', $headers);
    }

    public function testBuildsTheVerifyUrlFromTheEndpoint(): void
    {
        $factory = new Psr17Factory();

        foreach (['https://cap.example.com/key', 'https://cap.example.com/key/'] as $endpoint) {
            $response = new JsonMockResponse(['success' => true]);
            $client = new Psr18Client(new MockHttpClient($response), $factory, $factory);
            CapVerifier::fromEndpoint($endpoint, 'secret', null, $client, $factory, $factory)->verify('key:abc:def');

            self::assertSame('https://cap.example.com/key/siteverify', $response->getRequestUrl());
        }
    }

    public function testAnEmptyTokenIsNotSent(): void
    {
        $result = $this->verifier(static fn () => self::fail('No request expected'))->verify('');

        self::assertFalse($result->success);
        self::assertSame(VerificationResult::ERROR_MISSING_RESPONSE, $result->error);
    }

    /**
     * @return iterable<string, array{MockResponse, string}>
     */
    public static function provideFailures(): iterable
    {
        yield 'token not found' => [new JsonMockResponse(['success' => false, 'error' => 'Token not found'], ['http_code' => 404]), 'Token not found'];
        yield 'token expired' => [new JsonMockResponse(['success' => false, 'error' => 'Token expired'], ['http_code' => 403]), 'Token expired'];
        yield 'no error' => [new JsonMockResponse(['success' => false]), VerificationResult::ERROR_UNKNOWN];
        yield 'success is not true' => [new JsonMockResponse(['success' => 'yes']), VerificationResult::ERROR_UNKNOWN];
        yield 'server error' => [new MockResponse('Bad gateway', ['http_code' => 502]), VerificationResult::ERROR_BAD_RESPONSE];
        yield 'not JSON' => [new MockResponse('<html>'), VerificationResult::ERROR_INVALID_JSON];
        yield 'JSON but not an object' => [new MockResponse('"ok"'), VerificationResult::ERROR_INVALID_JSON];
        yield 'unreachable' => [new MockResponse('', ['error' => 'Could not resolve host']), VerificationResult::ERROR_CONNECTION_FAILED];
    }

    #[DataProvider('provideFailures')]
    public function testFailures(MockResponse $response, string $error): void
    {
        $result = $this->verifier($response)->verify('key:abc:def');

        self::assertFalse($result->isSuccess());
        self::assertSame($error, $result->error);
    }

    public function testLogsWhyTheServerCouldNotBeReached(): void
    {
        $logger = new BufferingLogger();

        $this->verifier(static fn () => throw new TransportException('Connection refused'), $logger)->verify('key:abc:def');

        $logs = [];
        foreach ($logger->cleanLogs() as $log) {
            self::assertIsArray($log);
            $logs[] = [$log[0] ?? null, $log[1] ?? null];
        }
        self::assertSame([['error', 'Cap server could not be reached to verify the token.']], $logs);
    }

    /**
     * A PSR-18 client over Symfony's MockHttpClient, with Nyholm's PSR-17 factories.
     */
    private function verifier(MockResponse|Closure $response, ?LoggerInterface $logger = null): CapVerifier
    {
        $factory = new Psr17Factory();
        $client = new Psr18Client(new MockHttpClient($response), $factory, $factory);

        return new CapVerifier('https://cap.example.com/key/siteverify', 'secret', $client, $factory, $factory, $logger);
    }
}
