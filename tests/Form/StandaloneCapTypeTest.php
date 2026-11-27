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

namespace Silarhi\CapBundle\Tests\Form;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Silarhi\CapBundle\Form\CapType;
use Silarhi\CapBundle\Tests\Fixtures\ServiceLocator;
use Silarhi\CapBundle\Validator\CapValidator;
use Silarhi\CapBundle\Verifier\TestCapVerifier;
use Symfony\Component\Form\Extension\Core\Type\FormType;
use Symfony\Component\Form\Extension\Validator\ValidatorExtension;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\Forms;
use Symfony\Component\Validator\ConstraintValidatorFactory;
use Symfony\Component\Validator\Validation;

/**
 * The form type and the validator built by hand, as an application without the bundle (nor
 * symfony/dependency-injection) does.
 */
final class StandaloneCapTypeTest extends TestCase
{
    /**
     * @return iterable<string, array{string|null, string, list<string>}>
     */
    public static function provideSubmissions(): iterable
    {
        yield 'accepted token' => [null, 'default-token', []];
        yield 'rejected token' => [null, 'signup-token', ['cap.validation.invalid']];
        yield 'no token' => [null, '', ['cap.validation.missing']];
        yield 'token of another site key' => ['signup', 'signup-token', []];
    }

    /**
     * @param list<string> $errors
     */
    #[DataProvider('provideSubmissions')]
    public function testValidatesTheTokenOnSubmit(?string $siteKey, string $token, array $errors): void
    {
        $form = $this->createFormFactory()->createBuilder(FormType::class)
            ->add('captcha', CapType::class, ['site_key' => $siteKey])
            ->getForm();

        $form->submit(['captcha' => $token]);

        self::assertTrue($form->isSynchronized());
        $messages = [];
        foreach ($form->get('captcha')->getErrors() as $error) {
            $messages[] = $error->getMessageTemplate();
        }
        self::assertSame($errors, $messages);
    }

    public function testRendersTheEndpointOfTheSiteKey(): void
    {
        $view = $this->createFormFactory()->create(CapType::class, null, ['site_key' => 'signup'])->createView();

        self::assertSame('https://cap.example.com/signup-key/', $view->vars['endpoint']);
    }

    private function createFormFactory(): FormFactoryInterface
    {
        $signupVerifier = new TestCapVerifier(['signup-token']);
        $capValidator = new CapValidator(
            new TestCapVerifier(['default-token']),
            true,
            new ServiceLocator(['signup' => static fn (): TestCapVerifier => $signupVerifier]),
        );

        $validator = Validation::createValidatorBuilder()
            ->setConstraintValidatorFactory(new ConstraintValidatorFactory([CapValidator::class => $capValidator]))
            ->getValidator();

        return Forms::createFormFactoryBuilder()
            ->addExtension(new ValidatorExtension($validator))
            ->addType(new CapType('https://cap.example.com/default-key', endpoints: ['signup' => 'https://cap.example.com/signup-key']))
            ->getFormFactory();
    }
}
