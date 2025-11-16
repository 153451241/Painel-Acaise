/*
  ==========================================================
  PAINEL.JS (VERSÃO PUSHER/WORKER - FINAL)
  - Sem Firebase (usa Pusher para receber pedidos em tempo real)
  - Sem histórico/PDF (apenas sessão atual)
  - Impressão automática
  ==========================================================
*/

// ==========================================================
// 1. CONFIGURAÇÃO DA "CAMPAINHA" (PUSHER)
// ==========================================================
const PUSHER_KEY = "e79d1140ca7a4250c29d"; // Sua chave pública
const PUSHER_CLUSTER = "sa1"; // Seu cluster (São Paulo)

// ==========================================================
// 2. ESTADO GLOBAL DO PAINEL
// ==========================================================
let todosPedidosDoDia = []; // Lista temporária (reseta ao atualizar a página)
let filtroAtual = "NOVOS";  // Filtro padrão inicial

// Configuração de Áudio
const audioAlarme = new Audio("sounds/toque.mp3");
audioAlarme.volume = 1.0;
audioAlarme.loop = true;
let alarmeTocando = false;

// ==========================================================
// 3. FUNÇÕES AUXILIARES
// ==========================================================
const brl = (n) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

function formatarHora(dataISO) {
  try {
    return new Date(dataISO).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "--:--";
  }
}

function iniciarAlarme() {
  if (!alarmeTocando) {
    audioAlarme.play().catch(() => console.warn("Alarme bloqueado pelo navegador (necessário interação)."));
    alarmeTocando = true;
  }
}

function pararAlarme() {
  if (alarmeTocando) {
    audioAlarme.pause();
    audioAlarme.currentTime = 0;
    alarmeTocando = false;
  }
}

// ==========================================================
// 4. FUNÇÃO DE IMPRESSÃO (Formatada para 80mm)
// ==========================================================
function imprimirComanda(pedido) {
  const loja = document.getElementById("comanda-loja");
  const lista = document.getElementById("comanda-lista");
  const total = document.getElementById("comanda-total");
  const tipo = document.getElementById("comanda-tipo");
  const cliente = document.getElementById("comanda-cliente");
  const endereco = document.getElementById("comanda-endereco");
  const pagamento = document.getElementById("comanda-pagamento");
  const obsPagamento = document.getElementById("comanda-obs-pagamento");

  if (!loja || !lista || !total) return;

  // ⚠️ MUDE O NOME DA NOVA LOJA AQUI
  loja.textContent = `NOVA LOJA - Pedido #${pedido.codigo}`;

  lista.innerHTML = "";
  pedido.itens.forEach((it) => {
    const li = document.createElement("li");
    // Como não temos a função formatarItemAcai aqui, usamos o nome direto.
    // Se precisar da formatação complexa, podemos trazer ela pra cá também.
    let nomeHtml = `<b>${it.name}</b>`; 
    if (it.obs) {
      nomeHtml += ` <br><i>(Obs: ${it.obs})</i>`;
    }
    li.innerHTML = `${nomeHtml} <span>${brl(it.price)}</span>`;
    lista.appendChild(li);
  });

  total.innerHTML = `
    Subtotal: ${brl(pedido.subtotal)}<br>
    Entrega: ${brl(pedido.taxa)}<br>
    <span style="border-top: 1px dashed #000; display: block; padding-top: 2mm; margin-top: 2mm; font-weight: bold;">
      TOTAL: ${brl(pedido.total)}
    </span>
  `;

  const eRetirada = pedido.endereco === "Retirada no local";
  tipo.textContent = eRetirada ? "*** RETIRADA ***" : "*** ENTREGA ***";
  cliente.textContent = `Cliente: ${pedido.nomeCliente}`;
  endereco.textContent = pedido.endereco;
  pagamento.textContent = `Pagamento: ${pedido.pagamento}`;
  obsPagamento.textContent = pedido.obsPagamento || "";

  // Tenta imprimir automaticamente
  setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error("Erro ao tentar imprimir:", e);
      }
  }, 500);
}

// ==========================================================
// 5. FUNÇÕES DE RENDERIZAÇÃO DA TELA (KANBAN)
// ==========================================================
function atualizarTela() {
  const container = document.getElementById("lista-pedidos-container");
  if (!container) return;

  let filtrados = [];
  switch (filtroAtual) {
    case "NOVOS":
      filtrados = todosPedidosDoDia.filter(p => p.status === "pendente");
      break;
    case "EM_PREPARO":
      filtrados = todosPedidosDoDia.filter(p => p.status === "em_preparo");
      break;
    case "FINALIZADO":
      filtrados = todosPedidosDoDia.filter(p => p.status === "finalizado");
      break;
    case "TUDO":
      filtrados = [...todosPedidosDoDia];
      break;
  }

  // Ordena: mais recentes primeiro
  filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));

  if (filtrados.length === 0) {
    container.innerHTML = `<p class="placeholder">Nenhum pedido nesta aba.</p>`;
    return;
  }

  let html = "";
  filtrados.forEach(pedido => {
    // Usa card grande para NOVOS/TUDO, compacto para os outros
    if (filtroAtual === "NOVOS" || filtroAtual === "TUDO") {
      html += gerarCardGrande(pedido);
    } else {
      html += gerarCardCompacto(pedido);
    }
  });
  container.innerHTML = html;
}

