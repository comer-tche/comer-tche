import { banco } from "@/lib/banco";
import { exigirSessao } from "@/lib/autorizacao";

// POST /api/v1/orders
// Fecha um pedido (checkout).
//
// ATENCAO, VULNERABILIDADE PROPOSITAL NESTA VERSAO.
// O total cobrado vem do campo "totalEmCentavos" enviado pelo aplicativo, e o
// servidor apenas confia nele. Como o aplicativo roda no celular do cliente,
// qualquer proxy consegue alterar esse campo antes de a requisicao chegar
// aqui, e o pedido e cobrado pelo valor que o atacante quiser. E o risco R03
// do trabalho. O recalculo no servidor entra no commit que aplica o requisito
// RS04.

export async function POST(requisicao: Request) {
  const veredito = await exigirSessao(requisicao);
  if (!veredito.autorizado) return veredito.resposta;
  const { sessao } = veredito;

  const corpo = await requisicao.json();

  const pedido = await banco.order.create({
    data: {
      clienteId: sessao.usuarioId,
      totalEmCentavos: corpo.totalEmCentavos,
      enderecoDeEntrega: corpo.enderecoDeEntrega,
      itens: {
        create: corpo.itens.map((item: { itemDoCardapioId: number; quantidade: number; precoUnitarioEmCentavos: number }) => ({
          itemDoCardapioId: item.itemDoCardapioId,
          quantidade: item.quantidade,
          precoUnitarioEmCentavos: item.precoUnitarioEmCentavos,
        })),
      },
    },
    include: { itens: true },
  });

  return Response.json(pedido, { status: 201 });
}

// GET /api/v1/orders
// Lista os pedidos do proprio cliente autenticado.
export async function GET(requisicao: Request) {
  const veredito = await exigirSessao(requisicao);
  if (!veredito.autorizado) return veredito.resposta;
  const { sessao } = veredito;

  const pedidos = await banco.order.findMany({
    where: { clienteId: sessao.usuarioId },
    include: { itens: true },
    orderBy: { criadoEm: "desc" },
  });

  return Response.json(pedidos);
}
