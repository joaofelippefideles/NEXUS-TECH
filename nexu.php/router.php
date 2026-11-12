<?php
/**
 * Roteador para o servidor embutido do PHP:
 *   php -S localhost:8000 router.php
 */

declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$uri = '/' . ltrim(str_replace('\\', '/', rawurldecode($uri)), '/');

if (
    preg_match('#^/(includes|database|logs|tests)(/|$)#', $uri) === 1
    || str_contains($uri, '..')
    || str_contains($uri, "\0")
    || str_starts_with(basename($uri), '.')
) {
    http_response_code(404);
    echo 'Not Found';
    return true;
}

$path = __DIR__ . $uri;

if ($uri === '/' || str_ends_with($uri, '/')) {
    $index = rtrim($path, '/\\') . '/index.php';
    if (is_file($index)) {
        require $index;
        return true;
    }
}

if (is_file($path)) {
    if (str_ends_with($path, '.php')) {
        require $path;
        return true;
    }

    return false;
}

if (is_file($path . '.php')) {
    require $path . '.php';
    return true;
}

http_response_code(404);
header('Content-Type: text/html; charset=UTF-8');
echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>404 — Nexus Tech</title></head>'
    . '<body><h1>404</h1><p>Página não encontrada.</p><p><a href="/index.php">Voltar para a loja</a></p></body></html>';
return true;
