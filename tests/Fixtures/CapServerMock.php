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

namespace Silarhi\CapBundle\Tests\Fixtures;

use function is_string;

use Symfony\Component\HttpClient\Response\JsonMockResponse;

/**
 * The Cap server of the functional tests: framework.http_client.mock_response_factory, so that requests go through
 * the default psr18.http_client like in an application.
 */
final class CapServerMock
{
    /** @var list<array{url: string, body: string}> */
    public array $requests = [];

    /** @var array<string, mixed> */
    private array $answer = ['success' => true];

    /**
     * @param array<string, mixed> $answer
     */
    public function answer(array $answer): void
    {
        $this->answer = $answer;
    }

    /**
     * @param array<string, mixed> $options
     */
    public function __invoke(string $method, string $url, array $options): JsonMockResponse
    {
        $body = $options['body'] ?? '';
        $this->requests[] = ['url' => $url, 'body' => is_string($body) ? $body : ''];

        return new JsonMockResponse($this->answer, ['http_code' => true === ($this->answer['success'] ?? null) ? 200 : 404]);
    }
}
