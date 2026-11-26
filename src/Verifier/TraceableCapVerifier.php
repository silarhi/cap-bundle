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

use function hrtime;

use Override;
use Symfony\Component\Stopwatch\Stopwatch;
use Symfony\Contracts\Service\ResetInterface;

/**
 * Records the verifications of a site key for the profiler (cap.profiler), and times them in the Performance panel.
 */
final class TraceableCapVerifier implements CapVerifierInterface, ResetInterface
{
    /** @var list<TracedVerification> */
    private array $verifications = [];

    public function __construct(
        private readonly CapVerifierInterface $verifier,
        private readonly string $siteKey,
        private readonly ?Stopwatch $stopwatch = null,
    ) {
    }

    #[Override]
    public function verify(string $token): VerificationResult
    {
        $event = $this->stopwatch?->start('cap.verify', 'cap');
        $start = hrtime(true);

        try {
            $result = $this->verifier->verify($token);
        } finally {
            $event?->stop();
        }

        $this->verifications[] = new TracedVerification($this->siteKey, $token, $result, (hrtime(true) - $start) / 1_000_000);

        return $result;
    }

    /**
     * @return list<TracedVerification>
     */
    public function getVerifications(): array
    {
        return $this->verifications;
    }

    #[Override]
    public function reset(): void
    {
        $this->verifications = [];
    }
}
