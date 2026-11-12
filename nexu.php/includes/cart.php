<?php
/**
 * ==========================================================================
 * NEXUS TECH (versão PHP) — Carrinho em sessão
 * ==========================================================================
 * O carrinho guarda apenas product_id => quantidade. Preços e estoque são
 * sempre lidos do banco no momento de exibir/cobrar.
 */

declare(strict_types=1);

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/db.php';

/**
 * Carrinho bruto (product_id => quantidade).
 *
 * @return array<int, int>
 */
function nx_cart(): array
{
    nx_session_start();
    $cart = $_SESSION['cart'] ?? [];

    if (!is_array($cart)) {
        return [];
    }

    $clean = [];
    foreach ($cart as $productId => $quantity) {
        $productId = (int) $productId;
        $quantity = (int) $quantity;

        if ($productId > 0 && $quantity > 0) {
            $clean[$productId] = min($quantity, 99);
        }
    }

    return $clean;
}

/**
 * Persiste o carrinho normalizado.
 *
 * @param array<int, int> $cart
 */
function nx_cart_save(array $cart): void
{
    nx_session_start();
    $_SESSION['cart'] = $cart;
}

/**
 * Adiciona (ou incrementa) um produto.
 */
function nx_cart_add(int $productId, int $quantity = 1): void
{
    if ($productId <= 0) {
        return;
    }

    $cart = nx_cart();
    $quantity = max(1, min(99, $quantity));
    $cart[$productId] = min(99, ($cart[$productId] ?? 0) + $quantity);
    nx_cart_save($cart);
}

/**
 * Define a quantidade exata (0 remove).
 */
function nx_cart_set(int $productId, int $quantity): void
{
    $cart = nx_cart();

    if ($quantity <= 0) {
        unset($cart[$productId]);
    } else {
        $cart[$productId] = min(99, $quantity);
    }

    nx_cart_save($cart);
}

/**
 * Remove um produto.
 */
function nx_cart_remove(int $productId): void
{
    $cart = nx_cart();
    unset($cart[$productId]);
    nx_cart_save($cart);
}

/**
 * Esvazia o carrinho.
 */
function nx_cart_clear(): void
{
    nx_cart_save([]);
}

/**
 * Quantidade total de itens.
 */
function nx_cart_count(): int
{
    return array_sum(nx_cart());
}

/**
 * Itens do carrinho enriquecidos com dados atuais do banco.
 *
 * @return array<int, array<string, mixed>>
 */
function nx_cart_items(): array
{
    $cart = nx_cart();
    if ($cart === []) {
        return [];
    }

    $ids = array_keys($cart);
    sort($ids);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    $rows = nx_all(
        "SELECT p.id, p.slug, p.name, p.price_cents, p.old_price_cents,
                p.is_active, b.name AS brand,
                COALESCE(i.quantity, 0) AS stock,
                (SELECT pi.url FROM product_images pi
                  WHERE pi.product_id = p.id
                  ORDER BY pi.position ASC, pi.id ASC LIMIT 1) AS image
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.id IN ({$placeholders})",
        $ids
    );

    $items = [];
    foreach ($rows as $row) {
        $productId = (int) $row['id'];
        $quantity = (int) $cart[$productId];
        $price = (int) $row['price_cents'];
        $stock = (int) $row['stock'];
        $available = (int) $row['is_active'] === 1 && $stock > 0;

        $quantity = min($quantity, max(1, min(99, $stock > 0 ? $stock : 99)));

        $items[] = [
            'id' => $productId,
            'slug' => (string) $row['slug'],
            'name' => (string) $row['name'],
            'brand' => (string) $row['brand'],
            'price_cents' => $price,
            'old_price_cents' => $row['old_price_cents'] === null ? null : (int) $row['old_price_cents'],
            'quantity' => $quantity,
            'stock' => $stock,
            'available' => $available,
            'image' => $row['image'] !== null ? (string) $row['image'] : '',
            'subtotal_cents' => $price * $quantity,
        ];
    }

    return $items;
}

/**
 * Subtotal do carrinho em centavos.
 *
 * @param array<int, array<string, mixed>>|null $items
 */
function nx_cart_subtotal(?array $items = null): int
{
    $items ??= nx_cart_items();
    $total = 0;
    foreach ($items as $item) {
        if (!empty($item['available'])) {
            $total += (int) $item['subtotal_cents'];
        }
    }

    return $total;
}

/**
 * Frete padrão (grátis acima do mínimo).
 */
function nx_shipping_cents(string $method, int $subtotalCents): int
{
    $service = nx_config()['service'];

    if ($method === 'express') {
        return (int) $service['express_cents'];
    }

    return $subtotalCents >= (int) $service['free_shipping_min_cents']
        ? 0
        : (int) $service['shipping_cents'];
}
