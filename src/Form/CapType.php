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

    /**
     * @param string      $endpoint      the API endpoint of the site key, e.g. https://cap.example.com/<site-key>/
     * @param bool        $enabled       false renders nothing (and the validator accepts everything)
     * @param bool        $renderScripts renders the <script> of the bundle next to the widget
     * @param string|null $widgetScript  URL of the cap-widget script, loaded by the bundle's script; null when the
     *                                   application imports cap-widget itself
     */
    public function __construct(
        private readonly string $endpoint,
        private readonly bool $enabled = true,
        private readonly bool $renderScripts = true,
        private readonly ?string $widgetScript = null,
        private readonly ?string $wasmUrl = null,
        private readonly ?string $hashwxUrl = null,
        private readonly ?Packages $packages = null,
        private readonly ?RequestStack $requestStack = null,
    ) {
    }

    #[Override]
    public function buildView(FormView $view, FormInterface $form, array $options): void
    {
        $view->vars['enabled'] = $this->enabled;
        /** @var CapMode $mode the normalizer of the option turns strings into the enum */
        $mode = $options['mode'];
        $view->vars['mode'] = $mode->value;
        $view->vars['endpoint'] = rtrim($this->endpoint, '/') . '/';
        $view->vars['locale'] = $options['locale'] ?? $this->requestStack?->getCurrentRequest()?->getLocale();
        $view->vars['worker_count'] = $options['worker_count'];
        $view->vars['troubleshooting_url'] = $options['troubleshooting_url'];
        $view->vars['i18n'] = $options['i18n'];
        $view->vars['csp_nonce'] = $options['csp_nonce'];
        $view->vars['wasm_url'] = $this->wasmUrl;
        $view->vars['hashwx_url'] = $this->hashwxUrl;
        $view->vars['widget_script'] = $this->renderScripts ? $this->widgetScript : null;
        $view->vars['script_url'] = $this->renderScripts
            ? ($this->packages?->getUrl(self::SCRIPT_PATH) ?? '/' . self::SCRIPT_PATH)
            : null;
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
            'constraints' => [new Cap()],
            'mode' => CapMode::Checkbox,
            'locale' => null,
            'worker_count' => null,
            'troubleshooting_url' => null,
            'i18n' => [],
            'csp_nonce' => null,
        ]);

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

        $resolver->setInfo('mode', 'CapMode::Checkbox shows the Cap widget, CapMode::Invisible solves the challenge without any UI.');
        $resolver->setInfo('locale', 'Language of the widget labels (data-cap-lang). Defaults to the request locale.');
        $resolver->setInfo('i18n', 'Widget labels, keyed by the suffix of their data-cap-i18n-* attribute: ["initial-state" => "..."].');
        $resolver->setInfo('csp_nonce', 'Nonce of the <script> tag, and of the <style> the widget injects, for a strict Content-Security-Policy.');
    }

    #[Override]
    public function getBlockPrefix(): string
    {
        return 'silarhi_cap';
    }
}
