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

use function dirname;

use Nyholm\Psr7\Factory\Psr17Factory;
use Override;
use Psr\Log\NullLogger;
use Silarhi\CapBundle\SilarhiCapBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

use function Symfony\Component\DependencyInjection\Loader\Configurator\service;

use Symfony\Component\HttpClient\Psr18Client;
use Symfony\Component\HttpKernel\Bundle\BundleInterface;
use Symfony\Component\HttpKernel\Kernel;

/**
 * Framework + Twig + the bundle, its Cap server mocked by test.cap_http_client. Each environment is a configuration:
 * "test" the defaults (psr18.http_client over a mocked http_client), "disabled" with enabled: false, "custom" with
 * every option set (its own PSR-18 client and PSR-17 factory), "env" with the CAP_ENDPOINT and CAP_SECRET_KEY env vars
 * instead of the endpoint and the secret key.
 */
final class TestKernel extends Kernel
{
    use MicroKernelTrait;

    /**
     * @return iterable<BundleInterface>
     */
    #[Override]
    public function registerBundles(): iterable
    {
        return [
            new FrameworkBundle(),
            new TwigBundle(),
            new SilarhiCapBundle(),
        ];
    }

    #[Override]
    public function getProjectDir(): string
    {
        return dirname(__DIR__, 2);
    }

    #[Override]
    public function getCacheDir(): string
    {
        return sys_get_temp_dir() . '/cap-bundle/cache/' . $this->getEnvironment();
    }

    #[Override]
    public function getLogDir(): string
    {
        return sys_get_temp_dir() . '/cap-bundle/log';
    }

    protected function configureContainer(ContainerConfigurator $container): void
    {
        $container->extension('framework', [
            'secret' => 'test',
            'test' => true,
            'http_method_override' => false,
            'handle_all_throwables' => true,
            'php_errors' => ['log' => true],
            'form' => ['enabled' => true, 'csrf_protection' => false],
            'validation' => ['enabled' => true],
            'translator' => ['enabled' => true, 'default_path' => '%kernel.project_dir%/tests/Fixtures/translations'],
            'assets' => ['enabled' => true, 'version' => 'v1'],
            'http_client' => ['mock_response_factory' => 'test.cap_server'],
        ]);

        $container->extension('twig', [
            'strict_variables' => true,
        ]);

        $config = 'env' === $this->getEnvironment()
            ? []
            : ['endpoint' => 'https://cap.example.com/site-key', 'secret_key' => 'secret'];

        if ('disabled' === $this->getEnvironment()) {
            $config['enabled'] = false;
        }

        if ('custom' === $this->getEnvironment()) {
            $config += [
                'verify_url' => 'http://cap:3000/site-key/siteverify',
                'http_client' => 'test.psr18_client',
                'request_factory' => 'test.psr17_factory',
                'stream_factory' => 'test.psr17_factory',
                'adapters' => ['turbo', 'live'],
                'render_scripts' => false,
                'widget' => [
                    'wasm_url' => '/cap/cap_wasm_bg.wasm',
                    'hashwx_url' => '/cap/hashwx.wasm',
                ],
            ];
        }

        $container->extension('cap', $config);

        $services = $container->services();
        $services->set('test.cap_server', CapServerMock::class)->public();
        $services->set('logger', NullLogger::class);
        // The "custom" environment's own PSR-18 client and PSR-17 factory, in place of psr18.http_client
        $services->set('test.psr17_factory', Psr17Factory::class);
        $services->set('test.psr18_client', Psr18Client::class)
            ->args([service('http_client'), service('test.psr17_factory'), service('test.psr17_factory')]);

        // Nothing in the kernel uses them: the container would remove them before the tests get them
        foreach (['form.factory', 'twig', 'validator', 'translator', 'request_stack'] as $id) {
            $services->alias('test.' . $id, $id)->public();
        }
    }
}
