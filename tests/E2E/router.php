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

/*
 * Router of `php -S` for the end-to-end tests: serves the public/ folder of the bundle under /bundles/silarhicap/, as
 * assets:install would copy it, and hands everything else to the E2E kernel.
 */

use Silarhi\CapBundle\Tests\E2E\E2eKernel;
use Symfony\Component\HttpFoundation\Request;

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = \is_string($uri) ? parse_url($uri, \PHP_URL_PATH) : null;
if (\is_string($path) && str_starts_with($path, '/bundles/silarhicap/')) {
    $public = realpath(__DIR__ . '/../../public');
    $file = realpath(__DIR__ . '/../../public/' . substr($path, \strlen('/bundles/silarhicap/')));
    if (false === $public || false === $file || !str_starts_with($file, $public . \DIRECTORY_SEPARATOR) || !is_file($file)) {
        http_response_code(404);

        return true;
    }

    header('Content-Type: ' . (str_ends_with($file, '.wasm') ? 'application/wasm' : 'text/javascript'));
    readfile($file);

    return true;
}

require __DIR__ . '/../../vendor/autoload.php';

$kernel = new E2eKernel('e2e', false);
$request = Request::createFromGlobals();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
