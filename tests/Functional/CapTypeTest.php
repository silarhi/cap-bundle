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

namespace Silarhi\CapBundle\Tests\Functional;

use function is_string;

use Override;
use PHPUnit\Framework\Attributes\DataProvider;
use Silarhi\CapBundle\Form\CapMode;
use Silarhi\CapBundle\Form\CapType;
use Silarhi\CapBundle\Tests\Fixtures\CapServerMock;
use Silarhi\CapBundle\Tests\Fixtures\TestKernel;
use Silarhi\CapBundle\Validator\Cap;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\DomCrawler\Crawler;
use Symfony\Component\Form\Extension\Core\Type\FormType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\OptionsResolver\Exception\InvalidOptionsException;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Contracts\Translation\LocaleAwareInterface;
use Twig\Environment;

final class CapTypeTest extends KernelTestCase
{
    /**
     * @param array<mixed> $options
     */
    #[Override]
    protected static function createKernel(array $options = []): KernelInterface
    {
        $environment = $options['environment'] ?? 'test';

        return new TestKernel(is_string($environment) ? $environment : 'test', true);
    }

    public function testRendersTheWidgetAndTheScriptOfTheBundle(): void
    {
        self::bootKernel();
        $this->pushRequest('fr');

        $crawler = $this->render($this->createForm());
        $widget = $crawler->filter('cap-widget');

        self::assertCount(1, $widget);
        self::assertSame('form_cap', $widget->attr('id'));
        self::assertSame('form[cap]', $widget->attr('data-cap-hidden-field-name'));
        self::assertSame('', $widget->attr('required'));
        self::assertSame('silarhi--cap-bundle--cap', $widget->attr('data-controller'));
        self::assertSame('checkbox', $widget->attr('data-silarhi-cap'));
        self::assertSame('https://cap.example.com/site-key/', $widget->attr('data-cap-api-endpoint'));
        self::assertSame('fr', $widget->attr('data-cap-lang'));
        // The copies of the widget the bundle ships, versioned like any asset
        self::assertSame('/bundles/silarhicap/widget/cap.min.js?v1', $widget->attr('data-silarhi-cap-script'));
        self::assertSame('/bundles/silarhicap/widget/cap_wasm_bg.wasm?v1', $widget->attr('data-silarhi-cap-wasm-url'));
        self::assertSame('/bundles/silarhicap/widget/hashwx.wasm?v1', $widget->attr('data-silarhi-cap-hashwx-url'));
        self::assertNull($widget->attr('data-silarhi-cap-adapters'), 'Adapters are opt-in');
        self::assertNull($widget->attr('data-cap-worker-count'));
        self::assertCount(0, $crawler->filter('label'));

        $script = $crawler->filter('script');
        self::assertCount(1, $script);
        self::assertSame('module', $script->attr('type'));
        self::assertSame('/bundles/silarhicap/cap.js?v1', $script->attr('src'));
        self::assertNull($script->attr('nonce'));
    }

    public function testAssetMapperServesTheControllerAndTheScriptOfTheBundle(): void
    {
        self::bootKernel(['environment' => 'asset_mapper']);

        $assetMapper = self::getContainer()->get('test.asset_mapper');
        self::assertInstanceOf(AssetMapperInterface::class, $assetMapper);
        self::assertNotNull($assetMapper->getAsset('@silarhi/cap-bundle/controller.js'), 'StimulusBundle imports the controller from there');

        $src = $this->render($this->createForm())->filter('script')->attr('src');
        // Symfony 6.4.0 also appends the version of the default package
        self::assertMatchesRegularExpression('#^/assets/bundles/silarhicap/cap-[\w-]+\.js(\?v1)?$#', (string) $src);
    }

