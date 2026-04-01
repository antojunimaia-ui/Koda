export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  // This is a simple heuristic, not an exact count
  return Math.ceil(text.length / 4);
}

export function truncateToTokenLimit(
  text: string,
  maxTokens: number
): string {
  const estimatedChars = maxTokens * 4;
  if (text.length <= estimatedChars) return text;

  return (
    text.substring(0, estimatedChars) +
    "\n... [truncated to fit token limit]"
  );
}

export function formatTokenCount(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(2)}M`;
}
