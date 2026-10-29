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

use PHPUnit\Framework\TestCase;
use Silarhi\CapBundle\Form\CapType;
use Symfony\Component\Form\Forms;

final class CapTypeTest extends TestCase
{
    public function testServesTheWidgetFromTheWebRootWithoutTheAssetComponent(): void
    {
        $type = new CapType(
            'https://cap.example.com/site-key',
            widgetScript: CapType::WIDGET_SCRIPT_PATH,
            wasmUrl: '/cap/cap_wasm_bg.wasm',
            hashwxUrl: 'https://cdn.example.com/hashwx.wasm',
        );

        $view = Forms::createFormFactoryBuilder()->addType($type)->getFormFactory()->create(CapType::class)->createView();

        self::assertSame('/bundles/silarhicap/cap.js', $view->vars['script_url']);
        self::assertSame('/bundles/silarhicap/widget/cap.min.js', $view->vars['widget_script']);
        self::assertSame('/cap/cap_wasm_bg.wasm', $view->vars['wasm_url']);
        self::assertSame('https://cdn.example.com/hashwx.wasm', $view->vars['hashwx_url']);
    }
}
