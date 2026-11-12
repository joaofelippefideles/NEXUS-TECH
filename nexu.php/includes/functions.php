<?php
/**
 * ==========================================================================
 * NEXUS TECH (versão PHP) — Funções compartilhadas
 * ==========================================================================
 * Sessão segura, CSRF, flash messages, respostas, sanitização, rate limit,
 * formatação de dinheiro e log de erros (sem dados sensíveis).
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Escapa qualquer valor para uso seguro em HTML (previne XSS).
 */
function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Inicia a sessão com cookies HttpOnly/SameSite.
 */
function nx_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = nx_config();
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');

    session_name((string) $config['security']['session_name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

/**
 * Token CSRF da sessão atual.
 */
function nx_csrf_token(): string
{
    nx_session_start();
    $key = (string) nx_config()['security']['csrf_key'];

    if (empty($_SESSION[$key]) || !is_string($_SESSION[$key])) {
        $_SESSION[$key] = bin2hex(random_bytes(32));
    }

    return $_SESSION[$key];
}

/**
 * Campo oculto pronto para formulários.
 */
function nx_csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(nx_csrf_token()) . '">';
}

/**
 * Valida o token CSRF em tempo constante.
 */
function nx_csrf_valid(?string $token): bool
{
    nx_session_start();
    $key = (string) nx_config()['security']['csrf_key'];

    return is_string($token)
        && $token !== ''
        && isset($_SESSION[$key])
        && is_string($_SESSION[$key])
        && hash_equals($_SESSION[$key], $token);
}

/**
 * Exige CSRF em POST, encerrando com erro 419 se inválido.
 */
function nx_require_csrf(): void
{
    if (!nx_csrf_valid(isset($_POST['csrf_token']) && is_string($_POST['csrf_token']) ? $_POST['csrf_token'] : null)) {
        http_response_code(419);
        echo 'Sessão expirada. Recarregue a página e tente novamente.';
        exit;
    }
}

/**
 * Grava uma mensagem flash.
 */
function nx_flash_set(string $key, mixed $value): void
{
    nx_session_start();
    $_SESSION['_flash'][$key] = $value;
}

/**
 * Lê e remove uma mensagem flash.
 */
function nx_flash_get(string $key, mixed $default = null): mixed
{
    nx_session_start();

    if (!isset($_SESSION['_flash'][$key])) {
        return $default;
    }

    $value = $_SESSION['_flash'][$key];
    unset($_SESSION['_flash'][$key]);

    return $value;
}

/**
 * Redireciona de forma segura (apenas caminho local) e encerra.
 */
function nx_redirect(string $path): never
{
    if (preg_match('#^(https?:)?//#i', $path) === 1) {
        $path = 'index.php';
    }

    header('Location: ' . $path, true, 303);
    exit;
}

/**
 * Lê um valor textual de $_POST/$_GET.
 */
function nx_input(string $key, string $default = '', ?array $source = null): string
{
    $source ??= $_POST;
    $value = $source[$key] ?? $default;

    return is_string($value) ? trim($value) : $default;
}

/**
 * Limita tentativas por chave dentro de uma janela de tempo (sessão).
 */
function nx_rate_limit_exceeded(string $key, int $max, int $windowSeconds): bool
{
    nx_session_start();

    $now = time();
    $bucket = $_SESSION['_rate'][$key] ?? [];
    if (!is_array($bucket)) {
        $bucket = [];
    }

    $bucket = array_values(array_filter(
        $bucket,
        static fn ($timestamp): bool => is_int($timestamp) && $timestamp > ($now - $windowSeconds)
    ));

    if (count($bucket) >= $max) {
        $_SESSION['_rate'][$key] = $bucket;
        return true;
    }

    $bucket[] = $now;
    $_SESSION['_rate'][$key] = $bucket;

    return false;
}

/**
 * Registra uma mensagem de erro no log local.
 */
function nx_log(string $message): void
{
    $config = nx_config();
    $dir = (string) $config['paths']['logs'];

    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $line = sprintf(
        "[%s] %s%s",
        date('Y-m-d H:i:s'),
        str_replace(["\r", "\n"], ' ', $message),
        PHP_EOL
    );

    @file_put_contents($dir . DIRECTORY_SEPARATOR . 'nexus-php.log', $line, FILE_APPEND | LOCK_EX);
}

/**
 * Formata centavos como moeda brasileira: 123456 → "R$ 1.234,56".
 */
function nx_money(int $cents): string
{
    return 'R$ ' . number_format($cents / 100, 2, ',', '.');
}

/**
 * Remove tudo que não for dígito.
 */
function nx_digits(mixed $value): string
{
    return preg_replace('/\D+/', '', (string) $value) ?? '';
}

/**
 * Gera slug ASCII a partir de um texto.
 */
function nx_slugify(string $text, int $max = 140): string
{
    if (class_exists('Normalizer')) {
        $normalized = Normalizer::normalize($text, Normalizer::FORM_KD);
        if (is_string($normalized)) {
            $text = $normalized;
        }
        $text = preg_replace('/\p{Mn}+/u', '', $text) ?? $text;
    } else {
        $text = strtr($text, [
            'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'ä' => 'a', 'å' => 'a',
            'Á' => 'A', 'À' => 'A', 'Ã' => 'A', 'Â' => 'A', 'Ä' => 'A', 'Å' => 'A',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'É' => 'E', 'È' => 'E', 'Ê' => 'E', 'Ë' => 'E',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
            'Í' => 'I', 'Ì' => 'I', 'Î' => 'I', 'Ï' => 'I',
            'ó' => 'o', 'ò' => 'o', 'õ' => 'o', 'ô' => 'o', 'ö' => 'o',
            'Ó' => 'O', 'Ò' => 'O', 'Õ' => 'O', 'Ô' => 'O', 'Ö' => 'O',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'Ú' => 'U', 'Ù' => 'U', 'Û' => 'U', 'Ü' => 'U',
            'ç' => 'c', 'Ç' => 'C', 'ñ' => 'n', 'Ñ' => 'N', 'ý' => 'y', 'ÿ' => 'y',
        ]);
    }

    $slug = strtolower($text);
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = preg_replace('/-{2,}/', '-', $slug) ?? $slug;
    $slug = trim($slug, '-');

    return substr($slug, 0, $max);
}

/**
 * Formata data vinda do MySQL (Y-m-d H:i:s) para pt-BR.
 */
function nx_datetime(?string $value): string
{
    if ($value === null || $value === '') {
        return '—';
    }

    $timestamp = strtotime($value);

    return $timestamp === false ? e($value) : date('d/m/Y H:i', $timestamp);
}

/**
 * Formata data (sem hora) para pt-BR.
 */
function nx_date(?string $value): string
{
    if ($value === null || $value === '') {
        return '—';
    }

    $timestamp = strtotime($value);

    return $timestamp === false ? e($value) : date('d/m/Y', $timestamp);
}

/**
 * Valor de $_GET como string (ou '' quando ausente/array).
 */
function nx_get(string $key, string $default = ''): string
{
    $value = $_GET[$key] ?? $default;

    return is_string($value) ? trim($value) : $default;
}
