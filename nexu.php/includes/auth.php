<?php
/**
 * ==========================================================================
 * NEXUS TECH (versão PHP) — Autenticação por sessão
 * ==========================================================================
 * Cliente e administrador usam sessões separadas (`user_id` / `admin_id`).
 */

declare(strict_types=1);

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/db.php';

/**
 * Usuário cliente autenticado (ou null).
 *
 * @return array<string, mixed>|null
 */
function nx_current_user(): ?array
{
    nx_session_start();
    $id = $_SESSION['user_id'] ?? null;

    if (!is_int($id) || $id <= 0) {
        return null;
    }

    static $cache = [];
    if (array_key_exists($id, $cache)) {
        return $cache[$id];
    }

    $user = nx_one(
        'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
        [$id]
    );

    if ($user === null || (int) $user['is_active'] !== 1) {
        unset($_SESSION['user_id']);
        return $cache[$id] = null;
    }

    return $cache[$id] = $user;
}

/**
 * Verifica e-mail/senha e devolve o usuário autenticável.
 *
 * @return array<string, mixed>|null
 */
function nx_authenticate_user(string $email, string $password): ?array
{
    $user = nx_one(
        'SELECT id, name, email, password_hash, role, is_active
           FROM users
          WHERE email = ?
          LIMIT 1',
        [$email]
    );

    if ($user === null || (int) $user['is_active'] !== 1) {
        return null;
    }

    if (!password_verify($password, (string) $user['password_hash'])) {
        return null;
    }

    unset($user['password_hash']);

    return $user;
}

/**
 * Verifica credenciais de administrador (role = admin).
 *
 * @return array<string, mixed>|null
 */
function nx_authenticate_admin(string $email, string $password): ?array
{
    $admin = nx_authenticate_user($email, $password);

    if ($admin === null || ($admin['role'] ?? '') !== 'admin') {
        return null;
    }

    return $admin;
}

/**
 * Registra o login do cliente.
 *
 * @param array<string, mixed> $user
 */
function nx_login_user(array $user): void
{
    nx_session_start();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    unset($_SESSION['admin_id']);
}

/**
 * Encerra a sessão do cliente.
 */
function nx_logout_user(): void
{
    nx_session_start();
    unset($_SESSION['user_id']);
    session_regenerate_id(true);
}

/**
 * Exige cliente autenticado; redireciona para o login preservando o destino.
 */
function nx_require_login(string $next = 'perfil.php'): array
{
    $user = nx_current_user();

    if ($user === null) {
        nx_redirect('login.php?next=' . rawurlencode($next));
    }

    return $user;
}

/**
 * Administrador autenticado (ou null).
 *
 * @return array<string, mixed>|null
 */
function nx_current_admin(): ?array
{
    nx_session_start();
    $id = $_SESSION['admin_id'] ?? null;

    if (!is_int($id) || $id <= 0) {
        return null;
    }

    static $cache = [];
    if (array_key_exists($id, $cache)) {
        return $cache[$id];
    }

    $admin = nx_one(
        "SELECT id, name, email, role, is_active, created_at
           FROM users
          WHERE id = ? AND role = 'admin'
          LIMIT 1",
        [$id]
    );

    if ($admin === null || (int) $admin['is_active'] !== 1) {
        unset($_SESSION['admin_id']);
        return $cache[$id] = null;
    }

    return $cache[$id] = $admin;
}

/**
 * Registra o login do administrador.
 *
 * @param array<string, mixed> $admin
 */
function nx_login_admin(array $admin): void
{
    nx_session_start();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
}

/**
 * Encerra a sessão do administrador.
 */
function nx_logout_admin(): void
{
    nx_session_start();
    unset($_SESSION['admin_id']);
    session_regenerate_id(true);
}

/**
 * Exige administrador autenticado; redireciona para a tela de login.
 */
function nx_require_admin(): array
{
    $admin = nx_current_admin();

    if ($admin === null) {
        nx_redirect('login.php');
    }

    return $admin;
}
