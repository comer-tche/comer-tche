import { z } from "zod";
import { banco } from "@/lib/banco";
import { exigirSessao } from "@/lib/autorizacao";
import { registrar } from "@/lib/auditoria";

// POST /api/v1/orders
// Fecha um pedido (checkout).
//
// Requisito RS04, primeira metade: o servidor recalcula o valor a partir do
// cardapio no banco e ignora qualquer total enviado pelo aplicativo.
// Realiza a Decisao 2 da arquitetura e trata o risco R03.
//
// O aplicativo roda no celular do cliente, um ambiente fora do nosso
// controle. Um proxy comum intercepta a requisicao depois que ela sai da tela
// e altera qualquer campo. Por isso o cliente informa apenas o que quer
// comprar, nunca quanto custa.

// O formato aceito e declarado de forma estrita: campo desconhecido no corpo
// e recusado em vez de ignorado, e nao existe campo de preco nem de total.
const PedidoRecebido = z
  .object({
    enderecoDeEntrega: z.string().min(5).max(200),
    itens: z
      .array(
        z
          .object({
            itemDoCardapioId: z.number().int().positive(),
            quantidade: z.number().int().min(1).max(50),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export async function POST(requisicao: Request) {
  const veredito = await exigirSessao(requisicao);
  if (!veredito.autorizado) return veredito.resposta;
  const { sessao } = veredito;

  const corpoBruto = await requisicao.json().catch(() => null);
  const validado = PedidoRecebido.safeParse(corpoBruto);

  if (!validado.success) {
    // Enviar total ou preco faz a validacao falhar aqui, porque o formato e
    // estrito. O evento fica registrado como divergencia, e e a fonte da
    // Regra 2 de deteccao (secao 19.4).
    const enviouPreco =
      corpoBruto !== null &&
      typeof corpoBruto === "object" &&
      ("totalEmCentavos" in corpoBruto || "precoUnitarioEmCentavos" in corpoBruto);

    if (enviouPreco) {
      await registrar({
        acao: "DIVERGENCIA_DE_VALOR",
        requisicao,
        sessao,
        detalhe: "o corpo do checkout trouxe campo de valor, que nao e aceito",
      });
    }

    return Response.json({ erro: "Pedido invalido" }, { status: 400 });
  }

  const pedidoRecebido = validado.data;

  // Os precos vem do banco, um por item, e o total e a soma calculada aqui.
  const idsPedidos = pedidoRecebido.itens.map((item) => item.itemDoCardapioId);
  const itensDoCardapio = await banco.menuItem.findMany({
    where: { id: { in: idsPedidos }, disponivel: true },
  });

  if (itensDoCardapio.length !== idsPedidos.length) {
    return Response.json(
      { erro: "Ha item inexistente ou indisponivel no pedido" },
      { status: 400 },
    );
  }

  const precoPorItem = new Map(itensDoCardapio.map((item) => [item.id, item.precoEmCentavos]));

  let totalCalculado = 0;
  const itensParaGravar = pedidoRecebido.itens.map((item) => {
    const precoUnitario = precoPorItem.get(item.itemDoCardapioId)!;
    totalCalculado += precoUnitario * item.quantidade;
    return {
      itemDoCardapioId: item.itemDoCardapioId,
      quantidade: item.quantidade,
      precoUnitarioEmCentavos: precoUnitario,
    };
  });

  const pedido = await banco.order.create({
    data: {
      clienteId: sessao.usuarioId,
      totalEmCentavos: totalCalculado,
      enderecoDeEntrega: pedidoRecebido.enderecoDeEntrega,
      itens: { create: itensParaGravar },
    },
    include: { itens: true },
  });

  await registrar({
    acao: "PEDIDO_CRIADO",
    requisicao,
    sessao,
    alvo: `pedido:${pedido.id}`,
    detalhe: `total calculado no servidor: ${totalCalculado} centavos`,
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
