# Relatório de Homologação — NEXUS TECH (versão PHP)

- **Projeto:** NEXUS TECH — port PHP + MySQL
- **Pasta da aplicação:** `nexu.php/`
- **Data da análise:** 11/11/2026
- **Escopo:** schema do banco, configuração, ponto de entrada, `.htaccess`, segurança, testes estáticos, testes funcionais e checklist manual.

## 1. Resumo executivo

A aplicação está **aprovada na homologação estática**: 37 arquivos PHP passam no lint, todas as funções chamadas estão definidas, todos os formulários POST possuem CSRF, o schema contém as tabelas/colunas usadas pelo código e os hashes das contas de demonstração conferem.

A homologação **dinâmica (MySQL + HTTP) não foi executada neste ambiente** e permanece pendente. O PHP CLI disponível (`C:\php\php.exe` 8.5.8) não possui `pdo_mysql` habilitado e não há servidor MySQL em execução. Nenhum teste dependente de banco é declarado como aprovado neste relatório.

## 2. Ambiente da análise

| Item | Situação |
|---|---|
| PHP CLI | `C:\php\php.exe` 8.5.8 |
| Extensões | `mbstring`, `pdo`, `json` presentes; `pdo_mysql` **ausente** |
| MySQL | **não iniciado**; instalação local sem `bin/` utilizável |
| XAMPP | não instalado nesta máquina (`C:\xampp\php` inexistente) |
| Docker | indisponível |
| Testes executados | lint, análise estática, utilitários, sessão/CSRF/flash/rate limit, servidor embutido para assets e bloqueios |
| Testes não executados | qualquer consulta real ao MySQL, login HTTP, CRUD, carrinho, checkout, painel admin |

## 3. Arquivos analisados

- `nexu.php/database/script.sql` — schema, índices, chaves estrangeiras e seed.
- `nexu.php/includes/config.php` — credenciais, paths, constantes de serviço.
- `nexu.php/includes/db.php` — conexão PDO, transações, diagnóstico de erros.
- `nexu.php/includes/functions.php` — sessão, CSRF, flash, rate limit, slug, dinheiro.
- `nexu.php/includes/validation.php` — cadastro, login, perfil, checkout, produto, entidades.
- `nexu.php/includes/repository.php` — todas as consultas SQL e CRUD administrativo.
- `nexu.php/includes/auth.php` — autenticação de cliente/admin e guards.
- `nexu.php/includes/cart.php` — carrinho em sessão e estoque.
- `nexu.php/index.php`, `nexu.php/pages/*.php`, `nexu.php/admin/*.php` — fluxos HTTP.
- `nexu.php/.htaccess`, `.htaccess` de `includes/`, `database/`, `logs/`, `tests/`.
- `nexu.php/router.php` — servidor embutido e bloqueios de diretórios internos.
- `nexu.php/tests/smoke_static.php` e `nexu.php/tests/smoke_db.php` — testes preparados nesta etapa.

## 4. Testes executados e resultados

### 4.1 Teste estático automatizado

Comando (na raiz do projeto):

```powershell
& "C:\php\php.exe" "nexu.php\tests\smoke_static.php"
```

Resultado: **64 verificações, 0 falhas** (exit code 0). Cobertura:

| Grupo | Resultado |
|---|---|
| Ambiente e extensões | PHP 8.5.8, mbstring, PDO, JSON OK; `pdo_mysql` sinalizado como ausente (aviso, não falha do código) |
| Estrutura | 13 páginas da loja, 9 páginas admin, assets e includes obrigatórios presentes |
| Lint | **37 arquivos PHP sem erro de sintaxe** |
| Funções `nx_` | **105 definições, 105 únicas**; nenhuma chamada sem definição |
| Formulários | todo `<form method="post">` contém campo CSRF |
| Links | nenhum link `href` remanescente para `.html` |
| Schema | 11 tabelas e colunas críticas de `orders`, `users`, `user_profile`, `admin_actions`, `inventory` presentes |
| Seed | 2 hashes bcrypt; `Admin@123` e `Cliente@123` validados com `password_verify` |
| Utilitários | `nx_money`, `nx_price_to_cents`, `nx_slugify` (acentos e símbolos) |
| Validações | cadastro, produto e checkout com dados válidos |
| Sessão/segurança | token CSRF de 64 caracteres, rejeição de token inválido, campo CSRF renderizado |
| Flash | erro renderizado com classe `alert--danger` |
| Rate limit | bloqueio na 3ª tentativa com limite 2 |

### 4.2 Bloqueios do servidor embutido

Servidor iniciado com `php -S 127.0.0.1:8099 router.php`; cada URL foi requisitada e o servidor encerrado ao final.

| URL | Status | Esperado |
|---|---|---|
| `/assets/css/style.css` | 200 | 200 |
| `/includes/config.php` | 404 | 404 |
| `/database/script.sql` | 404 | 404 |
| `/tests/smoke_static.php` | 404 | 404 |
| `/%2e%2e/includes/config.php` | 404 | 404 |
| `/includes%5cconfig.php` | 404 | 404 |

