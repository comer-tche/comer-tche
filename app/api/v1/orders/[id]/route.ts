import { banco } from "@/lib/banco";
import { sessaoDaRequisicao } from "@/lib/sessao";

// GET /api/v1/orders/{id}
// Devolve um pedido especifico.
//
// ATENCAO, VULNERABILIDADE PROPOSITAL NESTA VERSAO.
// A rota confere se existe alguem autenticado, mas nao confere se o pedido
// pertence a essa pessoa. Como os identificadores sao numeros em sequencia,
// basta trocar o numero na URL para ler o pedido de outro cliente, com nome,
// telefone e endereco de entrega. E o risco R07 do trabalho, a falha
// catalogada como IDOR (CWE-639). A verificacao de propriedade entra no
// commit que aplica o requisito RS02.

export async function GET(
  requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await sessaoDaRequisicao(requisicao);
  if (!sessao) {
    return Response.json({ erro: "Nao autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const pedido = await banco.order.findUnique({
    where: { id: Number(id) },
    include: { itens: true, cliente: true },
  });

  if (!pedido) {
    return Response.json({ erro: "Pedido nao encontrado" }, { status: 404 });
  }

  return Response.json(pedido);
}
