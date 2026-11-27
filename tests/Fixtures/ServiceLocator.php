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

namespace Silarhi\CapBundle\Tests\Fixtures;

use Psr\Container\ContainerInterface;
use Symfony\Contracts\Service\ServiceLocatorTrait;

/** A PSR-11 locator of factories, as an application without symfony/dependency-injection gives one */
final class ServiceLocator implements ContainerInterface
{
    use ServiceLocatorTrait;
}
