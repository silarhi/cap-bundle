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

namespace Silarhi\CapBundle\Tests\DependencyInjection;

use LogicException;
use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;
use Silarhi\CapBundle\DependencyInjection\Psr17FactoryPass;
use Symfony\Component\DependencyInjection\ContainerBuilder;

final class Psr17FactoryPassTest extends TestCase
{
    private const MISSING_FACTORY = 'Silarhi\CapBundle\Tests\DependencyInjection\MissingPsr17Factory';

    public function testItIgnoresAnApplicationClient(): void
    {
        $this->expectNotToPerformAssertions();

        (new Psr17FactoryPass([self::MISSING_FACTORY]))->process(new ContainerBuilder());
    }

    public function testItFailsWithoutPsr17Factories(): void
    {
        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('composer require nyholm/psr7');

        (new Psr17FactoryPass([self::MISSING_FACTORY]))->process($this->defaultClientContainer());
    }

    public function testItAcceptsPsr17FactoryServices(): void
    {
        $this->expectNotToPerformAssertions();

        $container = $this->defaultClientContainer();
        $container->register('psr17_factory', Psr17Factory::class);
        $container->setAlias(ResponseFactoryInterface::class, 'psr17_factory');
        $container->setAlias(StreamFactoryInterface::class, 'psr17_factory');

        (new Psr17FactoryPass([self::MISSING_FACTORY]))->process($container);
    }

    public function testItAcceptsAFallbackFactory(): void
    {
        $this->expectNotToPerformAssertions();

        (new Psr17FactoryPass([self::MISSING_FACTORY, Psr17Factory::class]))->process($this->defaultClientContainer());
    }

    private function defaultClientContainer(): ContainerBuilder
    {
        $container = new ContainerBuilder();
        $container->setParameter(Psr17FactoryPass::DEFAULT_CLIENT_PARAMETER, true);

        return $container;
    }
}
