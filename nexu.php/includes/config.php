<?php
/**
 * ==========================================================================
 * NEXUS TECH (versão PHP) — Configuração central
 * ==========================================================================
 * Os valores podem ser sobrescritos por variáveis de ambiente ou por um
 * arquivo `config.local.php` (não versionado) na mesma pasta.
 */

declare(strict_types=1);

/**
 * Mescla recursivamente arrays (o override vence).
 *
 * @param array<string, mixed> $base
 * @param array<string, mixed> $override
 * @return array<string, mixed>
 */
function nx_array_merge(array $base, array $override): array
{
    foreach ($override as $key => $value) {
        if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
            $base[$key] = nx_array_merge($base[$key], $value);
        } else {
            $base[$key] = $value;
        }
    }

    return $base;
}

/**
 * Configuração memoizada por requisição.
 *
 * @return array<string, mixed>
 */
function nx_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $password = getenv('DB_PASSWORD');

    $config = [
        'app' => [
            'name' => 'Nexus Tech',
            'env' => getenv('APP_ENV') ?: 'development',
        ],
        'db' => [
            'host' => getenv('DB_HOST') ?: '127.0.0.1',
            'port' => (int) (getenv('DB_PORT') ?: 3306),
            'name' => getenv('DB_NAME') ?: 'nexus_tech_db',
            'user' => getenv('DB_USER') ?: 'root',
            'password' => $password === false ? '' : $password,
            'charset' => 'utf8mb4',
        ],
        'security' => [
            'session_name' => 'nexus_php_session',
            'csrf_key' => '_csrf',
            'password_min_length' => 8,
            'password_max_length' => 72,
            'bcrypt_cost' => 12,
            'login_max_attempts' => 10,
            'login_window_seconds' => 15 * 60,
            'register_max_attempts' => 12,
            'register_window_seconds' => 10 * 60,
            'checkout_max_attempts' => 20,
            'checkout_window_seconds' => 10 * 60,
        ],
        'service' => [
            'shipping_cents' => 2990,
            'express_cents' => 4990,
            'free_shipping_min_cents' => 50000,
            'per_page' => 8,
        ],
        'paths' => [
            'logs' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'logs',
        ],
    ];

    $localFile = __DIR__ . DIRECTORY_SEPARATOR . 'config.local.php';
    if (is_file($localFile)) {
        $local = require $localFile;
        if (is_array($local)) {
            $config = nx_array_merge($config, $local);
        }
    }

    return $config;
}
