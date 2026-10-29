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

namespace Silarhi\CapBundle\Validator;

use function is_string;

use Override;
use Silarhi\CapBundle\Verifier\CapVerifierInterface;
use Silarhi\CapBundle\Verifier\VerificationResult;
use Stringable;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;

final class CapValidator extends ConstraintValidator
{
    private ?VerificationResult $lastResult = null;

    /**
     * @param bool $enabled false (e.g. in the test environment) accepts every value without calling the Cap server
     */
    public function __construct(
        private readonly CapVerifierInterface $verifier,
        private readonly bool $enabled = true,
    ) {
    }

    #[Override]
    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!$constraint instanceof Cap) {
            throw new UnexpectedTypeException($constraint, Cap::class);
        }

        if (!$this->enabled) {
            return;
        }

        if (null !== $value && !is_string($value) && !$value instanceof Stringable) {
            throw new UnexpectedValueException($value, 'string');
        }

        $token = trim((string) $value);

        if ('' === $token) {
            $this->context->buildViolation($constraint->missingMessage)
                ->setCode(Cap::MISSING_ERROR)
                ->addViolation();

            return;
        }

        $this->lastResult = $this->verifier->verify($token);

        if (!$this->lastResult->success) {
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ error }}', $this->formatValue($this->lastResult->error))
                ->setCode(Cap::INVALID_ERROR)
                ->addViolation();
        }
    }

    /**
     * The answer of the Cap server to the last token validated, null when none was sent: to log why a submission failed.
     */
    public function getLastResult(): ?VerificationResult
    {
        return $this->lastResult;
    }
}
