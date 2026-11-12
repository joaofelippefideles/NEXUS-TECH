<?php
/**
 * Testes estáticos da versão PHP do NEXUS TECH.
 *
 * Não depende de MySQL. Execute na raiz do projeto:
 *   php tests/smoke_static.php
 */

declare(strict_types=1);

ob_start();

$base = dirname(__DIR__);
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

function warn(string $label, string $detail = ''): void
{
    echo "WARN  {$label}" . ($detail !== '' ? " ({$detail})" : '') . PHP_EOL;
}

function collectFiles(string $dir, string $suffix): array
{
    $found = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file instanceof SplFileInfo && $file->isFile() && str_ends_with($file->getFilename(), $suffix)) {
            $found[] = $file->getPathname();
        }
    }

    sort($found);

    return $found;
}

echo "== Ambiente ==\n";
check('PHP >= 8.1', PHP_VERSION_ID >= 80100, PHP_VERSION);
check('ext-mbstring', extension_loaded('mbstring'));
check('ext-pdo', extension_loaded('pdo'));
if (extension_loaded('pdo_mysql')) {
    check('ext-pdo_mysql', true);
} else {
    warn('ext-pdo_mysql ausente neste CLI', 'necessária apenas para o smoke_db.php');
}
check('ext-json', extension_loaded('json'));

echo "\n== Estrutura ==\n";
$required = [
    'index.php',
    'router.php',
    '.htaccess',
    'includes/config.php',
    'includes/functions.php',
    'includes/db.php',
    'includes/auth.php',
    'includes/cart.php',
    'includes/validation.php',
    'includes/repository.php',
    'includes/components.php',
    'includes/header.php',
    'includes/footer.php',
    'includes/admin-header.php',
    'includes/admin-footer.php',
    'database/script.sql',
    'assets/css/style.css',
    'assets/js/ui.js',
];

foreach ($required as $relative) {
    check("arquivo {$relative}", is_file($base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative)));
}

$pages = glob($base . '/pages/*.php') ?: [];
$adminPages = glob($base . '/admin/*.php') ?: [];
check('páginas da loja', count($pages) >= 12, count($pages) . ' arquivos');
check('páginas do admin', count($adminPages) >= 9, count($adminPages) . ' arquivos');

echo "\n== Lint ==\n";
$phpFiles = collectFiles($base, '.php');
$lintFailures = [];
foreach ($phpFiles as $file) {
    $command = escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($file) . ' 2>&1';
    $output = shell_exec($command);
    if (!is_string($output) || !str_contains($output, 'No syntax errors detected')) {
        $lintFailures[] = str_replace($base . DIRECTORY_SEPARATOR, '', $file) . ': ' . trim((string) $output);
    }
}
check('lint de ' . count($phpFiles) . ' arquivos PHP', $lintFailures === [], implode(' | ', $lintFailures));

echo "\n== Funções nx_ ==\n";
$allPhp = '';
$defined = [];
$definitionCount = 0;
foreach ($phpFiles as $file) {
    $code = (string) file_get_contents($file);
    $allPhp .= "\n" . $code;
    if (preg_match_all('/function\s+(nx_[a-z0-9_]+)\s*\(/i', $code, $matches)) {
        $definitionCount += count($matches[1]);
        foreach ($matches[1] as $name) {
            $defined[$name] = true;
        }
    }
}
preg_match_all('/\b(nx_[a-z0-9_]+)\s*\(/i', $allPhp, $calls);
$called = array_unique($calls[1]);
$undefined = array_values(array_diff($called, array_keys($defined)));
check('chamadas nx_ definidas', $undefined === [], implode(', ', $undefined));
check('funções nx_ duplicadas', $definitionCount === count($defined), "{$definitionCount} definições, " . count($defined) . ' únicas');

echo "\n== Segurança dos formulários ==\n";
$csrfMissing = [];
foreach (array_merge($pages, $adminPages, [$base . '/index.php', $base . '/includes/components.php', $base . '/includes/admin-header.php', $base . '/includes/header.php']) as $file) {
    $code = (string) file_get_contents($file);
    if (preg_match_all('/<form\b[^>]*method=["\']post["\'][^>]*>(.*?)<\/form>/is', $code, $forms)) {
        foreach ($forms[1] as $index => $body) {
            if (!str_contains($body, 'csrf_field') && !str_contains($body, 'csrf_token')) {
                $csrfMissing[] = basename($file) . ' form#' . ($index + 1);
            }
        }
    }
}
check('todo POST possui CSRF', $csrfMissing === [], implode(', ', $csrfMissing));

$htmlLinks = [];
foreach (array_merge($pages, $adminPages) as $file) {
    $code = (string) file_get_contents($file);
    if (preg_match_all('/href=["\'][^"\']*\.html(?:[#?][^"\']*)?["\']/i', $code, $matches)) {
        foreach ($matches[0] as $match) {
            $htmlLinks[] = basename($file) . ': ' . $match;
        }
    }
}
check('sem links .html', $htmlLinks === [], implode(' | ', $htmlLinks));

echo "\n== Campos do schema (script.sql) ==\n";
$sql = (string) file_get_contents($base . '/database/script.sql');
$tables = ['brands', 'categories', 'products', 'product_images', 'product_specs', 'inventory', 'users', 'user_profile', 'orders', 'order_items', 'admin_actions'];
foreach ($tables as $table) {
    check("tabela {$table}", preg_match('/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+`?' . $table . '`?\s*\(/i', $sql) === 1);
}

