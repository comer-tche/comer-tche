import { banco } from "@/lib/banco";
import { dentroDoLimite, LIMITES } from "@/lib/limite-de-requisicoes";

// GET /api/v1/menu
// Lista os itens disponiveis no cardapio. Rota publica: qualquer pessoa pode
// ver o cardapio sem estar autenticada, como em qualquer aplicativo de
// delivery.
//
// O preco devolvido aqui e apenas informativo, para a tela montar o carrinho.
// Quem decide quanto sera cobrado e o servidor, no momento do checkout.

export async function GET(requisicao: Request) {
  // Rota publica e sem autenticacao, portanto a mais exposta a trafego
  // automatizado. O limite usa a origem da requisicao como identidade.
  const limite = await dentroDoLimite(requisicao, LIMITES.consulta);
  if (!limite.permitido) return limite.resposta;

  const itens = await banco.menuItem.findMany({
    where: { disponivel: true },
    orderBy: { name: "asc" },
  });

  return Response.json(itens);
}
