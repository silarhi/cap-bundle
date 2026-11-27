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

namespace Silarhi\CapBundle\Tests\DataCollector;

use function array_map;

use PHPUnit\Framework\TestCase;
use Silarhi\CapBundle\DataCollector\CapDataCollector;
use Silarhi\CapBundle\Verifier\TestCapVerifier;
use Silarhi\CapBundle\Verifier\TraceableCapVerifier;
use Silarhi\CapBundle\Verifier\TracedVerification;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

final class CapDataCollectorTest extends TestCase
{
    public function testCollectsTheVerificationsOfEverySiteKey(): void
    {
        $default = new TraceableCapVerifier(new TestCapVerifier(['default-token']), 'default');
        $signup = new TraceableCapVerifier(new TestCapVerifier(['signup-token']), 'signup');
        $default->verify('default-token');
        $signup->verify('wrong-token');

        $collector = new CapDataCollector([$default, $signup], true, true, ['default' => 'https://cap.example.com/key']);
        $collector->collect(new Request(), new Response());

        self::assertSame('cap', $collector->getName());
        self::assertTrue($collector->isEnabled());
        self::assertTrue($collector->isTestMode());
        self::assertSame(['default' => 'https://cap.example.com/key'], $collector->getEndpoints());
        self::assertSame(['default', 'signup'], array_map(static fn (TracedVerification $verification): string => $verification->siteKey, $collector->getVerifications()));
        self::assertSame(1, $collector->countFailures());
    }

    public function testHasNothingBeforeCollecting(): void
    {
        $collector = new CapDataCollector([], true, true, ['default' => 'https://cap.example.com/key']);

        self::assertFalse($collector->isEnabled());
        self::assertFalse($collector->isTestMode());
        self::assertSame([], $collector->getEndpoints());
        self::assertSame([], $collector->getVerifications());
        self::assertSame(0, $collector->countFailures());
    }

    public function testForgetsTheVerificationsOnReset(): void
    {
        $verifier = new TraceableCapVerifier(new TestCapVerifier(['token']), 'default');
        $verifier->verify('token');
        $collector = new CapDataCollector([$verifier], true, false, []);
        $collector->collect(new Request(), new Response());
        self::assertCount(1, $collector->getVerifications());

        $collector->reset();

        self::assertSame([], $collector->getVerifications());
        self::assertFalse($collector->isEnabled());
    }
}
