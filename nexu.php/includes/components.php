<?php
/**
 * NEXUS TECH (versão PHP) — Componentes de interface reutilizáveis
 */

declare(strict_types=1);

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/repository.php';

/**
 * Placeholder ilustrativo em SVG (gradiente + inicial).
 */
function nx_placeholder_svg(int $id, string $letter, int $variant = 0, string $class = ''): string
{
    $palette = [
        ['#0e7490', '#6d28d9'],
        ['#155e75', '#0891b2'],
        ['#6d28d9', '#f59e0b'],
    ];
    $colors = $palette[$variant % count($palette)];
    $gradientId = 'ph' . $id . '-' . $variant;
    $letter = mb_strtoupper(mb_substr($letter !== '' ? $letter : '?', 0, 1));
    $classAttr = $class !== '' ? ' class="' . e($class) . '"' : '';

    return '<svg' . $classAttr . ' viewBox="0 0 240 240" role="img" aria-label="Imagem ilustrativa">'
        . '<defs><linearGradient id="' . $gradientId . '" x1="0" y1="0" x2="1" y2="1">'
        . '<stop offset="0%" stop-color="' . $colors[0] . '"></stop>'
        . '<stop offset="100%" stop-color="' . $colors[1] . '"></stop>'
        . '</linearGradient></defs>'
        . '<rect width="240" height="240" fill="url(#' . $gradientId . ')"></rect>'
        . '<text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"'
        . ' font-size="88" font-weight="900" font-family="Rajdhani, sans-serif"'
        . ' fill="rgba(255,255,255,0.95)">' . e($letter) . '</text>'
        . '</svg>';
}

/**
 * Estrelas de avaliação (cheias + vazias).
 */
function nx_stars(float $rating): string
{
    $full = max(0, min(5, (int) round($rating)));

    return str_repeat('★', $full) . str_repeat('☆', 5 - $full);
}

/**
 * Badges de um produto (desconto, novo, mais vendido).
 *
 * @param array<string, mixed> $product
 * @return array<int, array{text: string, kind: string}>
 */
function nx_product_badges(array $product): array
{
    $badges = [];
    $discount = nx_discount_percent($product);

    if ($discount > 0) {
        $badges[] = ['text' => '-' . $discount . '%', 'kind' => 'discount'];
    }
    if ((int) ($product['is_new'] ?? 0) === 1) {
        $badges[] = ['text' => 'Novo', 'kind' => 'new'];
    }
    if ((int) ($product['is_bestseller'] ?? 0) === 1) {
        $badges[] = ['text' => 'Mais vendido', 'kind' => 'bestseller'];
    }

    return $badges;
}

/**
 * Cartão de produto com link e formulário de adicionar ao carrinho.
 *
 * @param array<string, mixed> $product
 */
function nx_product_card(array $product, string $root = '../'): string
{
    $slug = (string) ($product['slug'] ?? '');
    $name = (string) ($product['name'] ?? '');
    $url = $root . 'pages/produto.php?slug=' . urlencode($slug);
    $stock = (int) ($product['stock'] ?? 0);
    $html = '<article class="product-card" aria-label="' . e($name) . '">';

    $html .= '<div class="product-card__media">';
    $badges = nx_product_badges($product);
    if ($badges !== []) {
        $html .= '<div class="product-card__badges">';
        foreach ($badges as $badge) {
            $html .= '<span class="badge badge--' . e($badge['kind']) . '">' . e($badge['text']) . '</span>';
        }
        $html .= '</div>';
    }
    $html .= '<span class="product-card__placeholder" aria-hidden="true">' . e(nx_product_initial($product)) . '</span>';
    $html .= '</div>';

    $html .= '<div class="product-card__body">';
    $html .= '<span class="product-card__brand">' . e((string) ($product['brand'] ?? '')) . '</span>';
    $html .= '<h3 class="product-card__name"><a href="' . e($url) . '">' . e($name) . '</a></h3>';

    $html .= '<div class="rating">';
    $html .= '<span class="rating__stars" aria-hidden="true">' . nx_stars((float) $product['rating']) . '</span>';
    $html .= '<span class="rating__value">' . e(number_format((float) $product['rating'], 1, ',', '')) . '</span>';
    $html .= '<span class="rating__count">(' . (int) $product['rating_count'] . ')</span>';
    $html .= '</div>';

    $html .= '<div class="product-card__price">';
    if (!empty($product['old_price_cents'])) {
        $html .= '<span class="product-card__price-old">' . e(nx_money((int) $product['old_price_cents'])) . '</span>';
    }
    $html .= '<span class="product-card__price-current">' . e(nx_money((int) $product['price_cents'])) . '</span>';
    $html .= '</div>';

    $html .= '<p class="product-card__stock ' . ($stock > 0 ? 'product-card__stock--ok' : 'product-card__stock--out') . '">'
        . ($stock > 0 ? 'Em estoque' : 'Esgotado') . '</p>';

    $html .= '<div class="product-card__actions product-card__actions--split">';
    $html .= '<a href="' . e($url) . '" class="btn btn--outline">Ver produto</a>';
    $html .= '<form action="' . e($root . 'pages/carrinho.php') . '" method="post" class="product-card__cart-form">';
    $html .= nx_csrf_field();
    $html .= '<input type="hidden" name="action" value="add">';
    $html .= '<input type="hidden" name="product_id" value="' . (int) $product['id'] . '">';
    $html .= '<input type="hidden" name="quantity" value="1">';
    if ($stock > 0) {
        $html .= '<button type="submit" class="btn btn--primary" aria-label="Adicionar ' . e($name) . ' ao carrinho">Adicionar</button>';
    } else {
        $html .= '<button type="button" class="btn btn--primary" disabled>Esgotado</button>';
    }
    $html .= '</form>';
    $html .= '</div>';

    $html .= '</div></article>';

    return $html;
}

/**
 * Renderiza um grid de produtos.
 *
 * @param array<int, array<string, mixed>> $products
 */
function nx_product_grid(array $products, string $root = '../'): string
{
    $html = '';
    foreach ($products as $product) {
        $html .= nx_product_card($product, $root);
    }

    return $html;
}

/**
 * Exibe mensagens flash pendentes.
 */
function nx_render_flash(): string
{
    foreach (['success', 'error', 'warning', 'info'] as $kind) {
        $message = nx_flash_get($kind);
        if (is_string($message) && $message !== '') {
            $class = $kind === 'error' ? 'danger' : $kind;
            return '<div class="alert alert--' . e($class) . '" role="status">' . e($message) . '</div>';
        }
    }

    return '';
}

/**
 * Exibe mensagens flash com o estilo do painel administrativo.
 */
function nx_render_admin_flash(): string
{
    foreach (['success', 'error', 'warning', 'info'] as $kind) {
        $message = nx_flash_get($kind);
        if (is_string($message) && $message !== '') {
            $class = match ($kind) {
                'error' => 'danger',
                'info' => 'success',
                default => $kind,
            };
            return '<div class="admin-alert admin-alert--' . e($class) . '" role="status">' . e($message) . '</div>';
        }
    }

    return '';
}

/**
 * Bloco de erros de validação.
 *
 * @param array<int, string> $errors
 */
function nx_render_errors(array $errors): string
{
    if ($errors === []) {
        return '';
    }

    $html = '<div class="alert alert--danger" role="alert"><ul class="alert__list">';
    foreach ($errors as $error) {
        $html .= '<li>' . e($error) . '</li>';
    }
    $html .= '</ul></div>';

    return $html;
}
