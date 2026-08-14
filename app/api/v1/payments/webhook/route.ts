import { createHmac, timingSafeEqual } from "node:crypto";
import { banco } from "@/lib/banco";
import { registrar } from "@/lib/auditoria";

// POST /api/v1/payments/webhook
// Recebe do gateway de pagamento a confirmacao de que um pedido foi pago.
//
// Requisito RS04, segunda metade: a confirmacao so e aceita quando vem
// acompanhada de assinatura valida. Realiza a Decisao 2 da arquitetura e
// trata o risco R04 (pedido liberado sem pagamento).
//
// Esta rota e publica por natureza, porque quem chama e o gateway e nao um
// usuario logado. A assinatura e o que prova a origem: um codigo calculado
// sobre o corpo da mensagem com um segredo que so nos e o gateway conhecemos.
// Quem nao tem o segredo nao consegue produzir a assinatura correta.

const SEGREDO_DO_GATEWAY = process.env.PAYMENT_WEBHOOK_SECRET;

function assinaturaConfere(corpoBruto: string, assinaturaRecebida: string | null): boolean {
  if (!assinaturaRecebida || !SEGREDO_DO_GATEWAY) return false;

  const esperada = createHmac("sha256", SEGREDO_DO_GATEWAY).update(corpoBruto).digest("hex");

  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(assinaturaRecebida, "utf8");

  // Comparar com === encerraria no primeiro caractere diferente, e a
  // diferenca de tempo entre as tentativas permitiria descobrir a assinatura
  // caractere a caractere. timingSafeEqual gasta o mesmo tempo sempre.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(requisicao: Request) {
  // O corpo e lido como texto porque a assinatura vale sobre os bytes
  // exatos que chegaram. Serializar de novo a partir do objeto mudaria
  // espacos ou ordem de campos e invalidaria a comparacao.
  const corpoBruto = await requisicao.text();
  const assinatura = requisicao.headers.get("x-assinatura");

  if (!assinaturaConfere(corpoBruto, assinatura)) {
    await registrar({
      acao: "WEBHOOK_ASSINATURA_INVALIDA",
      requisicao,
      detalhe: assinatura ? "assinatura nao confere" : "requisicao sem assinatura",
    });
    return Response.json({ erro: "Assinatura invalida" }, { status: 401 });
  }

  const corpo = JSON.parse(corpoBruto) as { pedidoId?: string; valorEmCentavos?: number };

  if (typeof corpo.pedidoId !== "string" || typeof corpo.valorEmCentavos !== "number") {
    return Response.json({ erro: "Confirmacao mal formada" }, { status: 400 });
  }

  const pedido = await banco.order.findUnique({ where: { id: corpo.pedidoId } });
  if (!pedido) {
    return Response.json({ erro: "Pedido nao encontrado" }, { status: 404 });
  }

  // Assinatura valida prova a origem, mas nao que o valor esta certo. O total
  // confirmado tem de bater com o que o servidor calculou no checkout.
  if (pedido.totalEmCentavos !== corpo.valorEmCentavos) {
    await registrar({
      acao: "DIVERGENCIA_DE_VALOR",
      requisicao,
      alvo: `pedido:${pedido.id}`,
      detalhe: `confirmado ${corpo.valorEmCentavos}, esperado ${pedido.totalEmCentavos}`,
    });
    return Response.json({ erro: "Valor divergente" }, { status: 409 });
  }

  // O gateway pode reenviar a mesma confirmacao se nao receber resposta. O
  // upsert e a checagem de estado tornam o reenvio inofensivo: o pedido nao
  // avanca duas vezes.
  await banco.payment.upsert({
    where: { pedidoId: pedido.id },
    create: {
      pedidoId: pedido.id,
      situacao: "CONFIRMADO",
      valorEmCentavos: corpo.valorEmCentavos,
    },
    update: { situacao: "CONFIRMADO" },
  });

  if (pedido.situacao === "AGUARDANDO_PAGAMENTO") {
    await banco.order.update({
      where: { id: pedido.id },
      data: { situacao: "EM_PREPARO" },
    });
  }

  await registrar({
    acao: "WEBHOOK_ACEITO",
    requisicao,
    alvo: `pedido:${pedido.id}`,
  });

  return Response.json({ situacao: "CONFIRMADO", pedidoId: pedido.id });
}
