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

namespace Silarhi\CapBundle\Tests\E2E;

use function assert;
use function dirname;

use Override;
use Silarhi\CapBundle\Form\CapMode;
use Silarhi\CapBundle\Form\CapType;
use Silarhi\CapBundle\SilarhiCapBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\Form\Extension\Core\Type\FormType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Bundle\BundleInterface;
use Symfony\Component\HttpKernel\Kernel;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;
use Twig\Environment;

/**
 * The application of the end-to-end tests (assets/e2e): a checkbox and an invisible challenge, redeemed by a real Cap
 * server (CAP_ENDPOINT, CAP_SECRET_KEY) through the default psr18.http_client.
 */
final class E2eKernel extends Kernel
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
        return sys_get_temp_dir() . '/cap-bundle-e2e/cache';
    }

    #[Override]
    public function getLogDir(): string
    {
        return sys_get_temp_dir() . '/cap-bundle-e2e/log';
    }

    public function page(Request $request): Response
    {
        $result = null;
        $forms = [];
        foreach (CapMode::cases() as $mode) {
            $form = $this->forms()->createNamedBuilder($mode->value, FormType::class)
                ->add('name', TextType::class)
                ->add('captcha', CapType::class, ['mode' => $mode])
                ->add('send', SubmitType::class)
                ->getForm()
                ->handleRequest($request);

            if ($form->isSubmitted()) {
                $result = $form->isValid() ? $mode->value . ' accepted' : $mode->value . ' rejected';
            }
            $forms[$mode->value] = $form->createView();
        }

        $twig = $this->getContainer()->get('e2e.twig');
        assert($twig instanceof Environment);

        return new Response($twig->render('page.html.twig', ['forms' => $forms, 'result' => $result]), null === $result || str_ends_with($result, 'accepted') ? 200 : 422);
    }

    protected function configureContainer(ContainerConfigurator $container): void
    {
        $container->extension('framework', [
            'secret' => 'e2e',
            'http_method_override' => false,
            'handle_all_throwables' => true,
            'php_errors' => ['log' => true],
            'form' => ['enabled' => true, 'csrf_protection' => false],
            'validation' => ['enabled' => true],
            'translator' => ['enabled' => true, 'default_path' => '%kernel.project_dir%/tests/Fixtures/translations'],
            'http_client' => ['enabled' => true],
        ]);
        $container->extension('twig', ['default_path' => '%kernel.project_dir%/tests/E2E/templates', 'strict_variables' => true]);
        // endpoint and secret_key: the CAP_ENDPOINT and CAP_SECRET_KEY env vars
        $container->extension('cap', []);

        $services = $container->services();
        $services->alias('e2e.form_factory', 'form.factory')->public();
        $services->alias('e2e.twig', 'twig')->public();
    }

    protected function configureRoutes(RoutingConfigurator $routes): void
    {
        $routes->add('page', '/')->controller('kernel::page');
    }

    private function forms(): FormFactoryInterface
    {
        $factory = $this->getContainer()->get('e2e.form_factory');
        assert($factory instanceof FormFactoryInterface);

        return $factory;
    }
}
