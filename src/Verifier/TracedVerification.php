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

/**
 * A token TraceableCapVerifier verified, for the profiler.
 */
final readonly class TracedVerification
{
    /**
     * @param float $duration in milliseconds
     */
    public function __construct(
        public string $siteKey,
        public string $token,
        public VerificationResult $result,
        public float $duration,
    ) {
    }
}
