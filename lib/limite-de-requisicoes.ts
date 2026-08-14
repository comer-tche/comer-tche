import { registrar } from "@/lib/auditoria";
import { origemDaRequisicao } from "@/lib/auditoria";
import type { DadosDaSessao } from "@/lib/sessao";

// Limite de requisicoes. Trata o risco R09, indisponibilidade no horario de
// pico, que e o de maior pontuacao do registro (4 x 4 = 16).
//
// A Decisao 4 da arquitetura coloca esse controle na borda, no WAF e no API
// Gateway, e e la que ele deve viver em producao: a borda barra antes de a
// carga chegar aos servicos. O limite implementado aqui e a segunda camada,
// dentro da aplicacao, e existe por defesa em profundidade: se a borda for
// contornada ou estiver mal configurada, a aplicacao ainda se protege.
//
// LIMITACAO CONHECIDA: a contagem vive na memoria do processo. Com mais de
// uma instancia da aplicacao, cada uma conta o seu proprio balde, e o limite
// efetivo passa a ser o valor multiplicado pelo numero de instancias. Em
// producao isso exige um armazenamento compartilhado, como o Redis previsto
// na secao 3 do trabalho, ou o limite da propria borda.

type Balde = { contagem: number; expiraEm: number };

const baldes = new Map<string, Balde>();

// Remove os baldes vencidos de vez em quando, para o mapa nao crescer sem
// limite e virar ele proprio um problema de disponibilidade.
function limparVencidos(agora: number) {
  if (baldes.size < 1000) return;
  for (const [chave, balde] of baldes) {
    if (balde.expiraEm <= agora) baldes.delete(chave);
  }
}

export type RegraDeLimite = {
  // Nome da regra, usado na chave e na trilha de auditoria.
  nome: string;
  maximo: number;
  janelaEmSegundos: number;
};

// Regras por operação. Os valores seguem a Decisao 4: 60 consultas por minuto
// e um numero bem menor de operacoes que escrevem, porque criar pedido custa
// muito mais ao servidor do que ler o cardapio.
export const LIMITES = {
  criacaoDePedido: { nome: "criacao-de-pedido", maximo: 5, janelaEmSegundos: 60 },
  consulta: { nome: "consulta", maximo: 60, janelaEmSegundos: 60 },
} satisfies Record<string, RegraDeLimite>;

// Identifica quem esta chamando. Preferimos a conta autenticada, porque e
// estavel: trocar de endereco de rede e barato, criar conta nao. Sem sessao,
// resta a origem da requisicao.
function identidade(requisicao: Request, sessao: DadosDaSessao | null): string {
  if (sessao) return `usuario:${sessao.usuarioId}`;
  return `origem:${origemDaRequisicao(requisicao) ?? "desconhecida"}`;
}

export type ResultadoDoLimite =
  | { permitido: true }
  | { permitido: false; resposta: Response };

export async function dentroDoLimite(
  requisicao: Request,
  regra: RegraDeLimite,
  sessao: DadosDaSessao | null = null,
): Promise<ResultadoDoLimite> {
  const agora = Date.now();
  limparVencidos(agora);

  const chave = `${regra.nome}|${identidade(requisicao, sessao)}`;
  const balde = baldes.get(chave);

  if (!balde || balde.expiraEm <= agora) {
    baldes.set(chave, { contagem: 1, expiraEm: agora + regra.janelaEmSegundos * 1000 });
    return { permitido: true };
  }

  balde.contagem += 1;

  if (balde.contagem > regra.maximo) {
    await registrar({
      acao: "LIMITE_EXCEDIDO",
      requisicao,
      sessao,
      detalhe: `regra ${regra.nome}: ${balde.contagem} chamadas em ${regra.janelaEmSegundos}s`,
    });

    const segundosParaLiberar = Math.ceil((balde.expiraEm - agora) / 1000);

    return {
      permitido: false,
      resposta: Response.json(
        { erro: "Muitas requisicoes. Tente novamente em instantes." },
        {
          status: 429,
          // Diz ao cliente legitimo quando voltar, para ele nao insistir e
          // piorar a sobrecarga que o limite existe para conter.
          headers: { "retry-after": String(segundosParaLiberar) },
        },
      ),
    };
  }

  return { permitido: true };
}
