import { qcf4PagePath } from "./qcf4-logic.js";

export async function fetchQcf4Page(page) {
  const response = await fetch(qcf4PagePath(page));
  if (!response.ok) return null;
  return response.json();
}
