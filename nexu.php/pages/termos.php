<?php
declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Termos e Condições — Nexus Tech';
$pageDesc = 'Termos e condições de uso da Nexus Tech: uso do site, produtos e preços, pedidos, pagamentos, entrega, trocas e propriedade intelectual.';
$bodyPage = 'terms';
$extraScripts = '';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/components.php';
require __DIR__ . '/../includes/header.php';
?>

<main>
    <section class="institutional" aria-labelledby="terms-title">
      <div class="container">

        <div class="institutional__header">

          <nav class="breadcrumb" aria-label="Trilha de navegação">
            <ol class="breadcrumb__list">
              <li class="breadcrumb__item">
                <a href="../index.php" class="breadcrumb__link">Home</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <a href="sobre.php" class="breadcrumb__link">Institucional</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <span class="breadcrumb__current" aria-current="page">Termos e Condições</span>
              </li>
            </ol>
          </nav>

          <h1 id="terms-title" class="institutional__title">
            Termos e <span class="institutional__title-accent">Condições</span>
          </h1>

        </div>

        <div class="legal-document">

          <p class="legal-document__date">
            Última atualização: 08 de setembro de 2026.
          </p>

          <section aria-labelledby="terms-intro">
            <h2 id="terms-intro">1. Aceitação dos termos</h2>
            <p>
              Ao acessar e utilizar o site da Nexus Tech, você concorda com os
              termos e condições descritos neste documento. Se não concordar com
              alguma parte, pedimos que não utilize o site.
            </p>
            <p>
              Esta é a <strong>versão de estrutura</strong> dos nossos termos. Como
              o e-commerce ainda está em desenvolvimento, este documento estabelece
              as bases que regerão a operação quando a venda e o catálogo forem
              integrados ao banco de dados.
            </p>
          </section>

          <section aria-labelledby="terms-uso">
            <h2 id="terms-uso">2. Uso do site</h2>
            <p>
              Você concorda em utilizar o site apenas para finalidades lícitas e
              em não:
            </p>
            <ul>
              <li>Interferir no funcionamento do site ou tentar acessar áreas restritas;</li>
              <li>Praticar qualquer forma de fraude ou falsidade no cadastro e nos pedidos;</li>
              <li>Reproduzir, copiar ou explorar o conteúdo do site sem autorização;</li>
              <li>Utilizar o site para enviar conteúdo ilegal ou malicioso.</li>
            </ul>
          </section>

          <section aria-labelledby="terms-produtos">
            <h2 id="terms-produtos">3. Produtos e preços</h2>
            <p>
              As informações do catálogo — descrições, especificações, imagens e
              preços — são apresentadas a título de demonstração nesta fase do
              projeto e podem conter dados fictícios.
            </p>
            <p>
              Os preços exibidos podem ser alterados sem aviso prévio e confirmados
              somente no fechamento do pedido. Esforçamo-nos para manter a precisão
              das informações, mas eventuais erros poderão ser corrigidos antes da
              confirmação.
            </p>
          </section>

          <section aria-labelledby="terms-pedidos">
            <h2 id="terms-pedidos">4. Pedidos</h2>
            <ul>
              <li>O pedido é considerado confirmado após a aprovação do pagamento;</li>
              <li>Reservamo-nos o direito de cancelar pedidos em caso de suspeita de fraude ou indisponibilidade de estoque;</li>
              <li>Comunicações sobre o pedido serão enviadas para o e-mail cadastrado;</li>
              <li>O histórico e o acompanhamento de pedidos estarão disponíveis quando a área da conta for ativada.</li>
            </ul>
          </section>

          <section aria-labelledby="terms-pagamentos">
            <h2 id="terms-pagamentos">5. Pagamentos</h2>
            <p>
              Aceitamos cartões de crédito, Pix e boleto bancário. Os dados de
              pagamento são processados por meios de pagamento seguros e não são
              armazenados pela Nexus Tech.
            </p>
            <p>
              O processamento financeiro do checkout será habilitado na etapa de
              integração com a API; nesta fase não há cobrança efetiva de valores.
            </p>
          </section>

          <section aria-labelledby="terms-entrega">
            <h2 id="terms-entrega">6. Entrega</h2>
            <ul>
              <li>Os prazos de entrega são informados no fechamento do pedido;</li>
              <li>Após o despacho, o código de rastreamento é enviado por e-mail;</li>
              <li>O endereço de entrega deve ser informado de forma correta e completa pelo cliente;</li>
              <li>Em caso de ausência no endereço, a transportadora poderá realizar novas tentativas conforme suas regras.</li>
            </ul>
          </section>

          <section aria-labelledby="terms-trocas">
            <h2 id="terms-trocas">7. Trocas e devoluções</h2>
            <p>
              Você pode desistir da compra em até 7 dias corridos após o recebimento
              do produto, conforme o Código de Defesa do Consumidor.
            </p>
            <p>
              Produtos com defeito podem ser trocados dentro do prazo de garantia,
              mediante análise. As condições completas estão na página de
              <a href="faq.php#trocas-devolucoes">trocas e devoluções</a>.
            </p>
          </section>

          <section aria-labelledby="terms-responsabilidades">
            <h2 id="terms-responsabilidades">8. Responsabilidades</h2>
            <p>
              A Nexus Tech não se responsabiliza por danos decorrentes de uso
              indevido dos produtos, informações incorretas fornecidas pelo cliente
              ou falhas causadas por terceiros (como empresas transportadoras e
              meios de pagamento), ressalvadas as hipóteses previstas em lei.
            </p>
          </section>

          <section aria-labelledby="terms-propriedade">
            <h2 id="terms-propriedade">9. Propriedade intelectual</h2>
            <p>
              Todos os conteúdos do site — textos, logotipos, imagens, gráficos e
              elementos visuais — são de propriedade da Nexus Tech ou de seus
              licenciantes. É proibida a reprodução sem autorização prévia por
              escrito.
            </p>
          </section>

          <section aria-labelledby="terms-alteracoes">
            <h2 id="terms-alteracoes">10. Alterações destes termos</h2>
            <p>
              Podemos atualizar estes termos periodicamente para refletir mudanças
              legais ou de operação. A versão mais recente estará sempre disponível
              nesta página, com a data de atualização no topo.
            </p>
          </section>

          <section aria-labelledby="terms-contato-sec">
            <h2 id="terms-contato-sec">11. Contato</h2>
            <p>
              Em caso de dúvidas sobre estes termos, fale conosco pela página de
              <a href="contato.php">contato</a> ou pelo e-mail
              <a href="mailto:contato@nexustech.com.br">contato@nexustech.com.br</a>.
            </p>
          </section>

        </div>

      </div>
    </section>
  </main>

<?php require __DIR__ . '/../includes/footer.php'; ?>