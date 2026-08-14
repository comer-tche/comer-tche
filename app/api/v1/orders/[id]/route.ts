import { banco } from "@/lib/banco";
import { exigirPropriedadeDoPedido } from "@/lib/autorizacao";
import { ocultarDadosAposEntrega } from "@/lib/minimizacao";

// GET /api/v1/orders/{id}
// Devolve um pedido especifico.
//
// Requisito RS02: antes de devolver qualquer dado, o servidor confere se o
// pedido pertence a quem esta pedindo. Estar autenticado nao basta.
//
// Trata o risco R07 (leitura de pedidos de outros clientes), catalogado como
// IDOR / CWE-639 na secao 11.2.

export async function GET(
  requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pedidoId } = await params;

  // Formato de UUID conferido antes de qualquer consulta.
  const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!FORMATO_UUID.test(pedidoId)) {
    return Response.json({ erro: "Pedido nao encontrado" }, { status: 404 });
  }

  const veredito = await exigirPropriedadeDoPedido(requisicao, pedidoId);
  if (!veredito.autorizado) return veredito.resposta;

  const pedido = await banco.order.findUnique({
    where: { id: pedidoId },
    include: {
      itens: true,
      // O objeto do cliente traz senha e demais campos, por isso a selecao e
      // explicita: so o que a tela do pedido precisa mostrar.
      cliente: { select: { id: true, nome: true, telefone: true } },
    },
  });

  if (!pedido) {
    return Response.json({ erro: "Pedido nao encontrado" }, { status: 404 });
  }

  return Response.json(ocultarDadosAposEntrega(pedido, veredito.sessao));
}
