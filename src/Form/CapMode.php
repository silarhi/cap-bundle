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

/**
 * How CapType shows the Cap challenge.
 */
enum CapMode: string
{
    /** The Cap widget: a checkbox the visitor ticks, solved in the background as soon as they interact with the page. */
    case Checkbox = 'checkbox';

    /** Nothing visible: the challenge is solved when the visitor starts filling the form, or when they submit it. */
    case Invisible = 'invisible';
}
