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

namespace Silarhi\CapBundle\Tests;

use function class_exists;
use function dirname;
use function enum_exists;
use function interface_exists;

use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Silarhi\CapBundle\SilarhiCapBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\TwigBundle\DependencyInjection\TwigExtension;
use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\ExtensionInterface;
use Symfony\Component\DependencyInjection\Extension\PrependExtensionInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBag;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\HttpClient\Psr18Client;

use function trait_exists;

/**
 * The extension of the bundle without a kernel, for the applications the functional tests cannot stand for: without
 * FrameworkBundle, Twig, symfony/asset-mapper or symfony/http-client. The last two are installed here: the tests that
 * need them gone hide them from the autoloader, in a process of their own.
 */
final class SilarhiCapBundleTest extends TestCase
{
    public function testPrependsTheFormThemeAndTheAssetMapperPath(): void
    {
        $builder = $this->builder(['FrameworkBundle' => ['path' => (new FrameworkBundle())->getPath()]]);
        $builder->registerExtension(new TwigExtension());

        $this->prepend($builder);

        self::assertSame([['form_themes' => ['@SilarhiCap/form/cap_widget.html.twig']]], $builder->getExtensionConfig('twig'));
        self::assertSame(
            [['asset_mapper' => ['paths' => [self::bundleDir() . '/../assets/dist' => '@silarhi/cap-bundle']]]],
            $builder->getExtensionConfig('framework')
        );
    }

    /**
     * @return iterable<string, array{array<string, mixed>}>
     */
    public static function provideApplicationsWithoutAssetMapper(): iterable
    {
        yield 'without FrameworkBundle' => [[]];
        yield 'FrameworkBundle older than AssetMapper' => [['FrameworkBundle' => ['path' => __DIR__]]];
    }

    /**
     * @param array<string, mixed> $bundlesMetadata
     */
    #[DataProvider('provideApplicationsWithoutAssetMapper')]
    public function testPrependsNothingToAnApplicationWithoutTwigNorAssetMapper(array $bundlesMetadata): void
    {
        $builder = $this->builder($bundlesMetadata);

        $this->prepend($builder);

        self::assertSame([], $builder->getExtensionConfig('twig'));
        self::assertSame([], $builder->getExtensionConfig('framework'));
    }

    #[RunInSeparateProcess]
    public function testDoesNotPrependTheAssetMapperPathWithoutSymfonyAssetMapper(): void
    {
        self::hideFromAutoloading(AssetMapperInterface::class);
        $builder = $this->builder(['FrameworkBundle' => ['path' => (new FrameworkBundle())->getPath()]]);
        $builder->registerExtension(new TwigExtension());

        $this->prepend($builder);

        self::assertSame([['form_themes' => ['@SilarhiCap/form/cap_widget.html.twig']]], $builder->getExtensionConfig('twig'));
        self::assertSame([], $builder->getExtensionConfig('framework'));
    }

    #[RunInSeparateProcess]
    public function testNamesThePackagesToInstallWithoutSymfonyHttpClient(): void
    {
        self::hideFromAutoloading(Psr18Client::class);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessageMatches('/run "composer require symfony\/http-client[^"]*", or set "cap\.http_client" to your own PSR-18 client service\.$/');

        $this->extension()->load([['endpoint' => 'https://cap.example.com/key/', 'secret_key' => 'secret']], $this->builder([]));
    }

    #[RunInSeparateProcess]
    public function testUsesItsOwnPsr18ClientWithoutSymfonyHttpClient(): void
    {
        self::hideFromAutoloading(Psr18Client::class);
        $builder = $this->builder([]);

        $this->extension()->load([[
            'endpoint' => 'https://cap.example.com/key/',
            'secret_key' => 'secret',
            'http_client' => 'app.psr18_client',
        ]], $builder);

        $arguments = $builder->getDefinition('cap.verifier')->getArguments();
        foreach ([3, 4, 5] as $index) {
            self::assertInstanceOf(Reference::class, $arguments[$index]);
            self::assertSame('app.psr18_client', (string) $arguments[$index], 'The client is the PSR-17 factories too by default');
        }
    }

    /**
     * @param array<string, mixed> $bundlesMetadata
     */
    private function builder(array $bundlesMetadata): ContainerBuilder
    {
        return new ContainerBuilder(new ParameterBag([
            'kernel.bundles_metadata' => $bundlesMetadata,
        ]));
    }

    private function extension(): ExtensionInterface
    {
        $extension = (new SilarhiCapBundle())->getContainerExtension();
        self::assertNotNull($extension);

        return $extension;
    }

    private function prepend(ContainerBuilder $builder): void
    {
        $extension = $this->extension();
        self::assertInstanceOf(PrependExtensionInterface::class, $extension);
        $extension->prepend($builder);
    }

    private static function bundleDir(): string
    {
        return dirname((string) (new ReflectionClass(SilarhiCapBundle::class))->getFileName());
    }

    /**
     * Makes class_exists() and interface_exists() answer false for the class, as when its package is not installed.
     * Only in a separate process: the class must not be loaded yet, and the autoloaders stay wrapped.
     *
     * @param class-string $class
     */
    private static function hideFromAutoloading(string $class): void
    {
        $loaders = spl_autoload_functions();
        foreach ($loaders as $loader) {
            spl_autoload_unregister($loader);
        }

        spl_autoload_register(static function (string $name) use ($class, $loaders): void {
            if ($name === $class) {
                return;
            }

            foreach ($loaders as $loader) {
                $loader($name);
                if (class_exists($name, false) || interface_exists($name, false) || trait_exists($name, false) || enum_exists($name, false)) {
                    return;
                }
            }
        });

        self::assertFalse(class_exists($class) || interface_exists($class), $class . ' was loaded before it could be hidden');
    }
}