$columnChecks = [
    'orders' => ['code', 'user_id', 'status', 'subtotal_cents', 'shipping_cents', 'total_cents', 'item_count', 'delivery_method', 'delivery_label', 'payment_method', 'payment_label', 'delivery_name', 'delivery_email', 'cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'client_idempotency_key'],
    'users' => ['name', 'email', 'password_hash', 'role', 'is_active'],
    'user_profile' => ['user_id', 'phone', 'cpf'],
    'admin_actions' => ['admin_id', 'action', 'entity', 'entity_id', 'before_data', 'after_data', 'ip'],
    'inventory' => ['product_id', 'quantity'],
];

foreach ($columnChecks as $table => $columns) {
    if (!preg_match('/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+`?' . $table . '`?\s*\((.*?)\)\s*ENGINE/is', $sql, $block)) {
        check("colunas de {$table}", false, 'bloco CREATE TABLE não encontrado');
        continue;
    }
    $missing = [];
    foreach ($columns as $column) {
        if (preg_match('/\b' . preg_quote($column, '/') . '\b/', $block[1]) !== 1) {
            $missing[] = $column;
        }
    }
    check("colunas de {$table}", $missing === [], implode(', ', $missing));
}

echo "\n== Dados de demonstração ==\n";
preg_match_all('/\$2[aby]\$\d{2}\$[A-Za-z0-9.\/]+/', $sql, $hashes);
$hashes = array_values(array_unique($hashes[0]));
check('hashes bcrypt encontrados', count($hashes) >= 2, count($hashes) . ' hashes');
check('senha do admin confere', (bool) array_filter($hashes, static fn (string $hash): bool => password_verify('Admin@123', $hash)));
check('senha do cliente confere', (bool) array_filter($hashes, static fn (string $hash): bool => password_verify('Cliente@123', $hash)));

echo "\n== Funções utilitárias ==\n";
require_once $base . '/includes/functions.php';
require_once $base . '/includes/validation.php';
require_once $base . '/includes/components.php';

check('nx_money(123456)', nx_money(123456) === 'R$ 1.234,56', nx_money(123456));
check('nx_price_to_cents("1.234,56")', nx_price_to_cents('1.234,56') === 123456);
check('nx_price_to_cents("R$ 99,90")', nx_price_to_cents('R$ 99,90') === 9990);
check('nx_slugify acentos', nx_slugify('Acessórios & Periféricos') === 'acessorios-perifericos', nx_slugify('Acessórios & Periféricos'));
check('nx_slugify símbolos', nx_slugify('iPhone 15 Pro Max!') === 'iphone-15-pro-max', nx_slugify('iPhone 15 Pro Max!'));

$registration = nx_validate_registration([
    'name' => 'Maria da Silva',
    'email' => 'maria@example.com',
    'password' => 'Senha@123',
    'passwordConfirm' => 'Senha@123',
    'phone' => '(11) 98765-4321',
    'cpf' => '529.982.247-25',
    'terms' => '1',
    'privacy' => '1',
]);
check('validação de cadastro', $registration['ok'] === true, implode(', ', $registration['errors']));

$product = nx_validate_product([
    'name' => 'Produto Teste',
    'slug' => 'produto-teste',
    'description' => 'Descrição',
    'brand_id' => 1,
    'category_id' => 1,
    'price' => '1.234,56',
    'old_price' => '1.500,00',
    'stock' => 10,
    'is_active' => '1',
    'spec_label' => ['Memória'],
    'spec_value' => ['16 GB'],
    'image_url' => ['produto.svg'],
    'image_alt' => ['Produto'],
]);
check('validação de produto', $product['ok'] === true, implode(', ', $product['errors']));

$checkout = nx_validate_checkout([
    'name' => 'Maria da Silva',
    'email' => 'maria@example.com',
    'cep' => '01310-100',
    'street' => 'Av. Paulista',
    'number' => '1000',
    'neighborhood' => 'Bela Vista',
    'city' => 'São Paulo',
    'state' => 'SP',
    'delivery' => 'standard',
    'payment' => 'pix',
]);
check('validação de checkout', $checkout['ok'] === true, implode(', ', $checkout['errors']));

echo "\n== Sessão, CSRF e flash ==\n";
nx_session_start();
$token = nx_csrf_token();
check('token CSRF gerado', strlen($token) === 64);
check('CSRF válido', nx_csrf_valid($token) === true);
check('CSRF inválido rejeitado', nx_csrf_valid(str_repeat('0', 64)) === false);
check('campo CSRF renderizado', str_contains(nx_csrf_field(), 'name="csrf_token"'));

nx_flash_set('error', 'Falha de teste');
$flash = nx_render_flash();
check('flash de erro com classe danger', str_contains($flash, 'alert--danger') && str_contains($flash, 'Falha de teste'));

$rateKey = 'smoke-' . bin2hex(random_bytes(4));
check('rate limit 1ª tentativa', nx_rate_limit_exceeded($rateKey, 2, 60) === false);
check('rate limit 2ª tentativa', nx_rate_limit_exceeded($rateKey, 2, 60) === false);
check('rate limit 3ª tentativa', nx_rate_limit_exceeded($rateKey, 2, 60) === true);

echo "\n== Resultado ==\n";
echo "{$checks} verificações, {$failures} falha(s).\n";
$output = ob_get_clean();
echo $output;

exit($failures === 0 ? 0 : 1);
