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

namespace Silarhi\CapBundle;

use function class_exists;
use function interface_exists;
use function is_array;
use function is_file;
use function is_string;

use LogicException;
use Override;
use Silarhi\CapBundle\Form\CapType;
use Silarhi\CapBundle\Validator\CapValidator;
use Silarhi\CapBundle\Verifier\CapVerifier;
use Silarhi\CapBundle\Verifier\CapVerifierInterface;
use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

use function Symfony\Component\DependencyInjection\Loader\Configurator\service;

use Symfony\Component\HttpClient\Psr18Client;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

final class SilarhiCapBundle extends AbstractBundle
{
    /** The configuration key: `cap:` rather than the `silarhi_cap:` derived from the class name. */
    protected string $extensionAlias = 'cap';

    #[Override]
    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
                ->scalarNode('endpoint')
                    // An env var rather than a required option: installing the bundle must not break cache:clear
                    ->defaultValue('%env(CAP_ENDPOINT)%')
                    ->cannotBeEmpty()
                    ->info('The API endpoint of the site key, as the browser reaches it: https://<your-instance>/<site-key>/')
                ->end()
                ->scalarNode('secret_key')
                    ->defaultValue('%env(CAP_SECRET_KEY)%')
                    ->cannotBeEmpty()
                    ->info('The secret key of the site key (not the ADMIN_KEY of the dashboard).')
                ->end()
                ->scalarNode('verify_url')
                    ->defaultNull()
                    ->info('The /siteverify URL, as the server reaches it (e.g. http://cap:3000/<site-key>/siteverify in Docker). Defaults to <endpoint>siteverify.')
                ->end()
                ->booleanNode('enabled')
                    ->defaultTrue()
                    ->info('false renders no widget and accepts every submission: for the test environment.')
                ->end()
                ->scalarNode('http_client')
                    ->defaultNull()
                    ->info('PSR-18 HTTP client service ID calling /siteverify. Defaults to Symfony\'s psr18.http_client.')
                ->end()
                ->scalarNode('request_factory')
                    ->defaultNull()
                    ->info('PSR-17 request factory service ID. Defaults to the HTTP client (psr18.http_client is one).')
                ->end()
                ->scalarNode('stream_factory')
                    ->defaultNull()
                    ->info('PSR-17 stream factory service ID. Defaults to the HTTP client (psr18.http_client is one).')
                ->end()
                ->arrayNode('adapters')
                    ->info('Framework adapters of the JavaScript, opt-in: "turbo" forgets the tokens Turbo Drive submitted or cached, "live" sends the token of Live Component forms with their action only.')
                    ->enumPrototype()->values(['live', 'turbo'])->end()
                ->end()
                ->booleanNode('render_scripts')
                    ->defaultTrue()
                    ->info('Renders the <script> of the bundle with each widget. false when the Stimulus controller or your own install() call loads it.')
                ->end()
                ->arrayNode('widget')
                    ->info('Where the browser loads the Cap widget from: an asset path (the copies the bundle ships, by default) or a URL.')
                    ->addDefaultsIfNotSet()
                    ->children()
                        ->scalarNode('script')
                            ->defaultValue(CapType::WIDGET_SCRIPT_PATH)
                            ->info('The cap-widget script, e.g. https://<your-instance>/assets/widget.js. null when your application imports cap-widget itself.')
                        ->end()
                        ->scalarNode('wasm_url')
                            ->defaultValue(CapType::WASM_PATH)
                            ->info('The cap_wasm_bg.wasm solver (window.CAP_CUSTOM_WASM_URL). null for the widget\'s default, jsDelivr.')
                        ->end()
                        ->scalarNode('hashwx_url')
                            ->defaultValue(CapType::HASHWX_PATH)
                            ->info('The hashwx.wasm solver (window.CAP_CUSTOM_HASHWX_URL). null for the widget\'s default, jsDelivr.')
                        ->end()
                    ->end()
                ->end()
            ->end();
    }

    #[Override]
    public function prependExtension(ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        if ($builder->hasExtension('twig')) {
            $builder->prependExtensionConfig('twig', [
                'form_themes' => ['@SilarhiCap/form/cap_widget.html.twig'],
            ]);
        }

        // StimulusBundle reads assets/package.json; AssetMapper still needs to know where the controller lives
        if ($this->isAssetMapperAvailable($builder)) {
            $builder->prependExtensionConfig('framework', [
                'asset_mapper' => [
                    'paths' => [__DIR__ . '/../assets/dist' => '@silarhi/cap-bundle'],
                ],
            ]);
        }
    }

    /**
     * @param array<mixed> $config
     */
    #[Override]
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        /** @var array{
         *     endpoint: string,
         *     secret_key: string,
         *     verify_url: string|null,
         *     enabled: bool,
         *     http_client: string|null,
         *     request_factory: string|null,
         *     stream_factory: string|null,
         *     adapters: list<string>,
         *     render_scripts: bool,
         *     widget: array{script: string|null, wasm_url: string|null, hashwx_url: string|null},
         * } $config */
        $services = $container->services();

        // FrameworkBundle registers psr18.http_client when symfony/http-client and psr/http-client are installed
        if (null === $config['http_client'] && !class_exists(Psr18Client::class)) {
            throw new LogicException('The Cap bundle redeems tokens with Symfony\'s "psr18.http_client" service by default, which needs symfony/http-client: run "composer require symfony/http-client", or set "cap.http_client" to your own PSR-18 client service.');
        }
        $httpClient = $config['http_client'] ?? 'psr18.http_client';

        // The endpoint is often an env var: its trailing slash can only be normalized at runtime
        $services->set('cap.verifier', CapVerifier::class)
            ->factory([CapVerifier::class, 'fromEndpoint'])
            ->args([
                $config['endpoint'],
                $config['secret_key'],
                $config['verify_url'],
                service($httpClient),
                service($config['request_factory'] ?? $httpClient),
                service($config['stream_factory'] ?? $httpClient),
                service('logger')->ignoreOnInvalid(),
            ])
            ->tag('monolog.logger', ['channel' => 'cap']);
        $services->alias(CapVerifierInterface::class, 'cap.verifier');

        $services->set('cap.validator', CapValidator::class)
            ->args([service('cap.verifier'), $config['enabled']])
            ->tag('validator.constraint_validator')
            ->tag('kernel.reset', ['method' => 'reset']);

        $services->set('cap.form_type', CapType::class)
            ->args([
                $config['endpoint'],
                $config['enabled'],
                $config['render_scripts'],
                $config['widget']['script'],
                $config['widget']['wasm_url'],
                $config['widget']['hashwx_url'],
                $config['adapters'],
                service('assets.packages')->ignoreOnInvalid(),
                service('request_stack')->ignoreOnInvalid(),
            ])
            ->tag('form.type');
    }

    private function isAssetMapperAvailable(ContainerBuilder $builder): bool
    {
        if (!interface_exists(AssetMapperInterface::class)) {
            return false;
        }

        $bundlesMetadata = $builder->getParameter('kernel.bundles_metadata');
        if (!is_array($bundlesMetadata) || !is_array($bundlesMetadata['FrameworkBundle'] ?? null)) {
            return false;
        }

        $path = $bundlesMetadata['FrameworkBundle']['path'] ?? null;

        return is_string($path) && is_file($path . '/Resources/config/asset_mapper.php');
    }
}
