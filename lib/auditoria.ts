import { banco } from "@/lib/banco";
import type { DadosDaSessao } from "@/lib/sessao";

// Trilha de auditoria: controle do risco R06 e passo 1 da ordem de
// implementacao (secao 9.5 do trabalho).
//
// O registro vem primeiro de proposito. Sem ele, nenhum outro controle pode
// ser verificado e nenhum incidente pode ser investigado ou revertido: os
// controles seguintes gravam aqui as tentativas que recusam.

// Acoes registradas. Manter a lista fechada evita que cada rota invente um
// nome diferente para o mesmo evento, o que quebraria as regras de deteccao
// da secao 19 do trabalho.
export type AcaoAuditavel =
  | "LOGIN_NEGADO"
  | "LOGIN_ACEITO"
  | "MFA_EXIGIDO"
  | "MFA_NEGADO"
  | "ACESSO_NEGADO_PERFIL"
  | "ACESSO_NEGADO_PROPRIEDADE"
  | "PEDIDO_CRIADO"
  | "DIVERGENCIA_DE_VALOR"
  | "WEBHOOK_ASSINATURA_INVALIDA"
  | "WEBHOOK_ACEITO"
  | "CONSULTA_ADMINISTRATIVA"
  | "LIMITE_EXCEDIDO";

type Registro = {
  acao: AcaoAuditavel;
  requisicao: Request;
  sessao?: DadosDaSessao | null;
  alvo?: string;
  detalhe?: string;
};

// Grava um evento. Nunca lanca excecao: uma falha ao registrar nao pode
// derrubar a operacao em andamento nem, pior, virar um jeito de o atacante
// tirar a aplicacao do ar.
export async function registrar({ acao, requisicao, sessao, alvo, detalhe }: Registro): Promise<void> {
  try {
    const url = new URL(requisicao.url);

    await banco.auditLog.create({
      data: {
        autorId: sessao?.usuarioId ?? null,
        autorPerfil: sessao?.perfil ?? null,
        acao,
        alvo: alvo ?? null,
        rota: `${requisicao.method} ${url.pathname}`,
        origemIp: origemDaRequisicao(requisicao),
        agente: requisicao.headers.get("user-agent"),
        detalhe: detalhe ?? null,
      },
    });
  } catch (erro) {
    console.error("Falha ao gravar na trilha de auditoria:", erro);
  }
}

// Descobre o endereco de origem. Atras de um proxy reverso o endereco real
// vem no cabecalho X-Forwarded-For, cujo primeiro elemento e o cliente.
// O valor e informado pelo cliente e por isso serve para investigacao, nunca
// como base para decisao de autorizacao.
export function origemDaRequisicao(requisicao: Request): string | null {
  const encaminhado = requisicao.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return requisicao.headers.get("x-real-ip");
}
