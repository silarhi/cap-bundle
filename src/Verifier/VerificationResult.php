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
 * The answer of the Cap server to a /siteverify request.
 *
 * $error is the "error" of the Cap server ("Token not found", "Token expired", "Invalid site key or secret"...), or one
 * of the ERROR_* constants when the bundle could not get an answer.
 */
final readonly class VerificationResult
{
    /** The token is empty: nothing was sent to the Cap server. */
    public const ERROR_MISSING_RESPONSE = 'missing-input-response';

    /** The Cap server could not be reached (DNS, connection, timeout). */
    public const ERROR_CONNECTION_FAILED = 'connection-failed';

    /** The Cap server answered with a 5xx status. */
    public const ERROR_BAD_RESPONSE = 'bad-response';

    /** The Cap server answered something else than JSON. */
    public const ERROR_INVALID_JSON = 'invalid-json';

    /** The Cap server said no, without an error. */
    public const ERROR_UNKNOWN = 'unknown-error';

    private function __construct(
        public bool $success,
        public ?string $error = null,
    ) {
    }

    public static function success(): self
    {
        return new self(true);
    }

    public static function failure(string $error): self
    {
        return new self(false, $error);
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }
}
