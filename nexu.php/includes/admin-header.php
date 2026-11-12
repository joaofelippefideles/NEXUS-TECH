<?php
/**
 * NEXUS TECH (versão PHP) — Cabeçalho do painel administrativo
 */

declare(strict_types=1);

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/auth.php';

$admin = nx_require_admin();
$root = '../';
$adminActive = isset($adminActive) && is_string($adminActive) ? $adminActive : 'dashboard';
$pageTitle = isset($pageTitle) && is_string($pageTitle) ? $pageTitle . ' — Nexus Tech Admin' : 'Painel — Nexus Tech Admin';
$bodyPage = isset($bodyPage) && is_string($bodyPage) ? $bodyPage : 'admin-dashboard';

$nav = static function (string $key, string $href, string $label) use ($adminActive): string {
    $current = $adminActive === $key;
    return '<a href="' . e($href) . '" class="admin-nav__link' . ($current ? ' is-active' : '') . '"'
        . ($current ? ' aria-current="page"' : '') . '>' . e($label) . '</a>';
};
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">

  <title><?= e($pageTitle) ?></title>
  <meta name="description" content="Painel administrativo da Nexus Tech.">

  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%2306b6d4'>N</text></svg>">
  <link rel="stylesheet" href="<?= e($root) ?>assets/css/admin.css">
</head>
<body data-page="<?= e($bodyPage) ?>">

  <div class="admin-shell">

    <header class="admin-topbar">
      <a href="index.php" class="admin-topbar__brand" aria-label="Nexus Tech — Painel">
        NEXUS<span class="admin-topbar__brand-accent">TECH</span>
        <span class="admin-topbar__brand-accent"> Admin</span>
      </a>

      <nav class="admin-nav" aria-label="Navegação do painel">
        <?= $nav('dashboard', 'index.php', 'Dashboard') ?>
        <?= $nav('products', 'produtos.php', 'Produtos') ?>
        <?= $nav('brands', 'marcas.php', 'Marcas') ?>
        <?= $nav('categories', 'categorias.php', 'Categorias') ?>
      </nav>

      <div class="admin-topbar__session">
        <span class="admin-topbar__who">
          <span class="admin-topbar__name"><?= e((string) $admin['name']) ?></span>
          <span class="admin-topbar__email"><?= e((string) $admin['email']) ?></span>
        </span>
        <form action="logout.php" method="post" class="admin-topbar__logout-form">
          <?= nx_csrf_field() ?>
          <button type="submit" class="admin-topbar__logout">Sair</button>
        </form>
      </div>
    </header>

    <main class="admin-main">
