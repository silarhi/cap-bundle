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

interface CapVerifierInterface
{
    /**
     * Redeems a token solved by the widget against the /siteverify endpoint of the Cap server.
     *
     * Tokens are single-use: a second verification of the same token fails. Never throws: a Cap server out of reach is
     * a failed verification (ERROR_CONNECTION_FAILED), so a form protected by Cap fails closed.
     */
    public function verify(string $token): VerificationResult;
}