    public function testRendersTheOptions(): void
    {
        self::bootKernel();

        $crawler = $this->render($this->createForm([
            'required' => false,
            'locale' => 'de',
            'worker_count' => 4,
            'troubleshooting_url' => 'https://example.com/help',
            'i18n' => ['initial-state' => 'Am I human?', 'solved-label' => 'Yes'],
            'csp_nonce' => 'n0nce',
            'attr' => ['class' => 'my-cap', 'data-controller' => 'other'],
        ]));
        $widget = $crawler->filter('cap-widget');

        self::assertNull($widget->attr('required'));
        self::assertSame('de', $widget->attr('data-cap-lang'));
        self::assertSame('4', $widget->attr('data-cap-worker-count'));
        self::assertSame('https://example.com/help', $widget->attr('data-cap-troubleshooting-url'));
        self::assertSame('Am I human?', $widget->attr('data-cap-i18n-initial-state'));
        self::assertSame('Yes', $widget->attr('data-cap-i18n-solved-label'));
        self::assertSame('n0nce', $widget->attr('data-silarhi-cap-nonce'));
        self::assertSame('my-cap', $widget->attr('class'));
        self::assertSame('other silarhi--cap-bundle--cap', $widget->attr('data-controller'));
        self::assertSame('n0nce', $crawler->filter('script')->attr('nonce'));
    }

    public function testRendersAnInvisibleChallengeAsAHiddenInput(): void
    {
        self::bootKernel();

        $crawler = $this->render($this->createForm(['mode' => CapMode::Invisible]));
        $input = $crawler->filter('input[name="form[cap]"]');

        self::assertCount(0, $crawler->filter('cap-widget'));
        self::assertCount(1, $input);
        self::assertSame('hidden', $input->attr('type'));
        self::assertSame('invisible', $input->attr('data-silarhi-cap'));
        self::assertSame('https://cap.example.com/site-key/', $input->attr('data-cap-api-endpoint'));
        self::assertNull($input->attr('required'));
        self::assertCount(1, $crawler->filter('script[type="module"]'));
    }

    public function testAcceptsTheModeAsAString(): void
    {
        self::bootKernel();

        $crawler = $this->render($this->createForm(['mode' => 'invisible']));

        self::assertSame('invisible', $crawler->filter('input[name="form[cap]"]')->attr('data-silarhi-cap'));
    }

    public function testRejectsAnUnknownMode(): void
    {
        self::bootKernel();

        $this->expectException(InvalidOptionsException::class);

        $this->createForm(['mode' => 'floating']);
    }

    public function testAcceptsATokenTheServerAccepts(): void
    {
        self::bootKernel();
        $this->mockCapServer(['success' => true]);

        $form = $this->createForm();
        $form->submit(['name' => 'Jane', 'cap' => 'site-key:abc:def']);

        self::assertTrue($form->isValid());
        self::assertSame([[
            'url' => 'https://cap.example.com/site-key/siteverify',
            'body' => '{"secret":"secret","response":"site-key:abc:def"}',
        ]], $this->capServer()->requests);
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string|null, string, string}>
     */
    public static function provideRejections(): iterable
    {
        yield 'rejected, in English' => [['success' => false, 'error' => 'Token expired'], 'site-key:abc:def', 'en', 'The human verification failed, please try again.'];
        yield 'rejected, in French' => [['success' => false, 'error' => 'Token expired'], 'site-key:abc:def', 'fr', 'La vérification anti-robot a échoué, veuillez réessayer.'];
        yield 'missing, in French' => [['success' => true], null, 'fr', 'Veuillez vérifier que vous êtes humain.'];
    }

    /**
     * @param array<string, mixed> $answer
     */
    #[DataProvider('provideRejections')]
    public function testRejections(array $answer, ?string $token, string $locale, string $message): void
    {
        self::bootKernel();
        $this->mockCapServer($answer);
        $translator = self::getContainer()->get('test.translator');
        self::assertInstanceOf(LocaleAwareInterface::class, $translator);
        $translator->setLocale($locale);

        $form = $this->createForm();
        $form->submit(['name' => 'Jane', 'cap' => $token]);

        self::assertFalse($form->isValid());
        $errors = $form->get('cap')->getErrors();
        self::assertCount(1, $errors);
        self::assertSame($message, $errors[0]->getMessage());
        self::assertCount(0, $form->getErrors(), 'The error stays on the field, next to the widget');
    }

    public function testTheConstraintProtectsAnyObject(): void
    {
        self::bootKernel();
        $this->mockCapServer(['success' => false, 'error' => 'Token not found']);

        $message = new class {
            #[Cap]
            public ?string $token = 'site-key:abc:def';
        };

        $validator = self::getContainer()->get('test.validator');
        self::assertInstanceOf(ValidatorInterface::class, $validator);
        $violations = $validator->validate($message);

        self::assertCount(1, $violations);
        self::assertSame(Cap::INVALID_ERROR, $violations[0]?->getCode());
    }

