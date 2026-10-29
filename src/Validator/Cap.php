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

use Attribute;
use Symfony\Component\Validator\Attribute\HasNamedArguments;
use Symfony\Component\Validator\Constraint;

/**
 * The value is a Cap token that the Cap server accepts.
 *
 * CapType adds it by default; put it on a property or a DTO yourself to protect a JSON endpoint.
 */
#[Attribute(Attribute::TARGET_PROPERTY | Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
final class Cap extends Constraint
{
    public const MISSING_ERROR = 'b1b5a2f4-3c1e-4d55-9a8e-6f2f1c0f6a21';

    public const INVALID_ERROR = '5d0e6c3a-8f9b-4b7e-a1d2-4c6e9b3f7a10';

    protected const ERROR_NAMES = [
        self::MISSING_ERROR => 'MISSING_ERROR',
        self::INVALID_ERROR => 'INVALID_ERROR',
    ];

    public string $missingMessage = 'cap.validation.missing';

    public string $message = 'cap.validation.invalid';

    /**
     * @param string[]|null $groups
     */
    #[HasNamedArguments]
    public function __construct(
        ?string $message = null,
        ?string $missingMessage = null,
        ?array $groups = null,
        mixed $payload = null,
    ) {
        parent::__construct(null, $groups, $payload);

        $this->message = $message ?? $this->message;
        $this->missingMessage = $missingMessage ?? $this->missingMessage;
    }
}