function gerarCardGrande(pedido) {
  let itensHtml = pedido.itens.map(it => {
      let obs = it.obs ? ` <i>(${it.obs})</i>` : "";
      return `<li><b>${it.name}</b>${obs}</li>`;
  }).join("");

  let statusClass = "";
  let titulo = "";
  let botoes = "";

  switch(pedido.status) {
      case 'pendente':
          statusClass = 'status-pendente'; titulo = '🔥 NOVO PEDIDO';
          botoes = `<button class="btn-acao btn-aceitar" data-codigo="${pedido.codigo}">✅ Aceitar</button>
                    <button class="btn-acao btn-imprimir" data-codigo="${pedido.codigo}">🖨️ Imprimir</button>`;
          break;
      case 'em_preparo':
          statusClass = 'status-em_preparo'; titulo = 'EM PREPARO';
          botoes = `<button class="btn-acao btn-finalizar" data-codigo="${pedido.codigo}">🏁 Finalizar</button>
                    <button class="btn-acao btn-imprimir" data-codigo="${pedido.codigo}">🖨️ Imprimir</button>`;
          break;
      case 'finalizado':
          statusClass = 'status-finalizado'; titulo = 'FINALIZADO';
          botoes = `<button class="btn-acao btn-imprimir" data-codigo="${pedido.codigo}">🖨️ Re-imprimir</button>`;
          break;
  }

  return `
    <div class="pedido-card" data-status="${pedido.status}">
       <h3 class="${statusClass}">${titulo} #${pedido.codigo}</h3>
       <p class="info">
         <b>Cliente:</b> ${pedido.nomeCliente}<br>
         <b>Horário:</b> ${formatarHora(pedido.data)}<br>
         <b>Endereço:</b> ${pedido.endereco}<br>
         <b>Pagamento:</b> ${pedido.pagamento} ${pedido.obsPagamento ? `(${pedido.obsPagamento})` : ''}
       </p>
       <ul>${itensHtml}</ul>
       <h3 class="total">Total: ${brl(pedido.total)}</h3>
       <div class="botoes-acao">${botoes}</div>
    </div>
  `;
}

function gerarCardCompacto(pedido) {
  let statusClass = pedido.status === 'em_preparo' ? 'status-em_preparo' : 'status-finalizado';
  let titulo = pedido.status === 'em_preparo' ? 'EM PREPARO' : 'FINALIZADO';
  let botaoPrincipal = pedido.status === 'em_preparo' 
      ? `<button class="btn-acao btn-finalizar" data-codigo="${pedido.codigo}">🏁 Finalizar</button>`
      : ``;

  return `
    <div class="pedido-card compact" data-status="${pedido.status}">
      <div class="compact-info">
        <h3 class="${statusClass}">${titulo} #${pedido.codigo}</h3>
        <p class="info">${formatarHora(pedido.data)} | ${pedido.nomeCliente} | ${brl(pedido.total)}</p>
      </div>
      <div class="compact-botoes">
        ${botaoPrincipal}
        <button class="btn-acao btn-imprimir" data-codigo="${pedido.codigo}">🖨️</button>
      </div>
    </div>
  `;
}

// ==========================================================
// 6. INICIALIZAÇÃO E LISTENERS
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  const statusDiv = document.getElementById("status-conexao");

  // 6.1. Conecta no Pusher
  try {
    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const channel = pusher.subscribe("canal-pedidos");

    channel.bind("novo-pedido", (data) => {
      if (data && data.pedido) {
        console.log("🔔 Novo pedido recebido:", data.pedido);
        // Adiciona no topo da lista
        todosPedidosDoDia.unshift(data.pedido);
        
        // Toca som e atualiza tela
        iniciarAlarme();
        atualizarTela();

        // Imprime automaticamente
        imprimirComanda(data.pedido);
      }
    });

    statusDiv.textContent = "Conectado! Aguardando pedidos...";
    statusDiv.className = "status-conectado";

  } catch (e) {
    console.error("Erro no Pusher:", e);
    statusDiv.textContent = "Erro de conexão.";
    statusDiv.className = "status-erro";
  }

  // 6.2. Listener de Cliques (Navegação)
  document.querySelectorAll(".painel-nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove ativo de todos
      document.querySelectorAll(".painel-nav button").forEach(b => b.classList.remove("active"));
      // Adiciona ativo no clicado
      btn.classList.add("active");
      // Atualiza filtro e tela
      filtroAtual = btn.dataset.filtro;
      atualizarTela();
    });
  });

  // 6.3. Listener de Ações (Botões dos Cards)
  const container = document.getElementById("lista-pedidos-container");
  if (container) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-acao");
      if (!btn) return;
      
      const codigo = btn.dataset.codigo;
      const pedidoIndex = todosPedidosDoDia.findIndex(p => p.codigo === codigo);
      if (pedidoIndex === -1) return;

      if (btn.classList.contains("btn-aceitar")) {
        pararAlarme();
        todosPedidosDoDia[pedidoIndex].status = "em_preparo";
        atualizarTela();
      } 
      else if (btn.classList.contains("btn-finalizar")) {
        todosPedidosDoDia[pedidoIndex].status = "finalizado";
        atualizarTela();
      } 
      else if (btn.classList.contains("btn-imprimir")) {
        imprimirComanda(todosPedidosDoDia[pedidoIndex]);
      }
    });
  }

  // 6.4. Interação com a página para liberar áudio
  document.body.addEventListener("click", () => {
    // Apenas um clique qualquer na página já libera o áudio
    if (audioAlarme.context && audioAlarme.context.state === 'suspended') {
        audioAlarme.context.resume();
    }
  }, { once: true });
});