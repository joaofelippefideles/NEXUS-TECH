<?php
/**
 * ==========================================================================
 * NEXUS TECH (versão PHP) — Conexão MySQL (PDO)
 * ==========================================================================
 * Todas as consultas usam prepared statements. Nenhuma SQL é concatenada
 * com dados vindos do usuário.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/functions.php';

/**
 * Conexão PDO memoizada.
 */
function nx_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = nx_config()['db'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        (int) $db['port'],
        $db['name'],
        $db['charset']
    );

    try {
        $pdo = new PDO($dsn, (string) $db['user'], (string) $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
    } catch (PDOException $exception) {
        nx_log('Falha ao conectar ao MySQL: ' . $exception->getMessage());
        throw new RuntimeException(
            'Não foi possível conectar ao banco de dados. Verifique se o MySQL está iniciado e se o banco foi importado (database/script.sql).',
            0,
            $exception
        );
    }

    return $pdo;
}

/**
 * Executa uma consulta e devolve todas as linhas.
 *
 * @param array<int, mixed> $params
 * @return array<int, array<string, mixed>>
 */
function nx_all(string $sql, array $params = []): array
{
    $statement = nx_db()->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();

    return is_array($rows) ? $rows : [];
}

/**
 * Executa uma consulta e devolve a primeira linha (ou null).
 *
 * @param array<int, mixed> $params
 * @return array<string, mixed>|null
 */
function nx_one(string $sql, array $params = []): ?array
{
    $statement = nx_db()->prepare($sql);
    $statement->execute($params);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

/**
 * Executa uma consulta de escrita e devolve o número de linhas afetadas.
 *
 * @param array<int, mixed> $params
 */
function nx_exec(string $sql, array $params = []): int
{
    $statement = nx_db()->prepare($sql);
    $statement->execute($params);

    return $statement->rowCount();
}

/**
 * Executa uma transação e devolve o retorno do callback.
 *
 * @template T
 * @param callable(PDO): T $callback
 * @return T
 */
function nx_transaction(callable $callback): mixed
{
    $pdo = nx_db();
    $pdo->beginTransaction();

    try {
        $result = $callback($pdo);
        $pdo->commit();

        return $result;
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $exception;
    }
}

/**
 * Indica se a exceção é violação de unicidade.
 */
function nx_is_duplicate(Throwable $exception): bool
{
    if (!$exception instanceof PDOException) {
        return false;
    }

    $sqlState = (string) $exception->getCode();
    $driverCode = $exception->errorInfo[1] ?? null;
    $message = strtolower($exception->getMessage());

    return str_starts_with($sqlState, '23')
        || (int) $driverCode === 1062
        || str_contains($message, 'unique')
        || str_contains($message, 'duplicate');
}

/**
 * Indica se a exceção é violação de chave estrangeira.
 */
function nx_is_foreign_key(Throwable $exception): bool
{
    if (!$exception instanceof PDOException) {
        return false;
    }

    $driverCode = $exception->errorInfo[1] ?? null;

    return (int) $driverCode === 1451
        || (int) $driverCode === 1452
        || str_contains(strtolower($exception->getMessage()), 'foreign key');
}
