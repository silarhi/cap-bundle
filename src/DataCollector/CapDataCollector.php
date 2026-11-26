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

namespace Silarhi\CapBundle\DataCollector;

use function array_filter;
use function array_push;
use function array_values;
use function count;
use function is_array;
use function is_string;

use Override;
use Silarhi\CapBundle\Verifier\TraceableCapVerifier;
use Silarhi\CapBundle\Verifier\TracedVerification;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\DataCollector\DataCollector;
use Throwable;

/**
 * The Cap panel of the profiler (cap.profiler): the configuration, and the tokens the site keys verified.
 */
final class CapDataCollector extends DataCollector
{
    public const NAME = 'cap';

    /**
     * @param iterable<TraceableCapVerifier> $verifiers
     * @param array<string, string>          $endpoints the API endpoints of the site keys, by name
     */
    public function __construct(
        private readonly iterable $verifiers,
        private readonly bool $enabled,
        private readonly bool $testMode,
        private readonly array $endpoints,
    ) {
    }

    #[Override]
    public function collect(Request $request, Response $response, ?Throwable $exception = null): void
    {
        $verifications = [];
        foreach ($this->verifiers as $verifier) {
            array_push($verifications, ...$verifier->getVerifications());
        }

        $this->data = [
            'enabled' => $this->enabled,
            'test_mode' => $this->testMode,
            'endpoints' => $this->endpoints,
            'verifications' => $verifications,
        ];
    }

    #[Override]
    public function getName(): string
    {
        return self::NAME;
    }

    #[Override]
    public function reset(): void
    {
        $this->data = [];
    }

    public function isEnabled(): bool
    {
        return true === ($this->data['enabled'] ?? null);
    }

    public function isTestMode(): bool
    {
        return true === ($this->data['test_mode'] ?? null);
    }

    /**
     * @return array<string>
     */
    public function getEndpoints(): array
    {
        $endpoints = $this->data['endpoints'] ?? null;

        return is_array($endpoints) ? array_filter($endpoints, is_string(...)) : [];
    }

    /**
     * @return list<TracedVerification>
     */
    public function getVerifications(): array
    {
        $verifications = $this->data['verifications'] ?? null;
        if (!is_array($verifications)) {
            return [];
        }

        return array_values(array_filter($verifications, static fn (mixed $verification): bool => $verification instanceof TracedVerification));
    }

    public function countFailures(): int
    {
        return count(array_filter($this->getVerifications(), static fn (TracedVerification $verification): bool => !$verification->result->success));
    }
}
