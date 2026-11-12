<?php
/**
 * ==========================================================================
 * NEXUS TECH (versão PHP) — Repositório (consultas ao MySQL)
 * ==========================================================================
 * Catálogo, pedidos, usuários e CRUD administrativo. Todas as consultas
 * usam prepared statements.
 */

declare(strict_types=1);

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

/* ==========================================================================
 * CATEGORIAS E MARCAS
 * ========================================================================== */

/**
 * @return array<int, array<string, mixed>>
 */
function nx_categories(): array
{
    return nx_all(
        'SELECT c.id, c.name, c.slug, COUNT(p.id) AS total
           FROM categories c
           LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
          GROUP BY c.id, c.name, c.slug
          ORDER BY c.name ASC'
    );
}

/**
 * @return array<int, array<string, mixed>>
 */
function nx_brands(): array
{
    return nx_all(
        'SELECT b.id, b.name, b.slug, COUNT(p.id) AS total
           FROM brands b
           LEFT JOIN products p ON p.brand_id = b.id AND p.is_active = 1
          GROUP BY b.id, b.name, b.slug
          ORDER BY b.name ASC'
    );
}

/* ==========================================================================
 * CATÁLOGO PÚBLICO
 * ========================================================================== */

/**
 * Colunas padrão de um produto com marca, categoria, estoque e imagem.
 */
function nx_product_select(): string
{
    return 'p.id, p.slug, p.name, p.description, p.brand_id, p.category_id,
            p.price_cents, p.old_price_cents, p.rating, p.rating_count,
            p.is_featured, p.is_new, p.is_bestseller, p.is_active,
            p.created_at, p.updated_at,
            b.name AS brand, c.name AS category, c.slug AS category_slug,
            COALESCE(i.quantity, 0) AS stock,
            (SELECT pi.url FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position ASC, pi.id ASC LIMIT 1) AS image';
}

/**
 * Lista o catálogo com filtros, ordenação e paginação.
 *
 * @param array<string, mixed> $options
 * @return array{items: array<int, array<string, mixed>>, total: int, page: int, pages: int, per_page: int}
 */
