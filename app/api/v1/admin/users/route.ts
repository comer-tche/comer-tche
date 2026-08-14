import { banco } from "@/lib/banco";
import { exigirPerfil } from "@/lib/autorizacao";
import { registrar } from "@/lib/auditoria";

// GET /api/v1/admin/users
// Lista todos os usuarios da plataforma. Rota administrativa.
//
// Requisito RS01: o perfil e verificado no servidor, em toda requisicao,
// independentemente do que a interface mostra. Esconder o botao na tela nao
// protege nada, porque qualquer pessoa chama este endereco direto.
//
// Trata o risco R10 (obtencao de funcoes administrativas).

export async function GET(requisicao: Request) {
  const veredito = await exigirPerfil(requisicao, ["ADMIN"]);
  if (!veredito.autorizado) return veredito.resposta;

  const usuarios = await banco.user.findMany({
    select: {
      id: true,
      email: true,
      nome: true,
      telefone: true,
      endereco: true,
      perfil: true,
      criadoEm: true,
    },
    orderBy: { id: "asc" },
  });

  // Consulta a dados de todos os usuarios e evento relevante por si so, mesmo
  // quando legitima: e o que permite investigar uma exportacao em massa
  // depois de um incidente.
  await registrar({
    acao: "CONSULTA_ADMINISTRATIVA",
    requisicao,
    sessao: veredito.sessao,
    detalhe: `listou ${usuarios.length} usuarios`,
  });

  return Response.json(usuarios);
}
