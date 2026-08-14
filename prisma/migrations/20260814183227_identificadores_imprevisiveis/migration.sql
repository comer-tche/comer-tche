/*
  Warnings:

  - The primary key for the `Order` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" INTEGER NOT NULL,
    "totalEmCentavos" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "enderecoDeEntrega" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("clienteId", "criadoEm", "enderecoDeEntrega", "id", "situacao", "totalEmCentavos") SELECT "clienteId", "criadoEm", "enderecoDeEntrega", "id", "situacao", "totalEmCentavos" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" TEXT NOT NULL,
    "itemDoCardapioId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitarioEmCentavos" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_itemDoCardapioId_fkey" FOREIGN KEY ("itemDoCardapioId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "itemDoCardapioId", "pedidoId", "precoUnitarioEmCentavos", "quantidade") SELECT "id", "itemDoCardapioId", "pedidoId", "precoUnitarioEmCentavos", "quantidade" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE TABLE "new_Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" TEXT NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'PENDENTE',
    "valorEmCentavos" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("criadoEm", "id", "pedidoId", "situacao", "valorEmCentavos") SELECT "criadoEm", "id", "pedidoId", "situacao", "valorEmCentavos" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_pedidoId_key" ON "Payment"("pedidoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