function nx_catalog(array $options): array
{
    $config = nx_config();
    $perPage = max(1, min(48, (int) ($options['per_page'] ?? $config['service']['per_page'])));
    $page = max(1, (int) ($options['page'] ?? 1));
    $q = trim((string) ($options['q'] ?? ''));
    $category = trim((string) ($options['category'] ?? ''));
    $minPrice = isset($options['min_price']) ? (int) $options['min_price'] : null;
    $maxPrice = isset($options['max_price']) ? (int) $options['max_price'] : null;
    $availability = (string) ($options['availability'] ?? 'all');
    $sort = (string) ($options['sort'] ?? 'relevance');

    $clauses = ['p.is_active = 1'];
    $params = [];

    if ($q !== '') {
        $clauses[] = '(p.name LIKE ? OR b.name LIKE ? OR c.name LIKE ?)';
        $like = '%' . $q . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    if ($category !== '') {
        $clauses[] = 'c.slug = ?';
        $params[] = $category;
    }

    if ($minPrice !== null) {
        $clauses[] = 'p.price_cents >= ?';
        $params[] = $minPrice;
    }

    if ($maxPrice !== null) {
        $clauses[] = 'p.price_cents <= ?';
        $params[] = $maxPrice;
    }

    if ($availability === 'in') {
        $clauses[] = 'COALESCE(i.quantity, 0) > 0';
    } elseif ($availability === 'out') {
        $clauses[] = 'COALESCE(i.quantity, 0) = 0';
    }

    $where = 'WHERE ' . implode(' AND ', $clauses);

    $orders = [
        'relevance' => 'p.id ASC',
        'price-asc' => 'p.price_cents ASC, p.id ASC',
        'price-desc' => 'p.price_cents DESC, p.id ASC',
        'rating-desc' => 'p.rating DESC, p.rating_count DESC, p.id ASC',
        'newest' => 'p.is_bestseller DESC, p.is_new DESC, p.id ASC',
    ];
    $orderBy = $orders[$sort] ?? $orders['relevance'];

    $totalRow = nx_one(
        "SELECT COUNT(*) AS total
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
           {$where}",
        $params
    );
    $total = (int) ($totalRow['total'] ?? 0);
    $pages = max(1, (int) ceil($total / $perPage));
    $page = min($page, $pages);
    $offset = ($page - 1) * $perPage;

    $items = nx_all(
        'SELECT ' . nx_product_select() . "
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
           {$where}
           ORDER BY {$orderBy}
           LIMIT {$perPage} OFFSET {$offset}",
        $params
    );

    return [
        'items' => $items,
        'total' => $total,
        'page' => $page,
        'pages' => $pages,
        'per_page' => $perPage,
    ];
}

/**
 * Busca um produto por ID (somente ativo por padrão).
 *
 * @return array<string, mixed>|null
 */
function nx_product_find(int $id, bool $onlyActive = true): ?array
{
    $sql = 'SELECT ' . nx_product_select() . '
              FROM products p
              INNER JOIN brands b ON b.id = p.brand_id
              INNER JOIN categories c ON c.id = p.category_id
              LEFT JOIN inventory i ON i.product_id = p.id
             WHERE p.id = ?';

    if ($onlyActive) {
        $sql .= ' AND p.is_active = 1';
    }

    $row = nx_one($sql . ' LIMIT 1', [$id]);

    return $row === null ? null : nx_product_with_details($row);
}

/**
 * Busca um produto por slug (somente ativo).
 *
 * @return array<string, mixed>|null
 */
function nx_product_by_slug(string $slug): ?array
{
    $row = nx_one(
        'SELECT ' . nx_product_select() . '
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.slug = ? AND p.is_active = 1
          LIMIT 1',
        [$slug]
    );

    return $row === null ? null : nx_product_with_details($row);
}

/**
 * Acrescenta imagens e especificações a um produto.
 *
 * @param array<string, mixed> $product
 * @return array<string, mixed>
 */
function nx_product_with_details(array $product): array
{
    $productId = (int) $product['id'];
    $product['images'] = nx_all(
        'SELECT url, alt FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC',
        [$productId]
    );
    $product['specs'] = nx_all(
        'SELECT label, value FROM product_specs WHERE product_id = ? ORDER BY position ASC, id ASC',
        [$productId]
    );

    return $product;
}

/**
 * Produtos em destaque.
 *
 * @return array<int, array<string, mixed>>
 */
function nx_products_featured(int $limit = 4): array
{
    return nx_all(
        'SELECT ' . nx_product_select() . '
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active = 1 AND p.is_featured = 1
          ORDER BY p.id ASC
          LIMIT ' . max(1, $limit)
    );
}

/**
 * Produtos mais vendidos.
 *
 * @return array<int, array<string, mixed>>
 */
function nx_products_bestsellers(int $limit = 4): array
{
    return nx_all(
        'SELECT ' . nx_product_select() . '
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active = 1 AND p.is_bestseller = 1
          ORDER BY p.id ASC
          LIMIT ' . max(1, $limit)
    );
}

/**
 * Produtos em oferta (com preço anterior).
 *
 * @return array<int, array<string, mixed>>
 */
function nx_products_offers(int $limit = 4): array
{
    return nx_all(
        'SELECT ' . nx_product_select() . '
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active = 1 AND p.old_price_cents IS NOT NULL
            AND p.old_price_cents > p.price_cents
          ORDER BY (p.old_price_cents - p.price_cents) DESC
          LIMIT ' . max(1, $limit)
    );
}

/**
 * Produtos relacionados (mesma categoria).
 *
 * @return array<int, array<string, mixed>>
 */
function nx_products_related(int $categoryId, int $excludeId, int $limit = 4): array
{
    return nx_all(
        'SELECT ' . nx_product_select() . '
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active = 1 AND p.category_id = ? AND p.id <> ?
          ORDER BY p.rating DESC, p.id ASC
          LIMIT ' . max(1, $limit),
        [$categoryId, $excludeId]
    );
}

/**
 * Percentual de desconto (0 quando não há promoção).
 *
 * @param array<string, mixed> $product
 */
function nx_discount_percent(array $product): int
{
    $old = $product['old_price_cents'] ?? null;
    $price = (int) $product['price_cents'];

    if ($old === null || (int) $old <= $price || (int) $old <= 0) {
        return 0;
    }

    return (int) round((((int) $old - $price) / (int) $old) * 100);
}

/**
 * Inicial para o placeholder da imagem.
 *
 * @param array<string, mixed> $product
 */
function nx_product_initial(array $product): string
{
    $name = trim((string) $product['name']);

    return $name === '' ? '?' : mb_strtoupper(mb_substr($name, 0, 1));
}

/**
 * Caminho/URL da imagem do produto (fallback vazio).
 *
 * @param array<string, mixed> $product
 */
function nx_product_image(array $product): string
{
    $image = $product['image'] ?? '';

    return is_string($image) && $image !== '' ? $image : '';
}

/* ==========================================================================
 * PEDIDOS
 * ========================================================================== */

/**
 * Cria um pedido a partir dos itens do carrinho.
 *
 * @param array<string, mixed> $user
 * @param array<string, mixed> $data Dados validados do checkout.
 * @param array<int, array<string, mixed>> $items Itens de nx_cart_items().
 * @return array<string, mixed> Pedido criado.
 */
function nx_create_order(array $user, array $data, array $items): array
{
    $validItems = array_values(array_filter(
        $items,
        static fn (array $item): bool => !empty($item['available']) && (int) $item['quantity'] > 0
    ));

    if ($validItems === []) {
        throw new RuntimeException('Seu carrinho está vazio.');
    }

    $deliveryLabels = [
        'standard' => 'Entrega padrão',
        'express' => 'Entrega expressa',
    ];
    $paymentLabels = [
        'credit' => 'Cartão de crédito',
        'pix' => 'PIX',
        'boleto' => 'Boleto bancário',
    ];

    $orderId = nx_transaction(static function (PDO $pdo) use ($user, $data, $validItems, $deliveryLabels, $paymentLabels): int {
        $ids = array_map(static fn (array $item): int => (int) $item['id'], $validItems);
        sort($ids);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        $statement = $pdo->prepare(
            "SELECT p.id, p.name, p.price_cents, p.is_active,
                    COALESCE(i.quantity, 0) AS stock
               FROM products p
               LEFT JOIN inventory i ON i.product_id = p.id
              WHERE p.id IN ({$placeholders})
                FOR UPDATE"
        );
        $statement->execute($ids);
        $rows = $statement->fetchAll();
        $byId = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            $byId[(int) $row['id']] = $row;
        }

        $subtotal = 0;
        $itemCount = 0;
        foreach ($validItems as $item) {
            $row = $byId[(int) $item['id']] ?? null;
            if ($row === null || (int) $row['is_active'] !== 1) {
                throw new RuntimeException('O produto "' . $item['name'] . '" está indisponível.');
            }
            if ((int) $row['stock'] < (int) $item['quantity']) {
                throw new RuntimeException('Estoque insuficiente para "' . $row['name'] . '".');
            }
            $subtotal += (int) $row['price_cents'] * (int) $item['quantity'];
            $itemCount += (int) $item['quantity'];
        }

        $shipping = nx_shipping_cents((string) $data['delivery'], $subtotal);
        $total = $subtotal + $shipping;
        $code = 'NT-' . strtoupper(bin2hex(random_bytes(5)));

        $insert = $pdo->prepare(
            'INSERT INTO orders
                (code, user_id, status,
                 subtotal_cents, shipping_cents, total_cents, item_count,
                 delivery_method, delivery_label, payment_method, payment_label,
                 delivery_name, delivery_email,
                 cep, street, number, complement, neighborhood, city, state,
                 client_idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insert->execute([
            $code,
            (int) $user['id'],
            'processing',
            $subtotal,
            $shipping,
            $total,
            $itemCount,
            $data['delivery'],
            $deliveryLabels[$data['delivery']] ?? 'Entrega',
            $data['payment'],
            $paymentLabels[$data['payment']] ?? 'Pagamento',
            $data['name'],
            $data['email'],
            $data['cep'],
            $data['street'],
            $data['number'],
            $data['complement'],
            $data['neighborhood'],
            $data['city'],
            $data['state'],
            'sess-' . bin2hex(random_bytes(16)),
        ]);
        $orderId = (int) $pdo->lastInsertId();

        $itemInsert = $pdo->prepare(
            'INSERT INTO order_items
                (order_id, product_id, product_name, unit_price_cents, quantity, total_cents)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stockUpdate = $pdo->prepare(
            'UPDATE inventory
                SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
              WHERE product_id = ? AND quantity >= ?'
        );

        foreach ($validItems as $item) {
            $row = $byId[(int) $item['id']];
            $quantity = (int) $item['quantity'];
            $unitPrice = (int) $row['price_cents'];

            $itemInsert->execute([
                $orderId,
                (int) $item['id'],
                (string) $row['name'],
                $unitPrice,
                $quantity,
                $unitPrice * $quantity,
            ]);

            $stockUpdate->execute([$quantity, (int) $item['id'], $quantity]);
            if ($stockUpdate->rowCount() !== 1) {
                throw new RuntimeException('Estoque insuficiente para "' . $row['name'] . '".');
            }
        }

        return $orderId;
    });

    $order = nx_order_for_user($orderId, (int) $user['id']);
    if ($order === null) {
        throw new RuntimeException('Não foi possível carregar o pedido criado.');
    }

    return $order;
}

/**
 * Pedidos de um usuário (com itens).
 *
 * @return array<int, array<string, mixed>>
 */
function nx_orders_for_user(int $userId): array
{
    $orders = nx_all(
        'SELECT id, code, status, subtotal_cents, shipping_cents, total_cents,
                item_count, delivery_method, delivery_label, payment_method,
                payment_label, delivery_name, delivery_email,
                cep, street, number, complement, neighborhood, city, state,
                created_at
           FROM orders
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC',
        [$userId]
    );

    foreach ($orders as $index => $order) {
        $orders[$index]['items'] = nx_order_items((int) $order['id']);
    }

    return $orders;
}

/**
 * Pedido do usuário (com itens).
 *
 * @return array<string, mixed>|null
 */
function nx_order_for_user(int $orderId, int $userId): ?array
{
    $order = nx_one(
        'SELECT id, code, status, subtotal_cents, shipping_cents, total_cents,
                item_count, delivery_method, delivery_label, payment_method,
                payment_label, delivery_name, delivery_email,
                cep, street, number, complement, neighborhood, city, state,
                created_at
           FROM orders
          WHERE id = ? AND user_id = ?
          LIMIT 1',
        [$orderId, $userId]
    );

    if ($order === null) {
        return null;
    }

    $order['items'] = nx_order_items((int) $order['id']);

    return $order;
}

/**
 * Itens de um pedido.
 *
 * @return array<int, array<string, mixed>>
 */
function nx_order_items(int $orderId): array
{
    return nx_all(
        'SELECT id, order_id, product_id, product_name, unit_price_cents,
                quantity, total_cents
           FROM order_items
          WHERE order_id = ?
          ORDER BY id ASC',
        [$orderId]
    );
}

/**
 * Rótulo do status do pedido.
 */
function nx_order_status_label(string $status): string
{
    return [
        'processing' => 'Em processamento',
        'paid' => 'Pago',
        'shipped' => 'Enviado',
        'cancelled' => 'Cancelado',
    ][$status] ?? $status;
}

/* ==========================================================================
 * ADMINISTRAÇÃO
 * ========================================================================== */

/**
 * Indicadores do dashboard.
 *
 * @return array<string, int>
 */
function nx_admin_stats(): array
{
    $row = nx_one(
        "SELECT
            (SELECT COUNT(*) FROM products WHERE is_active = 1) AS active_products,
            (SELECT COUNT(*) FROM products WHERE is_active = 0) AS inactive_products,
            (SELECT COUNT(*) FROM brands) AS brands,
            (SELECT COUNT(*) FROM categories) AS categories,
            (SELECT COUNT(*) FROM products p
               LEFT JOIN inventory i ON i.product_id = p.id
              WHERE COALESCE(i.quantity, 0) = 0 AND p.is_active = 1) AS out_of_stock,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE status <> 'cancelled') AS revenue_cents,
            (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers"
    );

    return [
        'active_products' => (int) ($row['active_products'] ?? 0),
        'inactive_products' => (int) ($row['inactive_products'] ?? 0),
        'brands' => (int) ($row['brands'] ?? 0),
        'categories' => (int) ($row['categories'] ?? 0),
        'out_of_stock' => (int) ($row['out_of_stock'] ?? 0),
        'orders' => (int) ($row['orders'] ?? 0),
        'revenue_cents' => (int) ($row['revenue_cents'] ?? 0),
        'customers' => (int) ($row['customers'] ?? 0),
    ];
}

/**
 * Lista administrativa de produtos.
 *
 * @param array<string, mixed> $filters
 * @return array<int, array<string, mixed>>
 */
function nx_admin_products(array $filters = []): array
{
    $clauses = ['1 = 1'];
    $params = [];

    $q = trim((string) ($filters['q'] ?? ''));
    if ($q !== '') {
        $clauses[] = '(p.name LIKE ? OR p.slug LIKE ? OR b.name LIKE ? OR c.name LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like);
    }

    $categoryId = (int) ($filters['category_id'] ?? 0);
    if ($categoryId > 0) {
        $clauses[] = 'p.category_id = ?';
        $params[] = $categoryId;
    }

    $brandId = (int) ($filters['brand_id'] ?? 0);
    if ($brandId > 0) {
        $clauses[] = 'p.brand_id = ?';
        $params[] = $brandId;
    }

    $status = (string) ($filters['status'] ?? 'all');
    if ($status === 'active') {
        $clauses[] = 'p.is_active = 1';
    } elseif ($status === 'inactive') {
        $clauses[] = 'p.is_active = 0';
    }

    $where = 'WHERE ' . implode(' AND ', $clauses);

    return nx_all(
        'SELECT ' . nx_product_select() . "
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
           {$where}
           ORDER BY p.updated_at DESC, p.id DESC
           LIMIT 500",
        $params
    );
}

/**
 * Produto para edição no admin.
 *
 * @return array<string, mixed>|null
 */
function nx_admin_product_find(int $id): ?array
{
    $row = nx_one(
        'SELECT ' . nx_product_select() . '
           FROM products p
           INNER JOIN brands b ON b.id = p.brand_id
           INNER JOIN categories c ON c.id = p.category_id
           LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.id = ?
          LIMIT 1',
        [$id]
    );

    return $row === null ? null : nx_product_with_details($row);
}

/**
 * Cria ou atualiza um produto (com especificações, imagens e estoque).
 *
 * @param array<string, mixed> $data Dados validados.
 * @param array<string, mixed> $admin
 * @return int ID do produto.
 */
function nx_admin_save_product(?int $id, array $data, array $admin): int
{
    $before = $id !== null ? nx_admin_product_find($id) : null;

    $productId = nx_transaction(static function (PDO $pdo) use ($id, $data): int {
        if ($id === null) {
            $statement = $pdo->prepare(
                'INSERT INTO products
                    (slug, name, description, brand_id, category_id, price_cents,
                     old_price_cents, is_featured, is_new, is_bestseller, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                $data['slug'],
                $data['name'],
                $data['description'],
                $data['brand_id'],
                $data['category_id'],
                $data['price_cents'],
                $data['old_price_cents'],
                $data['is_featured'],
                $data['is_new'],
                $data['is_bestseller'],
                $data['is_active'],
            ]);
            $productId = (int) $pdo->lastInsertId();
        } else {
            $statement = $pdo->prepare(
                'UPDATE products
                    SET slug = ?, name = ?, description = ?, brand_id = ?,
                        category_id = ?, price_cents = ?, old_price_cents = ?,
                        is_featured = ?, is_new = ?, is_bestseller = ?, is_active = ?
                  WHERE id = ?'
            );
            $statement->execute([
                $data['slug'],
                $data['name'],
                $data['description'],
                $data['brand_id'],
                $data['category_id'],
                $data['price_cents'],
                $data['old_price_cents'],
                $data['is_featured'],
                $data['is_new'],
                $data['is_bestseller'],
                $data['is_active'],
                $id,
            ]);
            $productId = $id;
        }

        $pdo->prepare('DELETE FROM product_specs WHERE product_id = ?')->execute([$productId]);
        $specInsert = $pdo->prepare(
            'INSERT INTO product_specs (product_id, label, value, position) VALUES (?, ?, ?, ?)'
        );
        foreach ($data['specs'] as $position => $spec) {
            $specInsert->execute([$productId, $spec['label'], $spec['value'], $position]);
        }

        $pdo->prepare('DELETE FROM product_images WHERE product_id = ?')->execute([$productId]);
        $imageInsert = $pdo->prepare(
            'INSERT INTO product_images (product_id, url, alt, position) VALUES (?, ?, ?, ?)'
        );
        foreach ($data['images'] as $position => $image) {
            $imageInsert->execute([$productId, $image['url'], $image['alt'], $position]);
        }

        $pdo->prepare(
            'INSERT INTO inventory (product_id, quantity)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP'
        )->execute([$productId, $data['stock']]);

        return $productId;
    });

    $after = nx_admin_product_find($productId);
    nx_audit_log(
        (int) $admin['id'],
        $id === null ? 'create' : 'update',
        'product',
        $productId,
        $before,
        $after
    );

    return $productId;
}

/**
 * Desativa um produto (exclusão lógica para preservar pedidos).
 *
 * @param array<string, mixed> $admin
 */
function nx_admin_delete_product(int $id, array $admin): void
{
    $before = nx_admin_product_find($id);
    nx_exec('UPDATE products SET is_active = 0 WHERE id = ?', [$id]);
    $after = nx_admin_product_find($id);
    nx_audit_log((int) $admin['id'], 'deactivate', 'product', $id, $before, $after);
}

/**
 * Ativa/desativa um produto.
 *
 * @param array<string, mixed> $admin
 */
function nx_admin_set_product_active(int $id, bool $active, array $admin): void
{
    $before = nx_admin_product_find($id);
    nx_exec('UPDATE products SET is_active = ? WHERE id = ?', [$active ? 1 : 0, $id]);
    $after = nx_admin_product_find($id);
    nx_audit_log((int) $admin['id'], $active ? 'activate' : 'deactivate', 'product', $id, $before, $after);
}

/**
 * Tabela de entidades nomeadas: brands ou categories.
 */
function nx_admin_entity_table(string $type): string
{
    if (!in_array($type, ['brands', 'categories'], true)) {
        throw new InvalidArgumentException('Entidade inválida.');
    }

    return $type;
}

/**
 * Nome singular usado no log de auditoria.
 */
function nx_admin_entity_noun(string $type): string
{
    return $type === 'brands' ? 'brand' : 'category';
}

/**
 * Lista marcas ou categorias com contagem de produtos.
 *
 * @return array<int, array<string, mixed>>
 */
function nx_admin_entities(string $type): array
{
    $table = nx_admin_entity_table($type);
    $fk = $type === 'brands' ? 'brand_id' : 'category_id';

    return nx_all(
        "SELECT e.id, e.name, e.slug, COUNT(p.id) AS total
           FROM {$table} e
           LEFT JOIN products p ON p.{$fk} = e.id
          GROUP BY e.id, e.name, e.slug
          ORDER BY e.name ASC"
    );
}

/**
 * @return array<string, mixed>|null
 */
function nx_admin_entity_find(string $type, int $id): ?array
{
    $table = nx_admin_entity_table($type);

    return nx_one("SELECT id, name, slug FROM {$table} WHERE id = ? LIMIT 1", [$id]);
}

/**
 * Cria/atualiza marca ou categoria.
 *
 * @param array<string, string> $data
 * @param array<string, mixed> $admin
 */
function nx_admin_save_entity(string $type, ?int $id, array $data, array $admin): int
{
    $table = nx_admin_entity_table($type);
    $before = $id !== null ? nx_admin_entity_find($type, $id) : null;

    if ($id === null) {
        nx_exec("INSERT INTO {$table} (name, slug) VALUES (?, ?)", [$data['name'], $data['slug']]);
        $entityId = (int) nx_db()->lastInsertId();
    } else {
        nx_exec("UPDATE {$table} SET name = ?, slug = ? WHERE id = ?", [$data['name'], $data['slug'], $id]);
        $entityId = $id;
    }

    nx_audit_log(
        (int) $admin['id'],
        $id === null ? 'create' : 'update',
        nx_admin_entity_noun($type),
        $entityId,
        $before,
        nx_admin_entity_find($type, $entityId)
    );

    return $entityId;
}

/**
 * Exclui marca/categoria somente quando não há produtos vinculados.
 *
 * @param array<string, mixed> $admin
 * @return string|null Mensagem de erro, ou null em caso de sucesso.
 */
function nx_admin_delete_entity(string $type, int $id, array $admin): ?string
{
    $table = nx_admin_entity_table($type);
    $fk = $type === 'brands' ? 'brand_id' : 'category_id';

    $row = nx_one("SELECT COUNT(*) AS total FROM products WHERE {$fk} = ?", [$id]);
    $linked = (int) ($row['total'] ?? 0);

    if ($linked > 0) {
        return 'Não é possível excluir: existem ' . $linked . ' produto(s) vinculado(s).';
    }

    $before = nx_admin_entity_find($type, $id);
    try {
        nx_exec("DELETE FROM {$table} WHERE id = ?", [$id]);
    } catch (Throwable $exception) {
        nx_log('Falha ao excluir ' . $type . ': ' . $exception->getMessage());
        return 'Não foi possível excluir este registro.';
    }

    nx_audit_log((int) $admin['id'], 'delete', nx_admin_entity_noun($type), $id, $before, null);

    return null;
}

/**
 * Registra uma ação administrativa.
 *
 * @param array<string, mixed>|null $before
 * @param array<string, mixed>|null $after
 */
function nx_audit_log(int $adminId, string $action, string $entity, ?int $entityId, ?array $before, ?array $after): void
{
    try {
        nx_exec(
            'INSERT INTO admin_actions (admin_id, action, entity, entity_id, before_data, after_data, ip)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $adminId,
                $action,
                $entity,
                $entityId,
                $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
                $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
                $_SERVER['REMOTE_ADDR'] ?? null,
            ]
        );
    } catch (Throwable $exception) {
        nx_log('Falha ao registrar auditoria: ' . $exception->getMessage());
    }
}

/**
 * Últimas ações administrativas.
 *
 * @return array<int, array<string, mixed>>
 */
function nx_admin_recent_actions(int $limit = 10): array
{
    return nx_all(
        'SELECT a.id, a.action, a.entity, a.entity_id, a.created_at, u.name AS admin_name
           FROM admin_actions a
           INNER JOIN users u ON u.id = a.admin_id
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT ' . max(1, $limit)
    );
}

/**
 * Rótulo amigável da ação de auditoria.
 */
function nx_action_label(string $action, string $entity): string
{
    $actions = [
        'create' => 'Criou',
        'update' => 'Atualizou',
        'delete' => 'Excluiu',
        'activate' => 'Ativou',
        'deactivate' => 'Desativou',
    ];
    $entities = [
        'product' => 'produto',
        'brand' => 'marca',
        'category' => 'categoria',
    ];

    return ($actions[$action] ?? $action) . ' ' . ($entities[$entity] ?? $entity);
}

/* ==========================================================================
 * USUÁRIOS / PERFIL
 * ========================================================================== */

/**
 * Dados do usuário + perfil.
 *
 * @return array<string, mixed>|null
 */
function nx_user_profile(int $userId): ?array
{
    return nx_one(
        'SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
                p.phone, p.cpf
           FROM users u
           LEFT JOIN user_profile p ON p.user_id = u.id
          WHERE u.id = ?
          LIMIT 1',
        [$userId]
    );
}

/**
 * Cria um cliente (users + user_profile) em transação.
 *
 * @param array<string, mixed> $data Saída de nx_validate_registration().
 */
function nx_create_customer(array $data): int
{
    return nx_transaction(static function (PDO $pdo) use ($data): int {
        $statement = $pdo->prepare(
            "INSERT INTO users (name, email, password_hash, role, is_active)
             VALUES (?, ?, ?, 'customer', 1)"
        );
        $statement->execute([
            $data['name'],
            $data['email'],
            password_hash((string) $data['password'], PASSWORD_BCRYPT, ['cost' => 12]),
        ]);
        $userId = (int) $pdo->lastInsertId();

        $pdo->prepare(
            'INSERT INTO user_profile (user_id, phone, cpf) VALUES (?, ?, ?)'
        )->execute([$userId, $data['phone'] ?: null, $data['cpf'] ?: null]);

        return $userId;
    });
}

/**
 * Atualiza dados cadastrais e perfil.
 *
 * @param array<string, mixed> $data Saída de nx_validate_profile().
 */
function nx_update_user_profile(int $userId, array $data): void
{
    nx_transaction(static function (PDO $pdo) use ($userId, $data): void {
        $pdo->prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
            ->execute([$data['name'], $data['email'], $userId]);

        $pdo->prepare(
            'INSERT INTO user_profile (user_id, phone, cpf)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE phone = VALUES(phone), cpf = VALUES(cpf)'
        )->execute([$userId, $data['phone'] ?: null, $data['cpf'] ?: null]);
    });
}

/**
 * Atualiza a senha do usuário.
 */
function nx_update_user_password(int $userId, string $newPassword): void
{
    nx_exec(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]), $userId]
    );
}

/**
 * Senha (hash) atual de um usuário.
 */
function nx_user_password_hash(int $userId): ?string
{
    $row = nx_one('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [$userId]);

    return $row === null ? null : (string) $row['password_hash'];
}

