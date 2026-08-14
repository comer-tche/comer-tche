import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Testes de seguranca TS01 a TS08.
//
// Sao os mesmos oito testes definidos na Etapa 4 do trabalho (secoes 16.2 e
// 17.2), com os mesmos identificadores e os mesmos resultados esperados. La
// eles foram escritos ANTES da implementacao, a partir dos criterios de
// verificacao dos requisitos RS01 a RS04. Aqui eles passam a ser executaveis.
//
// Os testes rodam contra a aplicacao em execucao, e nao contra as funcoes
// internas. E de proposito: o que precisa ser verificado e o comportamento da
// API para quem chama de fora, que e por onde o ataque chegaria. Chamar a
// funcao diretamente pularia justamente a camada em teste.

const BASE = process.env.URL_DE_TESTE ?? "http://localhost:3000";
const SEGREDO_DO_GATEWAY = process.env.PAYMENT_WEBHOOK_SECRET ?? "";

type Contexto = {
  tokenClienteA: string;
  tokenClienteB: string;
  tokenAdmin: string;
  pedidoDeA: string;
};

const ctx = {} as Contexto;

// Cada conta entra de um aparelho ja reconhecido, registrado pelo seed. Isso
// evita que o segundo fator (RS03) interrompa todos os testes, ja que em
// producao o codigo sai por e-mail e nunca aparece na resposta da API. A
// exigencia do segundo fator continua verificada, no teste TS09.
async function autenticar(email: string, aparelho: string): Promise<string> {
  const resposta = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dispositivo": aparelho },
    body: JSON.stringify({ email, senha: "comer-tche-dev" }),
  });

  const corpo = await resposta.json();

  if (!corpo.token) {
    throw new Error(`Falha ao autenticar ${email}: ${JSON.stringify(corpo)}`);
  }

  return corpo.token;
}

beforeAll(async () => {
  ctx.tokenClienteA = await autenticar("cliente@exemplo.test", "aparelho-do-cliente-a");
  ctx.tokenClienteB = await autenticar("outro.cliente@exemplo.test", "aparelho-do-cliente-b");
  ctx.tokenAdmin = await autenticar("admin@exemplo.test", "aparelho-do-admin");

  const cardapio = await (await fetch(`${BASE}/api/v1/menu`)).json();

  const criado = await fetch(`${BASE}/api/v1/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ctx.tokenClienteA}` },
    body: JSON.stringify({
      enderecoDeEntrega: "Rua de Teste, 100",
      itens: [{ itemDoCardapioId: cardapio[0].id, quantidade: 2 }],
    }),
  });

  ctx.pedidoDeA = (await criado.json()).id;
}, 60_000);

afterAll(() => {
  // Nada a limpar: o banco de teste e o de desenvolvimento, recriado por
  // migracao e seed no ambiente de integracao continua.
});

describe("Pratica 1: controle de autorizacao (RS01 e RS02)", () => {
  it("TS01: administrador autenticado acessa a rota administrativa", async () => {
    const resposta = await fetch(`${BASE}/api/v1/admin/users`, {
      headers: { authorization: `Bearer ${ctx.tokenAdmin}` },
    });

    expect(resposta.status).toBe(200);
    expect(Array.isArray(await resposta.json())).toBe(true);
  });

  it("TS02: cliente chamando a rota administrativa direto recebe 403", async () => {
    const resposta = await fetch(`${BASE}/api/v1/admin/users`, {
      headers: { authorization: `Bearer ${ctx.tokenClienteA}` },
    });

    // O criterio de verificacao do RS01 e exatamente este codigo.
    expect(resposta.status).toBe(403);
  });

  it("TS03: cliente consulta o proprio pedido", async () => {
    const resposta = await fetch(`${BASE}/api/v1/orders/${ctx.pedidoDeA}`, {
      headers: { authorization: `Bearer ${ctx.tokenClienteA}` },
    });

    expect(resposta.status).toBe(200);
    expect((await resposta.json()).id).toBe(ctx.pedidoDeA);
  });

  it("TS04: cliente B tentando ler o pedido do cliente A e recusado", async () => {
    const resposta = await fetch(`${BASE}/api/v1/orders/${ctx.pedidoDeA}`, {
      headers: { authorization: `Bearer ${ctx.tokenClienteB}` },
    });

    // O RS02 aceita 403 ou 404. A implementacao devolve 404 para pedido
    // alheio e para pedido inexistente, porque respostas diferentes
    // revelariam quais identificadores existem.
    expect([403, 404]).toContain(resposta.status);
  });
});

