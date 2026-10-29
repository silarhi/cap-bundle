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
use Symfony\Component\Asset\Packages;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\OptionsResolver\OptionsResolver;

/**
 * A Cap challenge in a form: the widget posts the solved token under the name of the field, and the Cap constraint
 * redeems it on submit.
 *
 * @extends AbstractType<string>
 */
final class CapType extends AbstractType
{
    /** The Cap widget: a checkbox the visitor ticks, solved in the background as soon as they interact with the page. */
    public const MODE_CHECKBOX = 'checkbox';

    /** Nothing visible: the challenge is solved when the visitor starts filling the form, or when they submit it. */
    public const MODE_INVISIBLE = 'invisible';

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
        /* @var array{mode: string, locale: string|null, worker_count: int|null, troubleshooting_url: string|null, i18n: array<string, string>, csp_nonce: string|null} $options */
        $view->vars['enabled'] = $this->enabled;
        $view->vars['mode'] = $options['mode'];
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
            'mode' => self::MODE_CHECKBOX,
            'locale' => null,
            'worker_count' => null,
            'troubleshooting_url' => null,
            'i18n' => [],
            'csp_nonce' => null,
        ]);

        $resolver->setAllowedValues('mode', [self::MODE_CHECKBOX, self::MODE_INVISIBLE]);
        $resolver->setAllowedTypes('locale', ['null', 'string']);
        $resolver->setAllowedTypes('worker_count', ['null', 'int']);
        $resolver->setAllowedTypes('troubleshooting_url', ['null', 'string']);
        $resolver->setAllowedTypes('i18n', 'string[]');
        $resolver->setAllowedTypes('csp_nonce', ['null', 'string']);

        $resolver->setInfo('mode', '"checkbox" shows the Cap widget, "invisible" solves the challenge without any UI.');
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
