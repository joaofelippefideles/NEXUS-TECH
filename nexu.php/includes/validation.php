<?php
/**
 * ==========================================================================
 * NEXUS TECH (versão PHP) — Validação e normalização de entrada
 * ==========================================================================
 * As funções devolvem:
 *   ['ok' => bool, 'data' => array, 'errors' => array<string,string>]
 * e nunca devolvem senhas em mensagens de erro.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/functions.php';

/**
 * Valida os dígitos verificadores do CPF.
 */
function nx_is_valid_cpf_digits(string $digits): bool
{
    if (preg_match('/^\d{11}$/', $digits) !== 1) {
        return false;
    }

    if (preg_match('/^(\d)\1{10}$/', $digits) === 1) {
        return false;
    }

    $sum = 0;
    for ($i = 0; $i < 9; $i++) {
        $sum += (int) $digits[$i] * (10 - $i);
    }
    $first = 11 - ($sum % 11);
    if ($first >= 10) {
        $first = 0;
    }
    if ($first !== (int) $digits[9]) {
        return false;
    }

    $sum = 0;
    for ($i = 0; $i < 10; $i++) {
        $sum += (int) $digits[$i] * (11 - $i);
    }
    $second = 11 - ($sum % 11);
    if ($second >= 10) {
        $second = 0;
    }

    return $second === (int) $digits[10];
}

/**
 * Formata 11 dígitos como CPF.
 */
function nx_format_cpf(string $digits): string
{
    return substr($digits, 0, 3) . '.'
        . substr($digits, 3, 3) . '.'
        . substr($digits, 6, 3) . '-'
        . substr($digits, 9, 2);
}

/**
 * Valida DDD + número (10 ou 11 dígitos).
 */
function nx_is_valid_phone_digits(string $digits): bool
{
    if (preg_match('/^\d{10,11}$/', $digits) !== 1) {
        return false;
    }

    return $digits[0] !== '0' && $digits[1] !== '0';
}

/**
 * Formata telefone como "(DD) XXXXX-XXXX".
 */
function nx_format_phone(string $digits): string
{
    if (strlen($digits) === 11) {
        return '(' . substr($digits, 0, 2) . ') '
            . substr($digits, 2, 5) . '-'
            . substr($digits, 7, 4);
    }

    return '(' . substr($digits, 0, 2) . ') '
        . substr($digits, 2, 4) . '-'
        . substr($digits, 6, 4);
}

/**
 * Valida e normaliza o cadastro.
 *
 * @param array<string, mixed> $input
 * @return array{ok: bool, data: array<string, mixed>, errors: array<string, string>}
 */
function nx_validate_registration(array $input): array
{
    $config = nx_config();
    $minPassword = (int) $config['security']['password_min_length'];
    $maxPassword = (int) $config['security']['password_max_length'];

    $errors = [];

    $name = nx_input('name', '', $input);
    $email = strtolower(nx_input('email', '', $input));
    $phoneRaw = nx_input('phone', '', $input);
    $cpfRaw = nx_input('cpf', '', $input);
    $password = is_string($input['password'] ?? null) ? (string) $input['password'] : '';
    $passwordConfirm = is_string($input['passwordConfirm'] ?? null) ? (string) $input['passwordConfirm'] : '';

    if ($name === '') {
        $errors['name'] = 'Informe seu nome completo.';
    } elseif (mb_strlen($name) < 2) {
        $errors['name'] = 'O nome deve ter pelo menos 2 caracteres.';
    } elseif (mb_strlen($name) > 120) {
        $errors['name'] = 'O nome deve ter no máximo 120 caracteres.';
    } elseif (preg_match("/^[\p{L}\p{M}' .\-]+$/u", $name) !== 1) {
        $errors['name'] = 'O nome contém caracteres inválidos.';
    }

    if ($email === '') {
        $errors['email'] = 'Informe seu e-mail.';
    } elseif (mb_strlen($email) > 190) {
        $errors['email'] = 'O e-mail deve ter no máximo 190 caracteres.';
    } elseif (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = 'Informe um e-mail válido.';
    }

    $phoneDigits = nx_digits($phoneRaw);
    $phone = '';
    if ($phoneRaw === '') {
        $errors['phone'] = 'Informe seu telefone com DDD.';
    } elseif (!nx_is_valid_phone_digits($phoneDigits)) {
        $errors['phone'] = 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.';
    } else {
        $phone = nx_format_phone($phoneDigits);
    }

    $cpfDigits = nx_digits($cpfRaw);
    $cpf = '';
    if ($cpfRaw === '') {
        $errors['cpf'] = 'Informe seu CPF.';
    } elseif (!nx_is_valid_cpf_digits($cpfDigits)) {
        $errors['cpf'] = 'Informe um CPF válido (000.000.000-00).';
    } else {
        $cpf = nx_format_cpf($cpfDigits);
    }

    if ($password === '') {
        $errors['password'] = 'Crie uma senha.';
    } elseif (mb_strlen($password) < $minPassword) {
        $errors['password'] = "A senha deve ter no mínimo {$minPassword} caracteres.";
    } elseif (mb_strlen($password) > $maxPassword) {
        $errors['password'] = "A senha deve ter no máximo {$maxPassword} caracteres.";
    } elseif (preg_match('/^(?=.*\d)(?=.*[A-Za-z]).+$/', $password) !== 1) {
        $errors['password'] = 'A senha deve conter letras e números.';
    }

    if ($passwordConfirm === '') {
        $errors['passwordConfirm'] = 'Confirme sua senha.';
    } elseif ($password !== $passwordConfirm) {
        $errors['passwordConfirm'] = 'As senhas não coincidem.';
    }

    if (!isset($input['terms'])) {
        $errors['terms'] = 'Você precisa aceitar os Termos de Uso.';
    }
    if (!isset($input['privacy'])) {
        $errors['privacy'] = 'Você precisa aceitar a Política de Privacidade.';
    }

    return [
        'ok' => $errors === [],
        'data' => [
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'cpf' => $cpf,
            'password' => $password,
        ],
        'errors' => $errors,
    ];
}

