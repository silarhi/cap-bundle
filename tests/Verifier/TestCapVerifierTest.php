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

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Silarhi\CapBundle\Verifier\TestCapVerifier;
use Silarhi\CapBundle\Verifier\VerificationResult;

final class TestCapVerifierTest extends TestCase
{
    public function testAcceptsTheGivenTokensAsOftenAsTheyAreSent(): void
    {
        $verifier = new TestCapVerifier(['token-a', 'token-b']);

        self::assertTrue($verifier->verify('token-a')->isSuccess());
        self::assertTrue($verifier->verify('token-a')->isSuccess());
        self::assertTrue($verifier->verify('token-b')->isSuccess());
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function provideRejectedTokens(): iterable
    {
        yield 'empty token' => ['', VerificationResult::ERROR_MISSING_RESPONSE];
        yield 'unknown token' => ['token-c', TestCapVerifier::ERROR_TOKEN_NOT_FOUND];
    }

    #[DataProvider('provideRejectedTokens')]
    public function testRejectsTheOtherTokens(string $token, string $error): void
    {
        $result = (new TestCapVerifier(['token-a']))->verify($token);

        self::assertFalse($result->isSuccess());
        self::assertSame($error, $result->error);
    }
}
