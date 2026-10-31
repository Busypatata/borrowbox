/** One conversation per participant pair and item context. */
export function conversationKey(a: string, b: string, itemId?: string | null): string {
  const [x, y] = [a, b].sort();
  return `${x}:${y}:${itemId ?? 'direct'}`;
}
