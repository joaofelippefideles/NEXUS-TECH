<?php
/**
 * NEXUS TECH (versão PHP) — Logout do administrador
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    nx_redirect('index.php');
}

nx_require_csrf();
nx_logout_admin();
nx_redirect('login.php');