/**
 * Valida credenciais de login.
 *
 * @param array<string, mixed> $input
 * @return array{ok: bool, data: array<string, string>, errors: array<string, string>}
 */
function nx_validate_login(array $input): array
{
    $errors = [];
    $email = strtolower(nx_input('email', '', $input));
    $password = is_string($input['password'] ?? null) ? (string) $input['password'] : '';

    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = 'Informe um e-mail válido.';
    }

    if ($password === '') {
        $errors['password'] = 'Informe sua senha.';
    }

    return [
        'ok' => $errors === [],
        'data' => ['email' => $email, 'password' => $password],
        'errors' => $errors,
    ];
}

/**
 * Valida a atualização de dados do perfil.
 *
 * @param array<string, mixed> $input
 * @return array{ok: bool, data: array<string, string>, errors: array<string, string>}
 */
function nx_validate_profile(array $input): array
{
    $errors = [];
    $name = nx_input('name', '', $input);
    $email = strtolower(nx_input('email', '', $input));
    $phoneRaw = nx_input('phone', '', $input);
    $cpfRaw = nx_input('cpf', '', $input);

    if ($name === '' || mb_strlen($name) < 2) {
        $errors['name'] = 'Informe seu nome (mínimo 2 caracteres).';
    } elseif (mb_strlen($name) > 120) {
        $errors['name'] = 'O nome deve ter no máximo 120 caracteres.';
    }

    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = 'Informe um e-mail válido.';
    } elseif (mb_strlen($email) > 190) {
        $errors['email'] = 'O e-mail deve ter no máximo 190 caracteres.';
    }

    $phone = '';
    $phoneDigits = nx_digits($phoneRaw);
    if ($phoneRaw === '') {
        $errors['phone'] = 'Informe seu telefone com DDD.';
    } elseif (!nx_is_valid_phone_digits($phoneDigits)) {
        $errors['phone'] = 'Telefone inválido. Use DDD + número.';
    } else {
        $phone = nx_format_phone($phoneDigits);
    }

    $cpf = '';
    $cpfDigits = nx_digits($cpfRaw);
    if ($cpfRaw === '') {
        $errors['cpf'] = 'Informe seu CPF.';
    } elseif (!nx_is_valid_cpf_digits($cpfDigits)) {
        $errors['cpf'] = 'Informe um CPF válido.';
    } else {
        $cpf = nx_format_cpf($cpfDigits);
    }

    return [
        'ok' => $errors === [],
        'data' => ['name' => $name, 'email' => $email, 'phone' => $phone, 'cpf' => $cpf],
        'errors' => $errors,
    ];
}

/**
 * Valida a troca de senha.
 *
 * @param array<string, mixed> $input
 * @return array{ok: bool, data: array<string, string>, errors: array<string, string>}
 */
