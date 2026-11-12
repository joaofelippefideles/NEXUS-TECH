<?php
/**
 * Testes de integração somente leitura contra o MySQL.
 *
 * Requer MySQL ativo e o banco importado (database/script.sql).
 * Execute na raiz do projeto:
 *   php tests/smoke_db.php
 *
 * Códigos de saída: 0 = sucesso, 1 = falha, 2 = banco indisponível/não testado.
 */

declare(strict_types=1);

$base = dirname(__DIR__);

require_once $base . '/includes/functions.php';
require_once $base . '/includes/db.php';
require_once $base . '/includes/auth.php';
require_once $base . '/includes/repository.php';

$failures = 0;
$checks = 0;

function check(string $label, bool $ok, string $detail = ''): void
{
    global $failures, $checks;
    $checks++;

    if (!$ok) {
        $failures++;
        echo "FAIL  {$label}" . ($detail !== '' ? " ({$detail})" : '') . PHP_EOL;
    } else {
        echo "PASS  {$label}" . ($detail !== '' ? " ({$detail})" : '') . PHP_EOL;
    }
}

echo "== Conexão ==\n";
try {
    $pdo = nx_db();
    $version = (string) $pdo->query('SELECT VERSION()')->fetchColumn();
    check('conexão MySQL', true, $version);
} catch (Throwable $exception) {
    echo "NAO EXECUTADO: MySQL indisponível — " . $exception->getMessage() . PHP_EOL;
    echo 'Ative o MySQL no XAMPP e importe database/script.sql antes de repetir.' . PHP_EOL;
    exit(2);
}

echo "\n== Estrutura do banco ==\n";
$requiredTables = ['brands', 'categories', 'products', 'product_images', 'product_specs', 'inventory', 'users', 'user_profile', 'orders', 'order_items', 'admin_actions'];
$tables = array_map(static fn (array $row): string => (string) reset($row), $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_NUM));
$missingTables = array_values(array_diff($requiredTables, $tables));
check('tabelas obrigatórias', $missingTables === [], implode(', ', $missingTables));

$requiredColumns = [
    'products' => ['slug', 'name', 'description', 'brand_id', 'category_id', 'price_cents', 'old_price_cents', 'is_featured', 'is_new', 'is_bestseller', 'is_active'],
    'orders' => ['code', 'user_id', 'status', 'subtotal_cents', 'shipping_cents', 'total_cents', 'item_count', 'delivery_method', 'delivery_label', 'payment_method', 'payment_label', 'delivery_name', 'delivery_email', 'cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'client_idempotency_key'],
    'users' => ['name', 'email', 'password_hash', 'role', 'is_active'],
    'user_profile' => ['user_id', 'phone', 'cpf'],
    'admin_actions' => ['admin_id', 'action', 'entity', 'entity_id', 'before_data', 'after_data', 'ip'],
];
$missingColumns = [];
foreach ($requiredColumns as $table => $columns) {
    if (!in_array($table, $tables, true)) {
        continue;
    }
    $existing = array_column($pdo->query('SHOW COLUMNS FROM `' . $table . '`')->fetchAll(), 'Field');
    foreach ($columns as $column) {
        if (!in_array($column, $existing, true)) {
            $missingColumns[] = "{$table}.{$column}";
        }
    }
}
check('colunas obrigatórias', $missingColumns === [], implode(', ', $missingColumns));

$charset = (string) $pdo->query("SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()")->fetchColumn();
check('charset utf8mb4', $charset === 'utf8mb4', $charset);

$indexes = array_column($pdo->query('SHOW INDEX FROM orders')->fetchAll(), 'Key_name');
check('índice de idempotência', in_array('uq_orders_user_idempotency', $indexes, true));

echo "\n== Dados de demonstração ==\n";
check('marcas cadastradas', count(nx_brands()) >= 1, (string) count(nx_brands()));
check('categorias cadastradas', count(nx_categories()) >= 1, (string) count(nx_categories()));

$catalog = nx_catalog(['per_page' => 48]);
check('catálogo retorna produtos', $catalog['total'] >= 1, $catalog['total'] . ' produtos');
check('paginação do catálogo', $catalog['page'] === 1 && $catalog['pages'] >= 1);

$admin = nx_authenticate_admin('admin@nexustech.com', 'Admin@123');
check('login admin (hash do seed)', is_array($admin));
$customer = nx_authenticate_user('cliente@nexustech.com', 'Cliente@123');
check('login cliente (hash do seed)', is_array($customer));
check('senha errada é rejeitada', nx_authenticate_user('cliente@nexustech.com', 'senha-errada') === null);

echo "\n== Consultas do catálogo ==\n";
check('busca textual', nx_catalog(['q' => 'notebook'])['total'] >= 1);
check('filtro por categoria', nx_catalog(['category' => (string) (nx_categories()[0]['slug'] ?? '')])['total'] >= 1);
check('filtro por faixa de preço', is_array(nx_catalog(['min_price' => 10000, 'max_price' => 500000])));
check('filtro disponibilidade', is_array(nx_catalog(['availability' => 'in'])));
foreach (['price-asc', 'price-desc', 'rating-desc', 'newest'] as $sort) {
    check("ordenação {$sort}", is_array(nx_catalog(['sort' => $sort])['items']));
}

$first = $catalog['items'][0] ?? null;
check('produto do catálogo carregado', is_array($first));
if (is_array($first)) {
    $details = nx_product_with_details($first);
    check('imagens do produto', isset($details['images']) && is_array($details['images']));
    check('especificações do produto', isset($details['specs']) && is_array($details['specs']));
    check('estoque do produto', array_key_exists('stock', $details));
    check('busca por slug', nx_product_by_slug((string) $first['slug']) !== null);
    check('produtos relacionados', is_array(nx_products_related((int) $first['category_id'], (int) $first['id'])));
    check('destaques', is_array(nx_products_featured()));
    check('mais vendidos', is_array(nx_products_bestsellers()));
    check('ofertas', is_array(nx_products_offers()));
}

echo "\n== Consultas administrativas ==\n";
$stats = nx_admin_stats();
$statsKeys = ['active_products', 'inactive_products', 'brands', 'categories', 'out_of_stock', 'orders', 'revenue_cents', 'customers'];
check('indicadores do dashboard', array_diff($statsKeys, array_keys($stats)) === []);
check('listagem admin de produtos', is_array(nx_admin_products()));
check('listagem admin de marcas', count(nx_admin_entities('brands')) >= 1);
check('listagem admin de categorias', count(nx_admin_entities('categories')) >= 1);
check('ações de auditoria', is_array(nx_admin_recent_actions(5)));
check('help do rótulo de categoria', nx_action_label('update', 'category') === 'Atualizou categoria');

if (is_array($customer)) {
    $profile = nx_user_profile((int) $customer['id']);
    check('perfil do cliente', is_array($profile) && (int) $profile['id'] === (int) $customer['id']);
    check('pedidos do cliente', is_array(nx_orders_for_user((int) $customer['id'])));
}

echo "\n== Resultado ==\n";
echo "{$checks} verificações, {$failures} falha(s).\n";

exit($failures === 0 ? 0 : 1);
