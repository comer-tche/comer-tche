-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT 'CLIENTE',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "name" TEXT NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descricao" TEXT NOT NULL,
    "precoEmCentavos" INTEGER NOT NULL,
    "disponivel" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "totalEmCentavos" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "enderecoDeEntrega" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" INTEGER NOT NULL,
    "itemDoCardapioId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitarioEmCentavos" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_itemDoCardapioId_fkey" FOREIGN KEY ("itemDoCardapioId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'PENDENTE',
    "valorEmCentavos" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_pedidoId_key" ON "Payment"("pedidoId");