function nx_validate_password_change(array $input): array
{
    $errors = [];
    $current = is_string($input['currentPassword'] ?? null) ? (string) $input['currentPassword'] : '';
    $new = is_string($input['newPassword'] ?? null) ? (string) $input['newPassword'] : '';
    $confirm = is_string($input['newPasswordConfirm'] ?? null) ? (string) $input['newPasswordConfirm'] : '';

    if ($current === '') {
        $errors['currentPassword'] = 'Informe sua senha atual.';
    }

    if ($new === '') {
        $errors['newPassword'] = 'Informe a nova senha.';
    } elseif (mb_strlen($new) < 8) {
        $errors['newPassword'] = 'A nova senha deve ter no mínimo 8 caracteres.';
    } elseif (preg_match('/^(?=.*\d)(?=.*[A-Za-z]).+$/', $new) !== 1) {
        $errors['newPassword'] = 'A nova senha deve conter letras e números.';
    } elseif ($new === $current) {
        $errors['newPassword'] = 'A nova senha deve ser diferente da atual.';
    }

    if ($confirm === '') {
        $errors['newPasswordConfirm'] = 'Confirme a nova senha.';
    } elseif ($new !== $confirm) {
        $errors['newPasswordConfirm'] = 'As senhas não coincidem.';
    }

    return [
        'ok' => $errors === [],
        'data' => ['currentPassword' => $current, 'newPassword' => $new],
        'errors' => $errors,
    ];
}

/**
 * Valida o checkout (dados de entrega/pagamento). Os itens vêm do carrinho.
 *
 * @param array<string, mixed> $input
 * @return array{ok: bool, data: array<string, mixed>, errors: array<string, string>}
 */
function nx_validate_checkout(array $input): array
{
    $errors = [];

    $name = nx_input('name', '', $input);
    $email = strtolower(nx_input('email', '', $input));
    $cep = nx_digits(nx_input('cep', '', $input));
    $street = nx_input('street', '', $input);
    $number = nx_input('number', '', $input);
    $complement = nx_input('complement', '', $input);
    $neighborhood = nx_input('neighborhood', '', $input);
    $city = nx_input('city', '', $input);
    $state = strtoupper(nx_input('state', '', $input));
    $delivery = nx_input('delivery', 'standard', $input);
    $payment = nx_input('payment', 'credit', $input);

    if ($name === '' || mb_strlen($name) < 2) {
        $errors['name'] = 'Informe seu nome completo.';
    }
    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = 'Informe um e-mail válido.';
    }
    if (strlen($cep) !== 8) {
        $errors['cep'] = 'Informe um CEP com 8 dígitos.';
    }
    if ($street === '') {
        $errors['street'] = 'Informe a rua.';
    }
    if ($number === '') {
        $errors['number'] = 'Informe o número.';
    }
    if ($neighborhood === '') {
        $errors['neighborhood'] = 'Informe o bairro.';
    }
    if ($city === '') {
        $errors['city'] = 'Informe a cidade.';
    }
    if (preg_match('/^[A-Z]{2}$/', $state) !== 1) {
        $errors['state'] = 'Selecione a UF.';
    }
    if (!in_array($delivery, ['standard', 'express'], true)) {
        $errors['delivery'] = 'Escolha a forma de entrega.';
    }
    if (!in_array($payment, ['credit', 'pix', 'boleto'], true)) {
        $errors['payment'] = 'Escolha a forma de pagamento.';
    }

    return [
        'ok' => $errors === [],
        'data' => [
            'name' => $name,
            'email' => $email,
            'cep' => substr($cep, 0, 5) . '-' . substr($cep, 5),
            'street' => $street,
            'number' => $number,
            'complement' => $complement === '' ? null : $complement,
            'neighborhood' => $neighborhood,
            'city' => $city,
            'state' => $state,
            'delivery' => $delivery,
            'payment' => $payment,
        ],
        'errors' => $errors,
    ];
}

/**
 * Valida um produto do admin.
 *
 * @param array<string, mixed> $input
 * @return array{ok: bool, data: array<string, mixed>, errors: array<string, string>}
 */
