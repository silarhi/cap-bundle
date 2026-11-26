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

use function in_array;

use Override;

/**
 * The verifier of cap.test_tokens, for the test environment: accepts the tokens it is given, as often as they are
 * sent, and rejects the others like the Cap server rejects an unknown token. Never calls the Cap server.
 */
final readonly class TestCapVerifier implements CapVerifierInterface
{
    /** What the Cap server answers for a token it does not know. */
    public const ERROR_TOKEN_NOT_FOUND = 'Token not found';

    /**
     * @param list<string> $tokens
     */
    public function __construct(
        private array $tokens,
    ) {
    }

    #[Override]
    public function verify(string $token): VerificationResult
    {
        if ('' === $token) {
            return VerificationResult::failure(VerificationResult::ERROR_MISSING_RESPONSE);
        }

        return in_array($token, $this->tokens, true)
            ? VerificationResult::success()
            : VerificationResult::failure(self::ERROR_TOKEN_NOT_FOUND);
    }
}
