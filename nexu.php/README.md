# NEXUS TECH — versão PHP

Port completo do site NEXUS TECH para PHP + MySQL (XAMPP), mantendo o design original.

## Requisitos

- PHP 8.1+ com extensões `pdo_mysql` e `mbstring` (o PHP do XAMPP já inclui)
- MySQL 5.7+ / MariaDB 10.4+
- Apache com `mod_rewrite` (opcional) ou o servidor embutido do PHP

## Instalação (XAMPP)

1. Copie a pasta `nexu.php` para `C:\xampp\htdocs\nexu.php`.
2. Inicie o Apache e o MySQL no painel do XAMPP.
3. Importe o banco:
   - phpMyAdmin → Importar → `database/script.sql`
   - ou via terminal: `mysql -u root -p < database/script.sql`
4. Ajuste as credenciais em `includes/config.php` se necessário (padrão: host `127.0.0.1`, banco `nexus_tech_db`, usuário `root`, senha vazia).
5. Acesse `http://localhost/nexu.php/`.

### Servidor embutido do PHP

```bash
php -S localhost:8000 router.php
```

## Contas de demonstração

| Perfil   | E-mail                  | Senha        |
|----------|-------------------------|--------------|
| Admin    | admin@nexustech.com     | Admin@123    |
| Cliente  | cliente@nexustech.com   | Cliente@123  |

## Estrutura

```
nexu.php/
├── admin/                 Painel administrativo (login, dashboard, CRUD)
├── assets/                CSS, JS e imagens (copiados do projeto original)
├── database/script.sql    Schema + dados de exemplo
├── includes/              Config, funções, banco, auth, carrinho, validação, repositório
├── logs/                  Log de aplicação (gravável pelo PHP)
├── pages/                 Páginas internas da loja
├── index.php              Home
├── router.php             Roteador para o servidor embutido
└── .htaccess              Configuração do Apache
```

## Funcionalidades

- Catálogo com busca, filtros (categoria, marca, preço, disponibilidade) e ordenação.
- Página de produto com especificações, avaliação visual, produtos relacionados e adicionar ao carrinho.
- Carrinho em sessão (limite de 99 unidades por item, validação de estoque).
- Checkout com cálculo de frete, criação de pedido transacional e baixa de estoque.
- Cadastro/login de clientes (bcrypt, CSRF, rate limit) e área "Minha conta" com pedidos.
- Páginas institucionais (FAQ, ajuda, sobre, termos, privacidade, contato).
- Painel admin: dashboard com indicadores, CRUD de produtos/marcas/categorias, auditoria de ações.

## Testes

Com o MySQL ativo e o banco importado, execute na pasta do projeto:

```bash
php tests/smoke_static.php   # não precisa de MySQL
php tests/smoke_db.php       # somente leitura; exige MySQL
```

O relatório completo da homologação está em `../Docs/RELATORIO_HOMOLOGACAO_PHP.md`.

## Segurança

- PDO com prepared statements; nenhuma concatenação de entrada do usuário.
- CSRF em todos os formulários POST.
- Sessões com cookie `HttpOnly`, `SameSite=Lax` e regeneração de ID no login.
- Rate limit para login, cadastro e contato.
- Diretórios sensíveis (`includes`, `database`, `logs`) bloqueados via `.htaccess`.
