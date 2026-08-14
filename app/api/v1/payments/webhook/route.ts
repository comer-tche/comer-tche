import { banco } from "@/lib/banco";

// POST /api/v1/payments/webhook
// Recebe do gateway de pagamento a confirmacao de que um pedido foi pago.
//
// ATENCAO, VULNERABILIDADE PROPOSITAL NESTA VERSAO.
// A rota aceita qualquer requisicao que chegue neste endereco. Nao ha nada
// que prove que a mensagem veio mesmo do gateway. Quem descobrir o caminho
// libera pedidos para preparo sem nenhum pagamento ter acontecido. E o risco
// R04 do trabalho. A validacao da assinatura entra no commit que aplica o
// requisito RS04.

export async function POST(requisicao: Request) {
  const corpo = await requisicao.json();

  const pedido = await banco.order.findUnique({ where: { id: corpo.pedidoId } });
  if (!pedido) {
    return Response.json({ erro: "Pedido nao encontrado" }, { status: 404 });
  }

  await banco.payment.upsert({
    where: { pedidoId: pedido.id },
    create: {
      pedidoId: pedido.id,
      situacao: "CONFIRMADO",
      valorEmCentavos: corpo.valorEmCentavos,
    },
    update: { situacao: "CONFIRMADO", valorEmCentavos: corpo.valorEmCentavos },
  });

  await banco.order.update({
    where: { id: pedido.id },
    data: { situacao: "EM_PREPARO" },
  });

  return Response.json({ situacao: "CONFIRMADO", pedidoId: pedido.id });
}
