import crypto from "node:crypto";

export interface CatalogItem {
  id: string;
  title: string;
  priceCents: number;
}

interface PurchaseInput {
  item: CatalogItem | undefined;
  quantity: number;
  customerName: string | null;
  customerEmail: string | null;
}

export interface Purchase {
  item: CatalogItem;
  quantity: number;
  customerName: string;
  customerEmail: string;
}

const catalog: CatalogItem[] = [
  { id: "coffee", title: "Coffee", priceCents: 500 },
  { id: "sticker", title: "MCP sticker", priceCents: 200 },
];

export function getItem(itemId: string | null): CatalogItem | undefined {
  return catalog.find((item) => item.id === itemId);
}

export function validatePurchase(input: PurchaseInput): input is Purchase {
  const { item, quantity, customerName, customerEmail } = input;
  return Boolean(
    item && Number.isInteger(quantity) && quantity >= 1 && customerName && customerEmail,
  );
}

export function completeOrder({ item, quantity, customerName, customerEmail }: Purchase) {
  return {
    id: crypto.randomUUID(),
    item,
    quantity,
    customerName,
    customerEmail,
  };
}
