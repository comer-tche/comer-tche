import { banco } from "@/lib/banco";

// GET /api/v1/menu
// Lista os itens disponiveis no cardapio. Rota publica: qualquer pessoa pode
// ver o cardapio sem estar autenticada, como em qualquer aplicativo de
// delivery.
//
// O preco devolvido aqui e apenas informativo, para a tela montar o carrinho.
// Quem decide quanto sera cobrado e o servidor, no momento do checkout.

export async function GET() {
  const itens = await banco.menuItem.findMany({
    where: { disponivel: true },
    orderBy: { name: "asc" },
  });

  return Response.json(itens);
}
