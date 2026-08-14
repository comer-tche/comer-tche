import type { DadosDaSessao } from "@/lib/sessao";

// Minimizacao de dados. Passo 6 da ordem de implementacao (secao 9.5),
// completando a Decisao 3 da arquitetura. Trata o risco R08: dados do cliente
// visiveis fora de uma entrega em andamento.
//
// O R08 e diferente dos demais. Nao existe ataque nenhum: e o comportamento
// normal do aplicativo, disponivel a todos os entregadores cadastrados o
// tempo todo. Por isso a estrategia escolhida na secao 9.2 foi evitar, e nao
// reduzir. A condicao e eliminada, e nao apenas dificultada.
//
// A regra e simples: o entregador precisa de telefone e endereco enquanto
// esta entregando. Depois que a entrega termina, nao precisa mais.

type PedidoComCliente = {
  situacao: string;
  clienteId: number;
  enderecoDeEntrega: string;
  cliente?: { id: number; nome: string; telefone: string } | null;
};

// Situacoes em que a entrega ainda esta em curso e o contato do cliente e
// necessario para o servico acontecer.
const ENTREGA_EM_CURSO = ["AGUARDANDO_PAGAMENTO", "PAGO", "EM_PREPARO", "A_CAMINHO"];

export function ocultarDadosAposEntrega<T extends PedidoComCliente>(
  pedido: T,
  sessao: DadosDaSessao,
): T {
  // O proprio cliente sempre ve os proprios dados, e o administrador precisa
  // deles para atender disputas. A ocultacao vale para os demais perfis, em
  // especial o do entregador.
  const ehDono = pedido.clienteId === sessao.usuarioId;
  if (ehDono || sessao.perfil === "ADMIN") return pedido;

  if (ENTREGA_EM_CURSO.includes(pedido.situacao)) return pedido;

  // Entrega concluida ou cancelada: sobra o necessario para o entregador
  // reconhecer o pedido no historico, sem endereco nem telefone.
  return {
    ...pedido,
    enderecoDeEntrega: mascararEndereco(pedido.enderecoDeEntrega),
    cliente: pedido.cliente
      ? { ...pedido.cliente, telefone: mascararTelefone(pedido.cliente.telefone) }
      : pedido.cliente,
  };
}

// Mantem apenas o suficiente para a pessoa lembrar de qual entrega se trata.
function mascararEndereco(endereco: string): string {
  const primeiraParte = endereco.split(",")[0]?.trim() ?? "";
  return primeiraParte ? `${primeiraParte}, (ocultado apos a entrega)` : "(ocultado apos a entrega)";
}

function mascararTelefone(telefone: string): string {
  const ultimos = telefone.slice(-4);
  return `****${ultimos}`;
}
