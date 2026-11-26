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
use Psr\Container\ContainerInterface;
use Silarhi\CapBundle\Verifier\CapVerifierInterface;
use Silarhi\CapBundle\Verifier\VerificationResult;

use function sprintf;

use Stringable;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\ConstraintDefinitionException;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;
use Symfony\Contracts\Service\ResetInterface;

/**
 * Resettable: long-running workers (FrankenPHP, RoadRunner, Swoole) keep the service between requests, and
 * getLastResult() must not leak the answer to another visitor's submission.
 */
final class CapValidator extends ConstraintValidator implements ResetInterface
{
    private ?VerificationResult $lastResult = null;

    /**
     * @param CapVerifierInterface    $verifier  the verifier of the default site key
     * @param bool                    $enabled   false (e.g. in the test environment) accepts every value without calling
     *                                           the Cap server
     * @param ContainerInterface|null $verifiers the verifiers of the other site keys, by name (Cap::$siteKey)
     */
    public function __construct(
        private readonly CapVerifierInterface $verifier,
        private readonly bool $enabled = true,
        private readonly ?ContainerInterface $verifiers = null,
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

        $this->lastResult = $this->getVerifier($constraint->siteKey)->verify($token);

        if (!$this->lastResult->success) {
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ error }}', $this->formatValue($this->lastResult->error))
                ->setCode(Cap::INVALID_ERROR)
                ->addViolation();
        }
    }

    private function getVerifier(?string $siteKey): CapVerifierInterface
    {
        if (null === $siteKey) {
            return $this->verifier;
        }

        $verifier = true === $this->verifiers?->has($siteKey) ? $this->verifiers->get($siteKey) : null;
        if (!$verifier instanceof CapVerifierInterface) {
            throw new ConstraintDefinitionException(sprintf('The Cap site key "%s" is not configured: add it to "cap.site_keys".', $siteKey));
        }

        return $verifier;
    }

    /**
     * The answer of the Cap server to the last token validated, null when none was sent: to log why a submission failed.
     */
    public function getLastResult(): ?VerificationResult
    {
        return $this->lastResult;
    }

    #[Override]
    public function reset(): void
    {
        $this->lastResult = null;
    }
}
