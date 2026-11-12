<?php
/**
 * NEXUS TECH (versão PHP) — Cabeçalho compartilhado
 *
 * Variáveis esperadas antes do include:
 *   $root      → prefixo até a raiz do projeto ('' na raiz, '../' em pages/)
 *   $active    → item ativo do menu (home, produtos, ofertas, contato)
 *   $pageTitle → título da aba
 *   $pageDesc  → meta description
 *   $bodyPage  → valor de <body data-page="...">
 */

declare(strict_types=1);

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/cart.php';

$root = isset($root) && is_string($root) ? $root : '../';
$active = isset($active) && is_string($active) ? $active : '';
$pageTitle = isset($pageTitle) && is_string($pageTitle) ? $pageTitle : 'Nexus Tech';
$pageDesc = isset($pageDesc) && is_string($pageDesc) ? $pageDesc : 'Loja online de tecnologia e informática.';
$bodyPage = isset($bodyPage) && is_string($bodyPage) ? $bodyPage : '';

$home = $root . 'index.php';
$pages = $root . 'pages/';
$currentUser = nx_current_user();
$cartCount = nx_cart_count();

$navItem = static function (string $key, string $href, string $label, bool $section = false) use ($active, $home): string {
    $isActive = $active === $key ? ' is-active' : '';
    $current = $active === $key ? ' aria-current="page"' : '';
    $href = $section ? $home . $href : $href;
    return '<li><a href="' . e($href) . '" class="main-nav__link' . $isActive . '"' . $current . '>' . e($label) . '</a></li>';
};
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title><?= e($pageTitle) ?></title>
  <meta name="description" content="<?= e($pageDesc) ?>">
  <meta property="og:title" content="<?= e($pageTitle) ?>">
  <meta property="og:type" content="website">
  <meta property="og:description" content="<?= e($pageDesc) ?>">

  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%2306b6d4'>N</text></svg>">
  <link rel="stylesheet" href="<?= e($root) ?>assets/css/style.css">
<?= $extraHead ?? '' ?>
</head>
<body data-page="<?= e($bodyPage) ?>">

  <header class="site-header" id="site-header">
    <div class="container site-header__inner">

      <button
        type="button"
        class="nav-toggle"
        id="nav-toggle"
        aria-label="Abrir menu"
        aria-expanded="false"
        aria-controls="main-nav"
      >
        <span class="nav-toggle__bar"></span>
        <span class="nav-toggle__bar"></span>
        <span class="nav-toggle__bar"></span>
      </button>

      <a href="<?= e($home) ?>" class="site-header__logo" aria-label="Nexus Tech — Página inicial">
        <span class="site-header__logo-mark">NEXUS</span>
        <span class="site-header__logo-accent">TECH</span>
      </a>

      <nav class="main-nav" id="main-nav" aria-label="Menu principal">
        <ul class="main-nav__list">
          <?= $navItem('home', $home, 'Home') ?>
          <?= $navItem('produtos', $pages . 'produtos.php', 'Produtos') ?>
          <?= $navItem('ofertas', '#ofertas', 'Ofertas', true) ?>
          <?= $navItem('contato', $pages . 'contato.php', 'Contato') ?>
        </ul>
      </nav>

      <form class="site-header__search search" role="search" aria-label="Buscar produtos" action="<?= e($pages . 'produtos.php') ?>" method="get">
        <span class="search__icon" aria-hidden="true">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <label class="sr-only" for="search-header">Buscar produtos, marcas e categorias</label>
        <input
          type="search"
          id="search-header"
          name="q"
          class="search__input"
          placeholder="Buscar produtos, marcas e categorias..."
          autocomplete="off"
          value="<?= e(nx_get('q')) ?>"
        >
        <button type="submit" class="search__btn">Buscar</button>
      </form>

      <div class="site-header__actions">

        <a href="<?= e($pages . 'produtos.php?sort=rating-desc') ?>" class="icon-btn" aria-label="Mais bem avaliados">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span class="icon-btn__label">Favoritos</span>
        </a>

        <a href="<?= e($pages . 'carrinho.php') ?>" class="icon-btn" aria-label="Carrinho de compras">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span class="icon-btn__count" id="cart-count" aria-hidden="true"><?= $cartCount ?></span>
          <span class="icon-btn__label">Carrinho</span>
        </a>

        <a href="<?= e($pages . ($currentUser !== null ? 'perfil.php' : 'login.php')) ?>" class="icon-btn icon-btn__label--account" aria-label="Minha conta">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="icon-btn__label"><?= $currentUser !== null ? 'Minha conta' : 'Entrar' ?></span>
        </a>

      </div>
    </div>
  </header>
