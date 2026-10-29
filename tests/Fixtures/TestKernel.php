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

use Override;
use Psr\Log\NullLogger;
use Silarhi\CapBundle\SilarhiCapBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpKernel\Bundle\BundleInterface;
use Symfony\Component\HttpKernel\Kernel;

/**
 * Framework + Twig + the bundle, its Cap server mocked by test.cap_http_client. Each environment is a configuration:
 * "test" the defaults, "disabled" with enabled: false, "custom" with every option set, "env" with the CAP_ENDPOINT and
 * CAP_SECRET_KEY env vars instead of the endpoint and the secret key.
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
        ]);

        $container->extension('twig', [
            'strict_variables' => true,
        ]);

        $config = 'env' === $this->getEnvironment()
            ? ['http_client' => 'test.cap_http_client']
            : [
                'endpoint' => 'https://cap.example.com/site-key',
                'secret_key' => 'secret',
                'http_client' => 'test.cap_http_client',
            ];

        if ('disabled' === $this->getEnvironment()) {
            $config['enabled'] = false;
        }

        if ('custom' === $this->getEnvironment()) {
            $config += [
                'verify_url' => 'http://cap:3000/site-key/siteverify',
                'render_scripts' => false,
                'widget' => [
                    'wasm_url' => '/cap/cap_wasm_bg.wasm',
                    'hashwx_url' => '/cap/hashwx.wasm',
                ],
            ];
        }

        $container->extension('cap', $config);

        $services = $container->services();
        $services->set('test.cap_http_client', MockHttpClient::class)->public();
        $services->set('logger', NullLogger::class);

        // Nothing in the kernel uses them: the container would remove them before the tests get them
        foreach (['form.factory', 'twig', 'validator', 'translator', 'request_stack'] as $id) {
            $services->alias('test.' . $id, $id)->public();
        }
    }
}
