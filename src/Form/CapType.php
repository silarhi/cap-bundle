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

namespace Silarhi\CapBundle\Form;

use function is_string;

use Override;
use Silarhi\CapBundle\Validator\Cap;

use function sprintf;

use Symfony\Component\Asset\Packages;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\OptionsResolver\Exception\InvalidOptionsException;
use Symfony\Component\OptionsResolver\Options;
use Symfony\Component\OptionsResolver\OptionsResolver;

/**
 * A Cap challenge in a form: the widget posts the solved token under the name of the field, and the Cap constraint
 * redeems it on submit.
 *
 * @extends AbstractType<string>
 */
final class CapType extends AbstractType
{
    /** Where `assets:install` copies the script of the bundle (its public/ folder). */
    public const SCRIPT_PATH = 'bundles/silarhicap/cap.js';

    /** The cap-widget release the bundle ships and is tested against, and its WebAssembly solvers. */
    public const WIDGET_SCRIPT_PATH = 'bundles/silarhicap/widget/cap.min.js';

    public const WASM_PATH = 'bundles/silarhicap/widget/cap_wasm_bg.wasm';

    public const HASHWX_PATH = 'bundles/silarhicap/widget/hashwx.wasm';

    /**
     * The widget settings are asset paths or URLs.
     *
     * @param string                $endpoint      the API endpoint of the site key, e.g. https://cap.example.com/<site-key>/
     * @param bool                  $enabled       false renders nothing (and the validator accepts everything)
     * @param bool                  $renderScripts renders the <script> of the bundle next to the widget
     * @param string|null           $widgetScript  the cap-widget script, loaded by the bundle's script or its Stimulus
     *                                             controller; null when the application imports cap-widget itself
     * @param string|null           $wasmUrl       the cap_wasm_bg.wasm solver; null for the widget's default
     * @param string|null           $hashwxUrl     the hashwx.wasm solver; null for the widget's default
     * @param list<string>          $adapters      the JavaScript adapters to install, e.g. ["turbo", "live"]
     * @param array<string, string> $endpoints     the API endpoints of the other site keys, by name (the site_key option)
     */
    public function __construct(
        private readonly string $endpoint,
        private readonly bool $enabled = true,
        private readonly bool $renderScripts = true,
        private readonly ?string $widgetScript = null,
        private readonly ?string $wasmUrl = null,
        private readonly ?string $hashwxUrl = null,
        private readonly array $adapters = [],
        private readonly ?Packages $packages = null,
        private readonly ?RequestStack $requestStack = null,
        private readonly array $endpoints = [],
    ) {
    }

    #[Override]
    public function buildView(FormView $view, FormInterface $form, array $options): void
    {
        $view->vars['enabled'] = $this->enabled;
        /** @var CapMode $mode the normalizer of the option turns strings into the enum */
        $mode = $options['mode'];
        $view->vars['mode'] = $mode->value;
        /** @var string|null $siteKey the normalizer of the option checks it is configured */
        $siteKey = $options['site_key'];
        $view->vars['endpoint'] = rtrim($this->getEndpoint($siteKey), '/') . '/';
        $view->vars['locale'] = $options['locale'] ?? $this->requestStack?->getCurrentRequest()?->getLocale();
        $view->vars['worker_count'] = $options['worker_count'];
        $view->vars['troubleshooting_url'] = $options['troubleshooting_url'];
        $view->vars['i18n'] = $options['i18n'];
        $view->vars['csp_nonce'] = $options['csp_nonce'];
        $view->vars['haptics'] = $options['haptics'];
        $view->vars['floating_position'] = $options['floating_position'];
        $view->vars['floating_offset'] = $options['floating_offset'];
        $view->vars['wasm_url'] = $this->assetUrl($this->wasmUrl);
        $view->vars['hashwx_url'] = $this->assetUrl($this->hashwxUrl);
        $view->vars['adapters'] = $this->adapters;
        // The Stimulus controller loads it too: rendered with or without the bundle's script
        $view->vars['widget_script'] = $this->assetUrl($this->widgetScript);
        $view->vars['script_url'] = $this->renderScripts ? $this->assetUrl(self::SCRIPT_PATH) : null;
    }

