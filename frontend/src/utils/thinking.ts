// thinking.ts — reasoning models (Qwen3-family templates) emit
// ` thinking… response` before the answer. The app never shows nor persists
// that channel: strip it here and again defensively at parse sites.
// Handles both closed blocks and an unclosed trailing block (truncated by
// the predict cap mid-thought).

const PAIRED_THINK = /<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi;
const UNCLOSED_TRAILING_THINK = /<\s*think(?:ing)?\s*>[\s\S]*$/i;

export function stripThinkingBlocks(text: string): string {
  return text.replace(PAIRED_THINK, '').replace(UNCLOSED_TRAILING_THINK, '').trim();
}