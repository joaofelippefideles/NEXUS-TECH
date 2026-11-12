<?php
declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Perguntas Frequentes — Nexus Tech';
$pageDesc = 'Perguntas frequentes da Nexus Tech: pedidos, pagamentos, entrega, trocas e devoluções, produtos e conta.';
$bodyPage = 'faq';
$extraScripts = '<script type="module" src="../assets/js/modules/institutional/faq.js"></script>';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/components.php';
require __DIR__ . '/../includes/header.php';
?>

<main>
    <section class="institutional" aria-labelledby="faq-title">
      <div class="container">

        <div class="institutional__header">

          <nav class="breadcrumb" aria-label="Trilha de navegação">
            <ol class="breadcrumb__list">
              <li class="breadcrumb__item">
                <a href="../index.php" class="breadcrumb__link">Home</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <a href="ajuda.php" class="breadcrumb__link">Ajuda</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <span class="breadcrumb__current" aria-current="page">FAQ</span>
              </li>
            </ol>
          </nav>

          <h1 id="faq-title" class="institutional__title">
            Perguntas <span class="institutional__title-accent">frequentes</span>
          </h1>

          <p class="institutional__lead">
            As respostas para as dúvidas mais comuns, organizadas por assunto.
            Clique em uma pergunta para abrir a resposta. Use as setas do teclado
            para navegar entre as perguntas.
          </p>

        </div>

        
        <section class="faq-section" id="pedidos" aria-labelledby="faq-pedidos">
          <h2 id="faq-pedidos" class="faq-section__title">Pedidos</h2>

          <div class="faq-accordion" data-accordion="single">

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-pedidos-btn-1"
                  aria-expanded="false"
                  aria-controls="faq-pedidos-panel-1"
                >
                  Como faço um pedido na Nexus Tech?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-pedidos-panel-1" role="region" aria-labelledby="faq-pedidos-btn-1" hidden>
                <p>
                  Escolha o produto no catálogo, clique em "Adicionar ao carrinho" e
                  finalize a compra confirmando os dados de entrega e pagamento. Após a
                  confirmação, você recebe o número do pedido por e-mail.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-pedidos-btn-2"
                  aria-expanded="false"
                  aria-controls="faq-pedidos-panel-2"
                >
                  Posso alterar um pedido depois de confirmado?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-pedidos-panel-2" role="region" aria-labelledby="faq-pedidos-btn-2" hidden>
                <p>
                  Pedidos já confirmados podem ser alterados apenas se ainda não tiverem
                  sido separados no estoque. Neste caso, fale conosco o quanto antes.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-pedidos-btn-3"
                  aria-expanded="false"
                  aria-controls="faq-pedidos-panel-3"
                >
                  Como acompanho o status do meu pedido?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-pedidos-panel-3" role="region" aria-labelledby="faq-pedidos-btn-3" hidden>
                <p>
                  Assim que o pedido é despachado, enviamos o código de rastreio por
                  e-mail. A área de acompanhamento e a notificação automática serão
                  liberadas na próxima entrega (integração com a API).
                </p>
              </div>
            </div>

          </div>
        </section>

        
        <section class="faq-section" id="pagamentos" aria-labelledby="faq-pagamentos">
          <h2 id="faq-pagamentos" class="faq-section__title">Pagamentos</h2>

          <div class="faq-accordion" data-accordion="single">

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-pagamentos-btn-1"
                  aria-expanded="false"
                  aria-controls="faq-pagamentos-panel-1"
                >
                  Quais formas de pagamento são aceitas?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-pagamentos-panel-1" role="region" aria-labelledby="faq-pagamentos-btn-1" hidden>
                <p>
                  Aceitamos cartões de crédito (Visa, Mastercard, entre outras bandeiras),
                  Pix e boleto bancário. O Pix é aprovado em poucos minutos.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-pagamentos-btn-2"
                  aria-expanded="false"
                  aria-controls="faq-pagamentos-panel-2"
                >
                  O boleto tem data de vencimento?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-pagamentos-panel-2" role="region" aria-labelledby="faq-pagamentos-btn-2" hidden>
                <p>
                  Sim. O boleto vence em 2 dias úteis após a geração. Após o vencimento,
                  o pedido é cancelado automaticamente.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-pagamentos-btn-3"
                  aria-expanded="false"
                  aria-controls="faq-pagamentos-panel-3"
                >
                  Quando recebo a nota fiscal?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-pagamentos-panel-3" role="region" aria-labelledby="faq-pagamentos-btn-3" hidden>
                <p>
                  A nota fiscal eletrônica é enviada por e-mail assim que o pagamento é
                  confirmado, geralmente em até 24 horas.
                </p>
              </div>
            </div>

          </div>
        </section>

        
        <section class="faq-section" id="entrega" aria-labelledby="faq-entrega">
          <h2 id="faq-entrega" class="faq-section__title">Entrega</h2>

          <div class="faq-accordion" data-accordion="single">

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-entrega-btn-1"
                  aria-expanded="false"
                  aria-controls="faq-entrega-panel-1"
                >
                  Qual o prazo de entrega?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-entrega-panel-1" role="region" aria-labelledby="faq-entrega-btn-1" hidden>
                <p>
                  Os prazos variam de acordo com a região e a forma de envio escolhida,
                  entre 3 e 12 dias úteis. O prazo exato é informado no fechamento do pedido.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-entrega-btn-2"
                  aria-expanded="false"
                  aria-controls="faq-entrega-panel-2"
                >
                  Posso acompanhar o rastreamento?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-entrega-panel-2" role="region" aria-labelledby="faq-entrega-btn-2" hidden>
                <p>
                  Sim. O código de rastreio é enviado por e-mail após o despacho e pode
                  ser consultado no site da transportadora.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-entrega-btn-3"
                  aria-expanded="false"
                  aria-controls="faq-entrega-panel-3"
                >
                  Não recebi meu pedido, o que fazer?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-entrega-panel-3" role="region" aria-labelledby="faq-entrega-btn-3" hidden>
                <p>
                  Confira o prazo informado no pedido. Se o prazo já passou, entre em
                  contato pela página de <a href="contato.php">contato</a> com o número do pedido em mãos.
                </p>
              </div>
            </div>

          </div>
        </section>

        
        <section class="faq-section" id="trocas-devolucoes" aria-labelledby="faq-trocas">
          <h2 id="faq-trocas" class="faq-section__title">Trocas e devoluções</h2>

          <div class="faq-accordion" data-accordion="single">

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-trocas-btn-1"
                  aria-expanded="false"
                  aria-controls="faq-trocas-panel-1"
                >
                  Qual o prazo para desistir da compra?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-trocas-panel-1" role="region" aria-labelledby="faq-trocas-btn-1" hidden>
                <p>
                  Você pode solicitar o cancelamento em até 7 dias corridos após o
                  recebimento, conforme o Código de Defesa do Consumidor.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-trocas-btn-2"
                  aria-expanded="false"
                  aria-controls="faq-trocas-panel-2"
                >
                  Como funciona a troca de um produto com defeito?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-trocas-panel-2" role="region" aria-labelledby="faq-trocas-btn-2" hidden>
                <p>
                  Entre em contato dentro do prazo de garantia informado no produto. Após a
                  análise, enviamos a etiqueta de devolução e realizamos a troca sem custo.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-trocas-btn-3"
                  aria-expanded="false"
                  aria-controls="faq-trocas-panel-3"
                >
                  O reembolso é feito de que forma?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-trocas-panel-3" role="region" aria-labelledby="faq-trocas-btn-3" hidden>
                <p>
                  O reembolso segue a forma de pagamento original: estorno no cartão ou
                  devolução via Pix no prazo de até 10 dias úteis.
                </p>
              </div>
            </div>

          </div>
        </section>

        
        <section class="faq-section" id="produtos" aria-labelledby="faq-produtos">
          <h2 id="faq-produtos" class="faq-section__title">Produtos</h2>

          <div class="faq-accordion" data-accordion="single">

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-produtos-btn-1"
                  aria-expanded="false"
                  aria-controls="faq-produtos-panel-1"
                >
                  Os produtos possuem garantia?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-produtos-panel-1" role="region" aria-labelledby="faq-produtos-btn-1" hidden>
                <p>
                  Sim. Todos os produtos contam com garantia legal de 90 dias, além da
                  garantia do fabricante informada na página de cada produto.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-produtos-btn-2"
                  aria-expanded="false"
                  aria-controls="faq-produtos-panel-2"
                >
                  A disponibilidade de estoque é em tempo real?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-produtos-panel-2" role="region" aria-labelledby="faq-produtos-btn-2" hidden>
                <p>
                  Hoje a disponibilidade é informativa. A consulta em tempo real será
                  habilitada quando o catálogo for integrado ao banco de dados.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-produtos-btn-3"
                  aria-expanded="false"
                  aria-controls="faq-produtos-panel-3"
                >
                  Posso comparar produtos antes de comprar?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-produtos-panel-3" role="region" aria-labelledby="faq-produtos-btn-3" hidden>
                <p>
                  A comparação lado a lado ainda não está disponível. Enquanto isso,
                  confira as especificações completas na página de cada produto.
                </p>
              </div>
            </div>

          </div>
        </section>

        
        <section class="faq-section" id="conta" aria-labelledby="faq-conta">
          <h2 id="faq-conta" class="faq-section__title">Conta</h2>

          <div class="faq-accordion" data-accordion="single">

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-conta-btn-1"
                  aria-expanded="false"
                  aria-controls="faq-conta-panel-1"
                >
                  Como crio uma conta?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-conta-panel-1" role="region" aria-labelledby="faq-conta-btn-1" hidden>
                <p>
                  A criação de conta e as áreas de perfil ainda serão disponibilizadas.
                  Por enquanto, o acompanhamento dos pedidos é feito pelo e-mail cadastrado.
                </p>
              </div>
            </div>

            <div class="faq-accordion__item">
              <h3>
                <button
                  type="button"
                  class="faq-accordion__btn"
                  id="faq-conta-btn-2"
                  aria-expanded="false"
                  aria-controls="faq-conta-panel-2"
                >
                  Esqueci minha senha. O que faço?
                  <span class="faq-accordion__icon" aria-hidden="true">+</span>
                </button>
              </h3>
              <div class="faq-accordion__panel" id="faq-conta-panel-2" role="region" aria-labelledby="faq-conta-btn-2" hidden>
                <p>
                  Quando a área da conta estiver ativa, a recuperação de senha será feita
                  por e-mail. Até lá, qualquer dúvida pode ser tratada pelo nosso atendimento.
                </p>
              </div>
            </div>

          </div>
        </section>

      </div>
    </section>
  </main>

<?php require __DIR__ . '/../includes/footer.php'; ?>