    public function testRendersNothingAndAcceptsEverythingWhenDisabled(): void
    {
        self::bootKernel(['environment' => 'disabled']);
        $this->mockCapServer(['success' => false]);

        $crawler = $this->render($this->createForm());
        self::assertCount(0, $crawler->filter('cap-widget, script, input[name="form[cap]"]'));

        $form = $this->createForm();
        $form->submit(['name' => 'Jane']);
        self::assertTrue($form->isValid());
        self::assertSame([], $this->capServer()->requests);
    }

    public function testCustomConfiguration(): void
    {
        self::bootKernel(['environment' => 'custom']);
        $this->mockCapServer(['success' => true]);

        $crawler = $this->render($this->createForm());
        $widget = $crawler->filter('cap-widget');

        self::assertCount(0, $crawler->filter('script'));
        // The Stimulus controller loads the widget when the bundle's script is not rendered
        self::assertSame('https://cap.example.com/assets/widget.js', $widget->attr('data-silarhi-cap-script'));
        self::assertSame('/cap/cap_wasm_bg.wasm?v1', $widget->attr('data-silarhi-cap-wasm-url'));
        self::assertNull($widget->attr('data-silarhi-cap-hashwx-url'), 'null leaves the widget to its default');
        self::assertSame('turbo', $widget->attr('data-silarhi-cap-adapters'));

        $form = $this->createForm();
        $form->submit(['name' => 'Jane', 'cap' => 'site-key:abc:def']);
        self::assertTrue($form->isValid());
        self::assertSame('http://cap:3000/site-key/siteverify', $this->capServer()->requests[0]['url'] ?? null);
    }

    public function testReadsTheEndpointAndTheSecretKeyFromEnvVarsByDefault(): void
    {
        $_SERVER['CAP_ENDPOINT'] = 'https://cap.example.com/env-key/';
        $_SERVER['CAP_SECRET_KEY'] = 'env-secret';

        try {
            self::bootKernel(['environment' => 'env']);
            $this->mockCapServer(['success' => true]);

            $crawler = $this->render($this->createForm());
            self::assertSame('https://cap.example.com/env-key/', $crawler->filter('cap-widget')->attr('data-cap-api-endpoint'));

            $form = $this->createForm();
            $form->submit(['name' => 'Jane', 'cap' => 'env-key:abc:def']);
            self::assertTrue($form->isValid());
            self::assertSame([[
                'url' => 'https://cap.example.com/env-key/siteverify',
                'body' => '{"secret":"env-secret","response":"env-key:abc:def"}',
            ]], $this->capServer()->requests);
        } finally {
            unset($_SERVER['CAP_ENDPOINT'], $_SERVER['CAP_SECRET_KEY']);
        }
    }

    /**
     * @param array<string, mixed> $options
     *
     * @return FormInterface<mixed>
     */
    private function createForm(array $options = []): FormInterface
    {
        $factory = self::getContainer()->get('test.form.factory');
        self::assertInstanceOf(FormFactoryInterface::class, $factory);

        return $factory->createBuilder(FormType::class)
            ->add('name', TextType::class)
            ->add('cap', CapType::class, $options)
            ->getForm();
    }

    /**
     * @param FormInterface<mixed> $form
     */
    private function render(FormInterface $form): Crawler
    {
        $twig = self::getContainer()->get('test.twig');
        self::assertInstanceOf(Environment::class, $twig);

        $html = $twig->createTemplate('{{ form_widget(form.cap) }}')->render(['form' => $form->createView()]);

        return new Crawler('<html><body>' . $html . '</body></html>');
    }

    private function pushRequest(string $locale): void
    {
        $request = Request::create('/contact');
        $request->setLocale($locale);

        $requestStack = self::getContainer()->get('test.request_stack');
        self::assertInstanceOf(RequestStack::class, $requestStack);
        $requestStack->push($request);
    }

    /**
     * @param array<string, mixed> $answer
     */
    private function mockCapServer(array $answer): void
    {
        $this->capServer()->answer($answer);
    }

    private function capServer(): CapServerMock
    {
        $server = self::getContainer()->get('test.cap_server');
        self::assertInstanceOf(CapServerMock::class, $server);

        return $server;
    }
}
