/*
  ==========================================================
  PAINEL.JS (AÇAÍSE - VERSÃO FINAL)
  ==========================================================
*/

// 1. CONFIGURAÇÃO PUSHER
const PUSHER_KEY = "e79d1140ca7a4250c29d";
const PUSHER_CLUSTER = "sa1";

// 2. ESTADO GLOBAL
let todosPedidosDoDia = [];
let filtroAtual = "NOVOS";

// Configuração de Áudio (Crie a pasta 'sounds' e coloque um arquivo 'toque.mp3')
const audioAlarme = new Audio("sounds/toque.mp3");
audioAlarme.volume = 1.0;
audioAlarme.loop = true;
let alarmeTocando = false;

// 3. FUNÇÕES AUXILIARES
const brl = (n) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

function formatarHora(dataISO) {
  try {
    return new Date(dataISO).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return "--:--"; }
}

function iniciarAlarme() {
  if (!alarmeTocando) {
    audioAlarme.play().catch(e => console.warn("Som bloqueado até interação do usuário."));
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

// 4. IMPRESSÃO TÉRMICA (80mm)
function imprimirComanda(pedido) {
  const loja = document.getElementById("comanda-loja");
  const lista = document.getElementById("comanda-lista");
  const total = document.getElementById("comanda-total");
  const tipo = document.getElementById("comanda-tipo");
  const cliente = document.getElementById("comanda-cliente");
  const endereco = document.getElementById("comanda-endereco");
  const pagamento = document.getElementById("comanda-pagamento");
  const obsPagamento = document.getElementById("comanda-obs-pagamento");

  if (!loja || !lista) return;

  // ✅ NOME DA LOJA CORRIGIDO
  loja.textContent = `AÇAÍSE - #${pedido.codigo}`;

  lista.innerHTML = "";
  pedido.itens.forEach((it) => {
    const li = document.createElement("li");
    li.style.marginBottom = "5px";
    li.style.borderBottom = "1px dotted #ccc";
    
    // Formatação simples para a comanda
    let htmlItem = `<b>${it.name}</b>`;
    // Se quiser listar os adicionais detalhados aqui, precisaria processar a string,
    // mas como já vem "Nome (Add1, Add2)" do front, imprime direto.
    
    if(it.obs) htmlItem += `<br><small>(Obs: ${it.obs})</small>`;
    
    li.innerHTML = `<div style="display:flex; justify-content:space-between;">
        <span>${htmlItem}</span>
        <span>${brl(it.price)}</span>
    </div>`;
    lista.appendChild(li);
  });

  total.innerHTML = `
    <small>Sub: ${brl(pedido.subtotal)} | Ent: ${brl(pedido.taxa)}</small><br>
    TOTAL: ${brl(pedido.total)}
  `;

  tipo.textContent = pedido.endereco === "Retirada no local" ? "RETIRADA" : "ENTREGA";
  cliente.textContent = `Cliente: ${pedido.nomeCliente}`;
  endereco.textContent = pedido.endereco;
  pagamento.textContent = `Pag: ${pedido.pagamento}`;
  obsPagamento.textContent = pedido.obsPagamento ? `Troco: ${pedido.obsPagamento}` : "";

  // Abre a janela de impressão
  setTimeout(() => { window.print(); }, 300);
}

// 5. RENDERIZAÇÃO
function atualizarTela() {
  const container = document.getElementById("lista-pedidos-container");
  if (!container) return;

  let filtrados = [];
  if (filtroAtual === "NOVOS") filtrados = todosPedidosDoDia.filter(p => p.status === "pendente");
  else if (filtroAtual === "EM_PREPARO") filtrados = todosPedidosDoDia.filter(p => p.status === "em_preparo");
  else if (filtroAtual === "FINALIZADO") filtrados = todosPedidosDoDia.filter(p => p.status === "finalizado");

  filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));

  if (filtrados.length === 0) {
    container.innerHTML = `<p class="placeholder">Nenhum pedido nesta aba.</p>`;
    return;
  }

  container.innerHTML = filtrados.map(p => gerarCard(p)).join("");
}

function gerarCard(p) {
  let statusClass = p.status === 'pendente' ? 'status-pendente' : (p.status === 'em_preparo' ? 'status-em_preparo' : 'status-finalizado');
  let itensHtml = p.itens.map(i => `<li>${i.name} ${i.obs ? `<small>(${i.obs})</small>` : ''}</li>`).join("");
  
  let botoes = "";
  if (p.status === 'pendente') {
      botoes = `<button class="btn-acao btn-aceitar" data-codigo="${p.codigo}">✅ Aceitar</button>`;
  } else if (p.status === 'em_preparo') {
      botoes = `<button class="btn-acao btn-finalizar" data-codigo="${p.codigo}">🏁 Finalizar</button>`;
  }
  
  botoes += `<button class="btn-acao btn-imprimir" data-codigo="${p.codigo}">🖨️</button>`;

  return `
    <div class="pedido-card" data-status="${p.status}">
       <h3 class="${statusClass}">#${p.codigo} - ${p.nomeCliente}</h3>
       <p class="info">${formatarHora(p.data)} | ${p.pagamento}</p>
       <p class="info"><b>${p.endereco}</b></p>
       <ul>${itensHtml}</ul>
       <h3 class="total">Total: ${brl(p.total)}</h3>
       <div class="botoes-acao">${botoes}</div>
    </div>
  `;
}

// 6. INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  const statusDiv = document.getElementById("status-conexao");

  // PUSHER
  try {
    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const channel = pusher.subscribe("canal-pedidos");

    channel.bind("novo-pedido", (data) => {
      if (data && data.pedido) {
        todosPedidosDoDia.unshift(data.pedido);
        iniciarAlarme();
        atualizarTela();
        // Auto-impressão ao chegar (opcional, se quiser desativar comente a linha abaixo)
        imprimirComanda(data.pedido); 
      }
    });
    statusDiv.textContent = "Conectado! Loja Aberta.";
    statusDiv.className = "status-conectado";
  } catch (e) {
    statusDiv.textContent = "Erro de conexão.";
    statusDiv.className = "status-erro";
  }

  // NAVEGAÇÃO
  document.querySelectorAll(".painel-nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".painel-nav button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filtroAtual = btn.dataset.filtro;
      atualizarTela();
    });
  });

  // AÇÕES DOS BOTÕES
  document.getElementById("lista-pedidos-container").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-acao");
    if (!btn) return;
    const codigo = btn.dataset.codigo;
    const index = todosPedidosDoDia.findIndex(p => p.codigo === codigo);
    if (index === -1) return;

    if (btn.classList.contains("btn-aceitar")) {
      pararAlarme();
      todosPedidosDoDia[index].status = "em_preparo";
      atualizarTela();
    } else if (btn.classList.contains("btn-finalizar")) {
      todosPedidosDoDia[index].status = "finalizado";
      atualizarTela();
    } else if (btn.classList.contains("btn-imprimir")) {
      imprimirComanda(todosPedidosDoDia[index]);
    }
  });

  // LIBERAR ÁUDIO (Clique em qualquer lugar para permitir som)
  document.body.addEventListener("click", () => {
    if (audioAlarme.context && audioAlarme.context.state === 'suspended') {
        audioAlarme.context.resume();
    }
  }, { once: true });
});