    #[Override]
    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'mapped' => false,
            'compound' => false,
            'label' => false,
            'error_bubbling' => false,
            'empty_data' => '',
            'constraints' => static fn (Options $options): array => [new Cap(siteKey: is_string($options['site_key']) ? $options['site_key'] : null)],
            'site_key' => null,
            'mode' => CapMode::Checkbox,
            'locale' => null,
            'worker_count' => null,
            'troubleshooting_url' => null,
            'i18n' => [],
            'csp_nonce' => null,
            'haptics' => true,
            'floating_position' => 'top',
            'floating_offset' => 8,
        ]);

        $resolver->setAllowedTypes('site_key', ['null', 'string']);
        $resolver->setNormalizer('site_key', function (Options $options, ?string $siteKey): ?string {
            if (null !== $siteKey && !isset($this->endpoints[$siteKey])) {
                throw new InvalidOptionsException(sprintf('The Cap site key "%s" is not configured: add it to "cap.site_keys".', $siteKey));
            }

            return $siteKey;
        });

        $resolver->setAllowedTypes('mode', [CapMode::class, 'string']);
        // The string form stays for options set from Twig or from a configuration file
        $resolver->setNormalizer('mode', static fn (Options $options, CapMode|string $mode): CapMode => $mode instanceof CapMode
            ? $mode
            : CapMode::tryFrom($mode) ?? throw new InvalidOptionsException(sprintf('The option "mode" with value "%s" is invalid. Accepted values are: "%s".', $mode, implode('", "', array_column(CapMode::cases(), 'value')))));
        $resolver->setAllowedTypes('locale', ['null', 'string']);
        $resolver->setAllowedTypes('worker_count', ['null', 'int']);
        $resolver->setAllowedTypes('troubleshooting_url', ['null', 'string']);
        $resolver->setAllowedTypes('i18n', 'string[]');
        $resolver->setAllowedTypes('csp_nonce', ['null', 'string']);
        $resolver->setAllowedTypes('haptics', 'bool');
        $resolver->setAllowedValues('floating_position', ['top', 'bottom']);
        $resolver->setAllowedTypes('floating_offset', 'int');

        $resolver->setInfo('site_key', 'The site key of cap.site_keys solving and verifying the challenge, null for the default one.');
        $resolver->setInfo('mode', 'CapMode::Checkbox shows the Cap widget, CapMode::Floating shows it next to the submit button when the form is submitted, CapMode::Invisible solves the challenge without any UI.');
        $resolver->setInfo('locale', 'Language of the widget labels (data-cap-lang). Defaults to the request locale.');
        $resolver->setInfo('i18n', 'Widget labels, keyed by the suffix of their data-cap-i18n-* attribute: ["initial-state" => "..."].');
        $resolver->setInfo('csp_nonce', 'Nonce of the <script> tag, and of the <style> the widget injects, for a strict Content-Security-Policy.');
        $resolver->setInfo('haptics', 'false turns off the vibrations of the widget on mobile (data-cap-disable-haptics).');
        $resolver->setInfo('floating_position', 'CapMode::Floating: shows the widget above ("top") or below ("bottom") the submit button.');
        $resolver->setInfo('floating_offset', 'CapMode::Floating: the gap between the widget and the submit button, in pixels.');
    }

    private function getEndpoint(?string $siteKey): string
    {
        return null === $siteKey ? $this->endpoint : $this->endpoints[$siteKey];
    }

    /**
     * The URL of a public file, versioned by the Asset component when it is installed. URLs are left as they are.
     */
    private function assetUrl(?string $path): ?string
    {
        if (null === $path) {
            return null;
        }
        if ($this->packages instanceof Packages) {
            return $this->packages->getUrl($path);
        }

        return str_contains($path, '://') || str_starts_with($path, '/') ? $path : '/' . $path;
    }

    #[Override]
    public function getBlockPrefix(): string
    {
        return 'silarhi_cap';
    }
}
