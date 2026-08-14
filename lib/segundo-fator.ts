import { createHash, randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { banco } from "@/lib/banco";
import { origemDaRequisicao } from "@/lib/auditoria";

// Segundo fator de autenticacao. Passo 5 da ordem de implementacao
// (secao 9.5), aplicando o requisito RS03 e tratando o risco R01, o mais
// provavel do registro: listas de senhas vazadas circulam publicamente e, com
// a senha como unico fator, nada interrompe quem as testa em massa.
//
// A exigencia e condicional. Pedir codigo em todo login incomodaria o uso
// diario e levaria as pessoas a contornarem a protecao. Ele so aparece quando
// o login vem de um aparelho que aquela conta nunca usou.

const VALIDADE_DO_DESAFIO_EM_MINUTOS = 10;
const MAXIMO_DE_TENTATIVAS = 3;

// Identifica o aparelho. Em producao isso seria um identificador estavel
// guardado no proprio aplicativo; aqui aceitamos o cabecalho x-dispositivo e,
// na falta dele, combinamos o agente e a origem. E uma heuristica: serve para
// decidir quando pedir o segundo fator, nunca para autorizar sozinha.
export function impressaoDoDispositivo(requisicao: Request): string {
  const informado = requisicao.headers.get("x-dispositivo");
  const base = informado ?? `${requisicao.headers.get("user-agent") ?? ""}|${origemDaRequisicao(requisicao) ?? ""}`;
  return createHash("sha256").update(base).digest("hex");
}

export async function dispositivoConhecido(usuarioId: number, impressao: string): Promise<boolean> {
  const registro = await banco.knownDevice.findUnique({
    where: { usuarioId_impressao: { usuarioId, impressao } },
  });
  return registro !== null;
}

export async function marcarDispositivoComoConhecido(usuarioId: number, impressao: string): Promise<void> {
  await banco.knownDevice.upsert({
    where: { usuarioId_impressao: { usuarioId, impressao } },
    create: { usuarioId, impressao },
    update: { ultimoUso: new Date() },
  });
}

export type DesafioCriado = {
  desafioId: string;
  // O codigo so e devolvido fora de producao. Em producao ele sai por e-mail
  // ou SMS e nunca aparece na resposta da API.
  codigoParaDesenvolvimento?: string;
};

export async function criarDesafio(usuarioId: number, impressao: string): Promise<DesafioCriado> {
  // randomInt usa o gerador criptografico do sistema. Math.random e
  // previsivel e nao serve para codigo de autenticacao.
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const desafioId = randomUUID();

  await banco.mfaChallenge.create({
    data: {
      id: desafioId,
      usuarioId,
      codigoHash: await bcrypt.hash(codigo, 10),
      impressao,
      expiraEm: new Date(Date.now() + VALIDADE_DO_DESAFIO_EM_MINUTOS * 60_000),
    },
  });

  if (process.env.NODE_ENV === "production") {
    return { desafioId };
  }

  console.log(`[desenvolvimento] codigo do segundo fator para o usuario ${usuarioId}: ${codigo}`);
  return { desafioId, codigoParaDesenvolvimento: codigo };
}

export type ResultadoDaVerificacao =
  | { ok: true; usuarioId: number; impressao: string }
  | { ok: false; motivo: "DESAFIO_INVALIDO" | "EXPIRADO" | "TENTATIVAS_EXCEDIDAS" | "CODIGO_INCORRETO" };

export async function verificarDesafio(desafioId: string, codigo: string): Promise<ResultadoDaVerificacao> {
  const desafio = await banco.mfaChallenge.findUnique({ where: { id: desafioId } });

  if (!desafio) return { ok: false, motivo: "DESAFIO_INVALIDO" };

  if (desafio.expiraEm < new Date()) {
    await banco.mfaChallenge.delete({ where: { id: desafioId } });
    return { ok: false, motivo: "EXPIRADO" };
  }

  if (desafio.tentativas >= MAXIMO_DE_TENTATIVAS) {
    await banco.mfaChallenge.delete({ where: { id: desafioId } });
    return { ok: false, motivo: "TENTATIVAS_EXCEDIDAS" };
  }

  const confere = await bcrypt.compare(codigo, desafio.codigoHash);

  if (!confere) {
    // Sem o limite de tentativas, seis digitos sao adivinhaveis por forca
    // bruta em pouco tempo.
    await banco.mfaChallenge.update({
      where: { id: desafioId },
      data: { tentativas: { increment: 1 } },
    });
    return { ok: false, motivo: "CODIGO_INCORRETO" };
  }

  // Desafio usado e desafio consumido: nao pode valer duas vezes.
  await banco.mfaChallenge.delete({ where: { id: desafioId } });

  return { ok: true, usuarioId: desafio.usuarioId, impressao: desafio.impressao };
}
