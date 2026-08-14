import { banco } from "@/lib/banco";
import { registrar } from "@/lib/auditoria";
import { sessaoDaRequisicao, type DadosDaSessao } from "@/lib/sessao";

// Autorizacao no servidor. Passo 3 da ordem de implementacao (secao 9.5 do
// trabalho), aplicando os requisitos RS01 e RS02 e a Decisao 1 da arquitetura.
// Trata os riscos R10 (obtencao de funcoes administrativas) e R07 (leitura de
// pedidos de outros clientes).
//
// POR QUE ISTO NAO ESTA EM middleware.ts
//
// A Decisao 1 fala em "validacao centralizada de autorizacao". No Next.js, o
// lugar que parece obvio para isso e o arquivo middleware.ts, e ele e
// justamente o lugar errado. A CVE-2025-29927, de severidade 9.1 (critica),
// permitia pular o middleware inteiro enviando o cabecalho
// x-middleware-subrequest, e a descricao oficial e literal: "it is possible to
// bypass authorization checks within a Next.js application, if the
// authorization check occurs in middleware".
//
// O CWE dessa falha e o CWE-285, Improper Authorization, exatamente o que a
// secao 11.2 do trabalho mapeou para o risco R10.
//
// Por isso a verificacao vive aqui, em funcoes chamadas dentro de cada rota,
// no servidor. O middleware.ts fica reservado a redirecionamento e nunca
// decide acesso. A centralizacao que a Decisao 1 pede e obtida por este
// modulo unico, e nao pelo mecanismo do framework.

// Resultado de uma verificacao: ou a sessao autorizada, ou a resposta pronta
// para a rota devolver. Quem chama nao precisa decidir codigo nem formato.
type Veredito =
  | { autorizado: true; sessao: DadosDaSessao }
  | { autorizado: false; resposta: Response };

// Exige apenas que exista sessao valida.
export async function exigirSessao(requisicao: Request): Promise<Veredito> {
  const sessao = await sessaoDaRequisicao(requisicao);

  if (!sessao) {
    return {
      autorizado: false,
      resposta: Response.json({ erro: "Nao autenticado" }, { status: 401 }),
    };
  }

  return { autorizado: true, sessao };
}

// Exige que o perfil da sessao esteja entre os aceitos (RS01).
//
// A politica e negar por padrao: a rota declara quem pode entrar, e todo o
// resto e recusado. Nao existe lista de quem nao pode.
export async function exigirPerfil(
  requisicao: Request,
  perfisAceitos: string[],
): Promise<Veredito> {
  const comSessao = await exigirSessao(requisicao);
  if (!comSessao.autorizado) return comSessao;

  const { sessao } = comSessao;

  if (!perfisAceitos.includes(sessao.perfil)) {
    await registrar({
      acao: "ACESSO_NEGADO_PERFIL",
      requisicao,
      sessao,
      detalhe: `perfil ${sessao.perfil} tentou rota restrita a ${perfisAceitos.join(", ")}`,
    });

    return {
      autorizado: false,
      resposta: Response.json({ erro: "Acesso negado" }, { status: 403 }),
    };
  }

  return { autorizado: true, sessao };
}

// Exige que o pedido pertenca a quem esta pedindo (RS02).
//
// Esta e a verificacao de propriedade, ou ownership check. Estar autenticado
// nao basta: e preciso conferir de quem e o recurso. Sem ela existe a falha
// catalogada como IDOR (CWE-639) na secao 11.2.
export async function exigirPropriedadeDoPedido(
  requisicao: Request,
  pedidoId: number,
): Promise<Veredito & { pedido?: { id: number; clienteId: number } }> {
  const comSessao = await exigirSessao(requisicao);
  if (!comSessao.autorizado) return comSessao;

  const { sessao } = comSessao;

  const pedido = await banco.order.findUnique({
    where: { id: pedidoId },
    select: { id: true, clienteId: true },
  });

  // O administrador enxerga qualquer pedido, porque conciliar pagamento e
  // atender disputa exigem isso. O acesso fica registrado.
  const ehDono = pedido?.clienteId === sessao.usuarioId;
  const ehAdministrador = sessao.perfil === "ADMIN";

  if (!pedido || (!ehDono && !ehAdministrador)) {
    if (pedido) {
      await registrar({
        acao: "ACESSO_NEGADO_PROPRIEDADE",
        requisicao,
        sessao,
        alvo: `pedido:${pedidoId}`,
        detalhe: "tentativa de acesso a pedido de outro cliente",
      });
    }

    // Pedido inexistente e pedido alheio recebem a mesma resposta 404. Se o
    // alheio devolvesse 403, a diferenca entre as duas respostas revelaria
    // quais identificadores existem, o que e um vazamento por si so.
    return {
      autorizado: false,
      resposta: Response.json({ erro: "Pedido nao encontrado" }, { status: 404 }),
    };
  }

  if (ehAdministrador && !ehDono) {
    await registrar({
      acao: "CONSULTA_ADMINISTRATIVA",
      requisicao,
      sessao,
      alvo: `pedido:${pedidoId}`,
    });
  }

  return { autorizado: true, sessao, pedido };
}