describe("Pratica 2: validacao de entrada e integridade (RS04)", () => {
  it("TS05: pedido valido e cobrado pelo valor do cardapio", async () => {
    const cardapio = await (await fetch(`${BASE}/api/v1/menu`)).json();
    const item = cardapio[0];

    const resposta = await fetch(`${BASE}/api/v1/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ctx.tokenClienteA}` },
      body: JSON.stringify({
        enderecoDeEntrega: "Rua de Teste, 100",
        itens: [{ itemDoCardapioId: item.id, quantidade: 3 }],
      }),
    });

    expect(resposta.status).toBe(201);
    expect((await resposta.json()).totalEmCentavos).toBe(item.precoEmCentavos * 3);
  });

  it("TS06: total adulterado no corpo da requisicao nao e aceito", async () => {
    const cardapio = await (await fetch(`${BASE}/api/v1/menu`)).json();

    const resposta = await fetch(`${BASE}/api/v1/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ctx.tokenClienteA}` },
      body: JSON.stringify({
        enderecoDeEntrega: "Rua de Teste, 100",
        itens: [{ itemDoCardapioId: cardapio[0].id, quantidade: 1 }],
        totalEmCentavos: 1,
      }),
    });

    // O formato aceito e estrito: campo de valor no corpo faz a requisicao
    // ser recusada, e nao apenas ignorada.
    expect(resposta.status).toBe(400);
  });

  it("TS07: confirmacao de pagamento com assinatura valida libera o pedido", async () => {
    const corpo = JSON.stringify({ pedidoId: ctx.pedidoDeA, valorEmCentavos: await totalDoPedido(ctx.pedidoDeA) });
    const assinatura = createHmac("sha256", SEGREDO_DO_GATEWAY).update(corpo).digest("hex");

    const resposta = await fetch(`${BASE}/api/v1/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-assinatura": assinatura },
      body: corpo,
    });

    expect(resposta.status).toBe(200);
    expect((await resposta.json()).situacao).toBe("CONFIRMADO");
  });

  it("TS08: confirmacao forjada, sem assinatura valida, e recusada", async () => {
    const resposta = await fetch(`${BASE}/api/v1/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-assinatura": "assinatura-inventada" },
      body: JSON.stringify({ pedidoId: ctx.pedidoDeA, valorEmCentavos: 1 }),
    });

    expect(resposta.status).toBe(401);
  });
});

describe("Segundo fator em aparelho nao reconhecido (RS03)", () => {
  it("TS09: login de aparelho desconhecido nao devolve token", async () => {
    const resposta = await fetch(`${BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dispositivo": `aparelho-nunca-visto-${Date.now()}`,
      },
      body: JSON.stringify({ email: "cliente@exemplo.test", senha: "comer-tche-dev" }),
    });

    const corpo = await resposta.json();

    // A senha estava correta, e mesmo assim nenhuma sessao foi aberta: e o
    // que impede a credencial vazada de virar acesso (risco R01).
    expect(corpo.situacao).toBe("MFA_PENDING");
    expect(corpo.token).toBeUndefined();
  });
});

async function totalDoPedido(pedidoId: string): Promise<number> {
  const resposta = await fetch(`${BASE}/api/v1/orders/${pedidoId}`, {
    headers: { authorization: `Bearer ${ctx.tokenClienteA}` },
  });
  return (await resposta.json()).totalEmCentavos;
}
