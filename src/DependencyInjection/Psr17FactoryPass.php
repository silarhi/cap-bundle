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

namespace Silarhi\CapBundle\DependencyInjection;

use function class_exists;

use LogicException;
use Nyholm\Psr7\Factory\Psr17Factory as NyholmPsr17Factory;
use Override;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;

/**
 * Symfony's psr18.http_client needs PSR-17 factories: without them, building it throws on the first submitted form.
 * The extension cannot see other services, hence a pass, which fails the build instead.
 *
 * @internal
 */
final readonly class Psr17FactoryPass implements CompilerPassInterface
{
    /** Set by the extension when cap.http_client is left to psr18.http_client */
    public const DEFAULT_CLIENT_PARAMETER = '.cap.default_http_client';

    /** php-http/discovery's, which Psr18Client prefers; not a dependency of the bundle */
    private const DISCOVERY_FACTORY = 'Http\\Discovery\\Psr17Factory';

    /**
     * @param list<string> $fallbackFactories What Psr18Client uses when the container has no PSR-17 factories
     */
    public function __construct(
        private array $fallbackFactories = [self::DISCOVERY_FACTORY, NyholmPsr17Factory::class],
    ) {
    }

    #[Override]
    public function process(ContainerBuilder $container): void
    {
        if (!$container->hasParameter(self::DEFAULT_CLIENT_PARAMETER)) {
            return;
        }

        // FrameworkBundle gives psr18.http_client these services when they exist
        if ($container->has(ResponseFactoryInterface::class) && $container->has(StreamFactoryInterface::class)) {
            return;
        }

        foreach ($this->fallbackFactories as $factory) {
            if (class_exists($factory)) {
                return;
            }
        }

        throw new LogicException('The Cap bundle redeems tokens with Symfony\'s "psr18.http_client" service by default, which needs a PSR-17 implementation: run "composer require nyholm/psr7", or set "cap.http_client" to your own PSR-18 client service.');
    }
}