Resultado: **6/6 conforme esperado**. Esse teste revelou e validou a correção de uma falha de path traversal descrita na seção 5.

### 4.3 Teste de integração com MySQL (preparado, não executado)

Comando:

```powershell
& "C:\xampp\php\php.exe" "nexu.php\tests\smoke_db.php"
```

Neste ambiente o comando encerrou com **exit code 2** e a mensagem:

```text
NAO EXECUTADO: MySQL indisponível — Não foi possível conectar ao banco de dados. Verifique se o MySQL está iniciado e se o banco foi importado (database/script.sql).
```

O script é **somente leitura** e, quando executado no XAMPP, verifica: conexão, tabelas, colunas, charset `utf8mb4`, índice de idempotência, seed, login das duas contas, catálogo com busca/filtros/ordenações, detalhes de produto, indicadores do admin, listagens administrativas, auditoria e perfil/pedidos do cliente. **Nenhum resultado de banco deve ser considerado aprovado até que esse comando seja executado com MySQL ativo.**

## 5. Problemas encontrados e correções nesta etapa

| # | Severidade | Problema | Correção |
|---|---|---|---|
| 1 | **Alta** | `router.php` permitia bypass dos diretórios internos usando `..` ou `%5c` (barra invertida no Windows), podendo executar `includes/config.php` e outros arquivos. | `router.php:9-19`: normalização de `\` para `/` e rejeição de `..`, byte nulo, dotfiles e dos diretórios `includes`, `database`, `logs`, `tests`. Validado no teste 4.2. |
| 2 | Média | Servidor embutido servia `.htaccess` e arquivos de `tests/`; o Apache não bloqueava `tests/`. | `.htaccess:16` e novo `tests/.htaccess` com `Require all denied`; `router.php` bloqueia `tests`. |
| 3 | Média | Sem a extensão `intl`, `nx_slugify` dependia de `iconv` e gerava slugs quebrados (`acess-orios-perif-ericos`). | `functions.php:226`: mapa explícito de transliteração pt-BR/Latim como fallback. Teste agora retorna `acessorios-perifericos`. |
| 4 | Baixa | Auditoria registrava entidade `categorie` (uso de `rtrim($type, 's')`). | `repository.php:827` cria `nx_admin_entity_noun()` e os dois pontos de auditoria (`:883`, `:918`) passam a registrar `category`. |
| 5 | Baixa | Ao atualizar perfil, conflito de CPF exibia mensagem dizendo apenas "e-mail em uso". | `pages/perfil.php:47`: mensagem alterada para "Este e-mail ou CPF já está em uso por outra conta." |

### Correções da fase de portabilidade (registradas para rastreabilidade)

- `nx_render_flash()` foi reescrito para ler todas as chaves de flash (antes chamava `nx_flash_get()` sem argumento) e mapear `error` para `alert--danger`.
- `nx_render_errors()` passou a usar `alert--danger`.
- Criado `nx_render_admin_flash()` e aplicado nas telas administrativas.
- `pages/login.php` passou a incluir `components.php` e a exibir flash.
- Classes dos formulários administrativos corrigidas para as classes CSS existentes (`admin-form__field`, `admin-form__label`, `admin-input--textarea`, etc.).
- `pages/faq.php` passou a carregar o script com `type="module"`.
- `admin/index.php` passou a exigir autenticação antes de consultar indicadores.
- Salvamentos de produto/marca/categoria tratam violação de unicidade (`nx_is_duplicate`) e registram log.
- `router.php` passou a devolver uma página 404 real em vez da home.
- Links `.html` (inclusive com fragmento) convertidos para `.php`.
- CSS administrativo complementar acrescentado para o formulário de logout; nenhum layout existente foi alterado.

## 6. Pontos de atenção (não bloqueantes)

1. **Formulário de contato não envia e-mail nem persiste mensagem**; apenas valida, registra em log e exibe confirmação. Se a entrega real for requisito, integrar SMTP/fila em etapa futura.
2. **Rate limit é por sessão**. Limpar cookies reinicia o contador; para proteção mais forte usar IP + tabela/Redis.
3. **Idempotência do checkout**: `client_idempotency_key` é gerada aleatoriamente a cada pedido, e não a partir do formulário. O índice único existe, mas não impede duplo clique em requisições simultâneas. O carrinho é limpo após sucesso, o que reduz o risco.
4. **Erros fatais de banco** exibem a mensagem padrão do PHP conforme `display_errors` do ambiente. Em produção, desativar `display_errors` e manter o log em `logs/`.
5. **Sem CSP** e sem HSTS; cabeçalhos atuais limitam-se a `nosniff`, `SAMEORIGIN` e `Referrer-Policy`. O cookie de sessão só recebe `Secure` sob HTTPS.
6. **Classes sem CSS** herdadas do projeto original (`btn--sm`, `hero__content`, `product-buy__form`, `profile-logout`, entre outras) permanecem sem estilo; não foram alteradas para não modificar o layout.
7. **Imagens de produto** usam placeholders SVG e miniaturas estáticas (sem JS de galeria), conforme decisão de portabilidade.
8. **Apache**: o `.htaccess` exige `AllowOverride All` (padrão do XAMPP) e `mod_rewrite`; sem ele, os `.htaccess` internos ainda bloqueiam os diretórios sensíveis.

## 7. Instruções exatas para homologação manual (XAMPP)

1. Copie a pasta `nexu.php` para `C:\xampp\htdocs\nexu.php` (o caminho final deve ser `C:\xampp\htdocs\nexu.php\index.php`).
2. Abra o XAMPP Control Panel e inicie **Apache** e **MySQL**.
3. Importe `C:\xampp\htdocs\nexu.php\database\script.sql` pelo phpMyAdmin (banco `nexus_tech_db`).
4. Confirme em `nexu.php/includes/config.php`: host `127.0.0.1`, porta `3306`, banco `nexus_tech_db`, usuário `root`, senha vazia (ou ajuste/defina `config.local.php`).
5. Acesse `http://localhost/nexu.php/`.
6. Execute os testes automatizados de banco:

```powershell
cd C:\xampp\htdocs\nexu.php
C:\xampp\php\php.exe tests\smoke_static.php
C:\xampp\php\php.exe tests\smoke_db.php
```

Resultado esperado: `smoke_static.php` com 0 falhas e `smoke_db.php` com 0 falhas (exit code 0).

### 7.1 Checklist funcional da loja

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | Home | Carrega sem erro SQL; destaques, ofertas e mais vendidos aparecem |
| 2 | Catálogo `/pages/produtos.php` | Lista paginada; busca, categoria, marca, preço e disponibilidade filtram |
| 3 | Ordenações | Preço asc/desc, avaliação, novidades e relevância sem erro |
| 4 | Produto | Especificações, imagens, estoque, avaliação e relacionados corretos |
| 5 | Adicionar ao carrinho | Redireciona, item aparece com quantidade e subtotal |
| 6 | Carrinho | Alterar quantidade, remover, limite de 99 e aviso de estoque |
| 7 | Checkout | Campos obrigatórios validados; frete padrão/expresso e frete grátis acima de R$ 500,00 |
| 8 | Pedido | Cria pedido `NT-XXXXXXXXXX`, baixa estoque, limpa carrinho e aparece em Minha conta |
| 9 | Cadastro | E-mail/CPF duplicados bloqueados; senha fraca rejeitada; termos/privacidade obrigatórios |
| 10 | Login/logout cliente | Sessão regenerada; logout por POST com CSRF |
| 11 | Perfil | Atualizar dados, trocar senha e listar pedidos |
| 12 | Institucionais | FAQ (acordeão), Ajuda, Sobre, Termos e Privacidade sem links quebrados |
| 13 | Contato | Validação, mensagem de sucesso e bloqueio após 5 envios em 10 minutos |
| 14 | 404 | URL inexistente devolve página 404 |

### 7.2 Checklist do painel administrativo

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | `/admin/` sem login | Redireciona para `/admin/login.php` |
| 2 | Login `admin@nexustech.com` / `Admin@123` | Entra no dashboard |
| 3 | Senha errada | Mensagem genérica; após 8 tentativas em 5 minutos, bloqueio |
| 4 | Dashboard | Indicadores e últimas ações sem erro |
| 5 | Criar produto | Grava produto, especificações, imagens e estoque; aparece no catálogo |
| 6 | Slug duplicado | Erro amigável, sem stack trace |
| 7 | Editar produto | Campos carregados e persistidos |
| 8 | Desativar/ativar | Produto sai/volta ao catálogo |
| 9 | Criar/editar marca e categoria | Listagens e selects atualizados |
| 10 | Excluir marca/categoria com produtos | Bloqueado com contagem de vínculos |
| 11 | Excluir marca/categoria sem produtos | Exclui e registra auditoria |
| 12 | Auditoria | Antes/depois em JSON e nome do admin na listagem |
| 13 | Logout | POST com CSRF; sessão encerrada |

### 7.3 Checklist de segurança manual

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | `http://localhost/nexu.php/includes/config.php` | 404/403 |
| 2 | `http://localhost/nexu.php/database/script.sql` | 404/403 |
| 3 | `http://localhost/nexu.php/logs/nexus-php.log` | 404/403 |
| 4 | POST em formulário sem `csrf_token` | HTTP 419 |
| 5 | Busca com `' OR 1=1 --` | Tratada como texto, sem erro SQL |
| 6 | Nome de produto com `<script>` | Exibido escapado |
| 7 | Cookie de sessão | `HttpOnly` e `SameSite=Lax` (e `Secure` sob HTTPS) |
| 8 | Redirecionamento `//evil.com` | Convertido para `index.php` |

## 8. Conclusão

- **Homologação estática: aprovada** — 64 verificações automatizadas sem falhas, incluindo lint de 37 arquivos, schema, CSRF, seed e bloqueios do servidor.
- **Homologação dinâmica: pendente** — depende de MySQL ativo e execução no XAMPP. O script `tests/smoke_db.php` e o checklist acima estão prontos para essa etapa.
- Nenhum recurso foi removido, nenhum layout foi alterado e `database/script.sql` foi preservado sem alteração. As correções desta etapa estão listadas na seção 5.
