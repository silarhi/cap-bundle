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

namespace Silarhi\CapBundle\Tests\Validator;

use Override;
use Silarhi\CapBundle\Validator\Cap;
use Silarhi\CapBundle\Validator\CapValidator;
use Silarhi\CapBundle\Verifier\CapVerifierInterface;
use Silarhi\CapBundle\Verifier\VerificationResult;
use stdClass;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;
use Symfony\Component\Validator\Test\ConstraintValidatorTestCase;

/**
 * @extends ConstraintValidatorTestCase<CapValidator>
 */
final class CapValidatorTest extends ConstraintValidatorTestCase
{
    /** @var list<string> */
    private array $verified = [];

    private VerificationResult $result;

    #[Override]
    protected function setUp(): void
    {
        $this->result = VerificationResult::success();

        parent::setUp();
    }

    #[Override]
    protected function createValidator(): CapValidator
    {
        return new CapValidator($this->verifier());
    }

    public function testAcceptsATokenTheServerAccepts(): void
    {
        $this->validator->validate('key:abc:def', new Cap());

        $this->assertNoViolation();
        self::assertSame(['key:abc:def'], $this->verified);
        self::assertTrue($this->validator->getLastResult()?->success);
    }

    public function testRejectsATokenTheServerRejects(): void
    {
        $this->result = VerificationResult::failure('Token expired');

        $this->validator->validate(' key:abc:def ', new Cap(message: 'Nope ({{ error }})'));

        $this->buildViolation('Nope ({{ error }})')
            ->setParameter('{{ error }}', '"Token expired"')
            ->setCode(Cap::INVALID_ERROR)
            ->assertRaised();
        self::assertSame(['key:abc:def'], $this->verified);
    }

    public function testRejectsAMissingTokenWithoutCallingTheServer(): void
    {
        $this->validator->validate(null, new Cap());

        $this->buildViolation('cap.validation.missing')
            ->setCode(Cap::MISSING_ERROR)
            ->assertRaised();
        self::assertSame([], $this->verified);
        self::assertNull($this->validator->getLastResult());
    }

    public function testAcceptsAnythingWhenDisabled(): void
    {
        // Returns before reading the context: no need to initialize it
        (new CapValidator($this->verifier(), false))->validate(null, new Cap());

        $this->assertNoViolation();
        self::assertSame([], $this->verified);
    }

    public function testRejectsOtherConstraints(): void
    {
        $this->expectException(UnexpectedTypeException::class);

        $this->validator->validate('token', new NotBlank());
    }

    public function testRejectsValuesThatAreNotStrings(): void
    {
        $this->expectException(UnexpectedValueException::class);

        $this->validator->validate(new stdClass(), new Cap());
    }

    private function verifier(): CapVerifierInterface
    {
        return new class($this) implements CapVerifierInterface {
            public function __construct(private readonly CapValidatorTest $test)
            {
            }

            public function verify(string $token): VerificationResult
            {
                return $this->test->record($token);
            }
        };
    }

    /**
     * @internal
     */
    public function record(string $token): VerificationResult
    {
        $this->verified[] = $token;

        return $this->result;
    }
}
