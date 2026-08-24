import crypto from "crypto";

const catalog = [
  { id: "coffee", title: "Coffee", priceCents: 500 },
  { id: "sticker", title: "MCP sticker", priceCents: 200 },
];

export function getItem(itemId) {
  return catalog.find((item) => item.id === itemId);
}

export function validatePurchase({ item, quantity, customerName, customerEmail }) {
  return Boolean(
    item && Number.isInteger(quantity) && quantity >= 1 && customerName && customerEmail,
  );
}

export function completeOrder({ item, quantity, customerName, customerEmail }) {
  return {
    id: crypto.randomUUID(),
    item,
    quantity,
    customerName,
    customerEmail,
  };
}