function nx_validate_product(array $input): array
{
    $errors = [];

    $name = nx_input('name', '', $input);
    $slug = strtolower(nx_input('slug', '', $input));
    $description = nx_input('description', '', $input);
    $brandId = (int) ($input['brand_id'] ?? 0);
    $categoryId = (int) ($input['category_id'] ?? 0);
    $priceRaw = nx_input('price', '', $input);
    $oldPriceRaw = nx_input('old_price', '', $input);
    $stock = (int) ($input['stock'] ?? 0);

    if ($name === '' || mb_strlen($name) < 2) {
        $errors['name'] = 'Informe o nome do produto.';
    } elseif (mb_strlen($name) > 200) {
        $errors['name'] = 'O nome deve ter no máximo 200 caracteres.';
    }

    if ($slug === '') {
        $slug = nx_slugify($name, 140);
    }
    if (preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug) !== 1) {
        $errors['slug'] = 'Slug inválido (letras minúsculas, números e hífens).';
    }

    if ($brandId <= 0) {
        $errors['brand_id'] = 'Selecione a marca.';
    }
    if ($categoryId <= 0) {
        $errors['category_id'] = 'Selecione a categoria.';
    }

    $priceCents = nx_price_to_cents($priceRaw);
    if ($priceCents === null || $priceCents < 0) {
        $errors['price'] = 'Informe um preço válido.';
        $priceCents = 0;
    }

    $oldPriceCents = null;
    if ($oldPriceRaw !== '') {
        $oldPriceCents = nx_price_to_cents($oldPriceRaw);
        if ($oldPriceCents === null) {
            $errors['old_price'] = 'Informe um preço anterior válido.';
        } elseif ($oldPriceCents < $priceCents) {
            $errors['old_price'] = 'O preço anterior deve ser maior que o preço atual.';
        }
    }

    if ($stock < 0) {
        $errors['stock'] = 'O estoque não pode ser negativo.';
        $stock = 0;
    }

    $specs = [];
    $labels = $input['spec_label'] ?? [];
    $values = $input['spec_value'] ?? [];
    if (is_array($labels) && is_array($values)) {
        foreach ($labels as $index => $label) {
            $label = is_string($label) ? trim($label) : '';
            $value = is_string($values[$index] ?? null) ? trim((string) $values[$index]) : '';
            if ($label !== '' && $value !== '') {
                $specs[] = ['label' => mb_substr($label, 0, 120), 'value' => mb_substr($value, 0, 255)];
            }
        }
    }

    $images = [];
    $urls = $input['image_url'] ?? [];
    $alts = $input['image_alt'] ?? [];
    if (is_array($urls)) {
        foreach ($urls as $index => $url) {
            $url = is_string($url) ? trim($url) : '';
            if ($url === '') {
                continue;
            }
            if (preg_match('/^\s*(javascript|data|vbscript):/i', $url) === 1) {
                $errors['images'] = 'Uma das imagens tem um endereço inválido.';
                continue;
            }
            $alt = is_string($alts[$index] ?? null) ? trim((string) $alts[$index]) : '';
            $images[] = ['url' => mb_substr($url, 0, 255), 'alt' => $alt === '' ? null : mb_substr($alt, 0, 200)];
        }
    }

    return [
        'ok' => $errors === [],
        'data' => [
            'name' => $name,
            'slug' => $slug,
            'description' => $description === '' ? null : $description,
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'price_cents' => $priceCents,
            'old_price_cents' => $oldPriceCents,
            'stock' => max(0, $stock),
            'is_active' => isset($input['is_active']) ? 1 : 0,
            'is_featured' => isset($input['is_featured']) ? 1 : 0,
            'is_new' => isset($input['is_new']) ? 1 : 0,
            'is_bestseller' => isset($input['is_bestseller']) ? 1 : 0,
            'specs' => $specs,
            'images' => $images,
        ],
        'errors' => $errors,
    ];
}

/**
 * Valida marca/categoria.
 *
 * @param array<string, mixed> $input
 * @return array{ok: bool, data: array<string, string>, errors: array<string, string>}
 */
function nx_validate_named_entity(array $input): array
{
    $errors = [];
    $name = nx_input('name', '', $input);
    $slug = strtolower(nx_input('slug', '', $input));

    if ($name === '' || mb_strlen($name) < 2) {
        $errors['name'] = 'Informe o nome.';
    } elseif (mb_strlen($name) > 100) {
        $errors['name'] = 'O nome deve ter no máximo 100 caracteres.';
    }

    if ($slug === '') {
        $slug = nx_slugify($name, 120);
    }
    if (preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug) !== 1) {
        $errors['slug'] = 'Slug inválido (letras minúsculas, números e hífens).';
    }

    return [
        'ok' => $errors === [],
        'data' => ['name' => $name, 'slug' => $slug],
        'errors' => $errors,
    ];
}

/**
 * Converte "1.234,56", "1234.56" ou "1234" em centavos.
 */
function nx_price_to_cents(string $value): ?int
{
    $value = trim($value);
    if ($value === '') {
        return null;
    }

    $value = str_replace(['R$', ' ', "\xc2\xa0"], '', $value);

    if (str_contains($value, ',')) {
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);
    }

    if (!is_numeric($value)) {
        return null;
    }

    return (int) round((float) $value * 100);
}
