// peerClient.ts — explicit local-LAN QVAC HTTP adapter (P1).
// This is deliberately separate from qvacClient.ts: on-device CIBI uses
// @qvac/sdk; CIBI Pro/Super use this reachable local QVAC server only.
// No API key is sent because the workstation is intentionally LAN-local.

import * as FileSystem from 'expo-file-system';
import { logSpan, deviceLabel } from './perf';
import type { TierId } from './TIER_ROSTER';
import type { PerfSpan } from './perf';
import { peerId } from './route';

export const DEFAULT_PEER_BASE = 'http://192.168.0.170:11434';

export const PEER_MODELS = {
  blue: 'healthcare-4b-medical-q8-0',
  super: 'qwen3-5-9b-multimodal-q6-k',
  fallback: 'medpsy-17b',
  translateEs: 'translate-es',
  translatePt: 'translate-pt',
  vision: 'vision-flash',
  ocr: 'vision-flash',
  transcribe: 'parakeet',
  embed: 'embed',
} as const;

export interface PeerModel {
  id: string;
  state?: string;
}

export type PeerHealthReason = 'ok' | 'timeout' | 'unreachable' | 'http_401' | 'http_404' | 'http_other' | 'bad_body';

export interface PeerHealth {
  ok: boolean;
  url: string;
  reason: PeerHealthReason;
  models: PeerModel[];
  readyModels: string[];
  error?: string;
}

export function peerSupportsTier(status: PeerHealth, tier: TierId): boolean {
  if (!status.ok) return false;
  const required = tier === 'CIBI_PRO' ? [PEER_MODELS.blue] : tier === 'CIBI_SUPER' ? [PEER_MODELS.blue, PEER_MODELS.super] : [];
  return required.every((model) => status.readyModels.includes(model));
}

export interface PeerMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

interface PeerRequestOptions {
  method?: string;
  body?: string | FormData;
  contentType?: string;
  timeoutMs?: number;
}

function baseUrl(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

function errorReason(error: unknown): PeerHealthReason {
  const text = String(error instanceof Error ? error.message : error ?? '').toLowerCase();
  if (text.includes('401')) return 'http_401';
  if (text.includes('404')) return 'http_404';
  if (text.includes('timeout') || text.includes('abort')) return 'timeout';
  if (text.includes('http')) return 'http_other';
  return 'unreachable';
}

async function requestJson<T>(base: string, path: string, options: PeerRequestOptions = {}): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 30000);
  try {
    const headers: Record<string, string> = {};
    if (options.contentType !== undefined) headers['Content-Type'] = options.contentType;
    const response = await fetch(`${baseUrl(base)}${path}`, {
      method: options.method ?? 'GET',
      body: options.body as any,
      headers,
      signal: ctrl.signal,
    });
    const raw = await response.text();
    let payload: any = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: { message: raw.slice(0, 400) } };
    }
    if (!response.ok) {
      const message = payload?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`peer HTTP ${response.status}: ${String(message).slice(0, 300)}`);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkPeerHealth(base: string): Promise<PeerHealth> {
  const url = `${baseUrl(base)}/v1/models`;
  try {
    const payload = await requestJson<{ data?: PeerModel[] }>(base, '/v1/models', { timeoutMs: 5000 });
    if (!Array.isArray(payload?.data)) return { ok: false, url, reason: 'bad_body', models: [], readyModels: [] };
    const models = payload.data;
    return {
      ok: models.length > 0,
      url,
      reason: models.length > 0 ? 'ok' : 'bad_body',
      models,
      readyModels: models.filter((m) => m.state === 'ready' || m.state === 'idle').map((m) => m.id),
    };
  } catch (error) {
    return { ok: false, url, reason: errorReason(error), models: [], readyModels: [], error: String(error instanceof Error ? error.message : error).slice(0, 300) };
  }
}

interface PeerStats {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  tokensPerSecond?: number;
  totalTime?: number;
  decodeTime?: number;
  [key: string]: unknown;
}

function modelMeta(model: string): { name: string; quant: string; engine: string; ctx_size: number | null } {
  switch (model) {
    case PEER_MODELS.blue: return { name: 'HEALTHCARE_4B_MEDICAL_Q8_0', quant: 'Q8_0', engine: 'llamacpp-completion', ctx_size: 8192 };
    case PEER_MODELS.super: return { name: 'QWEN3_5_9B_MULTIMODAL_Q6_K', quant: 'Q6_K', engine: 'llamacpp-completion', ctx_size: 8192 };
    case PEER_MODELS.fallback: return { name: 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M', quant: 'Q4_K_M', engine: 'llamacpp-completion', ctx_size: 4096 };
    case PEER_MODELS.translateEs: return { name: 'BERGAMOT_ES_EN', quant: 'int8', engine: 'nmtcpp-translation', ctx_size: null };
    case PEER_MODELS.translatePt: return { name: 'BERGAMOT_PT_EN', quant: 'int8', engine: 'nmtcpp-translation', ctx_size: null };
    case PEER_MODELS.vision: return { name: 'VISIONPSY_NANO_460M_MULTIMODAL_Q8_0', quant: 'Q8_0', engine: 'llamacpp-completion', ctx_size: 1024 };
    case PEER_MODELS.transcribe: return { name: 'PARAKEET_TDT_0_6B_V3_Q8_0', quant: 'Q8_0', engine: 'parakeet-transcription', ctx_size: null };
    case PEER_MODELS.embed: return { name: 'GTE_LARGE_FP16', quant: 'FP16', engine: 'llamacpp-embedding', ctx_size: null };
    default: return { name: model, quant: 'unknown', engine: 'qvac-http', ctx_size: null };
  }
}

async function logPeerSpan(opts: {
  base: string;
  tier: TierId;
  model: string;
  phase: PerfSpan['phase'];
  promptChars: number;
  stats?: PeerStats | null;
  ok: boolean;
  error?: unknown;
}): Promise<void> {
  const meta = modelMeta(opts.model);
  const stats = opts.stats ?? {};
  const tokensIn = Number(stats.prompt_tokens ?? 0) || 0;
  const tokensOut = Number(stats.completion_tokens ?? stats.total_tokens ?? stats.totalTokens ?? 0) || 0;
  const totalMs = Number(stats.totalTime ?? stats.decodeTime ?? 0) || null;
  const tps = Number(stats.tokensPerSecond ?? stats.tokens_per_second ?? 0) || null;
  await logSpan({
    ts: new Date().toISOString(),
    device: deviceLabel(),
    tier: opts.tier,
    model: meta.name,
    quant: meta.quant,
    engine: meta.engine,
    phase: opts.phase,
    prompt_chars: opts.promptChars,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    ttft_ms: null,
    throughput_tps: tps,
    load_ms: totalMs,
    ctx_size: meta.ctx_size,
    image_no_upscale: opts.model === PEER_MODELS.vision ? 'on' : null,
    mode: 'peer',
    peer_id: peerId(opts.base),
    ok: opts.ok,
    ...(opts.error ? { error: String(opts.error).slice(0, 400) } : {}),
  });
}

export async function peerChat(opts: {
  base: string;
  tier: TierId;
  model: string;
  messages: PeerMessage[];
  maxTokens?: number;
  reasoningBudget?: number;
  responseFormat?: Record<string, unknown>;
  phase?: PerfSpan['phase'];
}): Promise<{ text: string; stats: PeerStats | null }> {
  const promptChars = opts.messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length), 0);
  try {
    const payload = await requestJson<any>(opts.base, '/v1/chat/completions', {
      method: 'POST',
      contentType: 'application/json',
      timeoutMs: 180000,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? 512,
        ...(opts.reasoningBudget != null ? { reasoning_budget: opts.reasoningBudget } : {}),
        ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
      }),
    });
    const choice = payload?.choices?.[0];
    const message = choice?.message;
    const text = typeof message?.content === 'string' ? message.content.trim() : '';
    if (choice?.finish_reason === 'length') throw new Error('peer-generation-truncated');
    if (!text) throw new Error('peer-empty-chat-response');
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: opts.model, phase: opts.phase ?? 'completion', promptChars, stats: payload?.usage, ok: true });
    return { text, stats: payload?.usage ?? null };
  } catch (error) {
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: opts.model, phase: opts.phase ?? 'completion', promptChars, ok: false, error });
    throw error;
  }
}

export async function peerTranslate(opts: { base: string; tier: TierId; model: string; text: string }): Promise<{ text: string; stats: PeerStats | null }> {
  try {
    const payload = await requestJson<any>(opts.base, '/qvac/v1/translate', {
      method: 'POST',
      contentType: 'application/json',
      timeoutMs: 30000,
      body: JSON.stringify({ model: opts.model, text: opts.text }),
    });
    const translations = Array.isArray(payload?.translations) ? payload.translations : [];
    const text = translations.join('\n').trim();
    if (!text) throw new Error('peer-empty-translation');
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: opts.model, phase: 'translate', promptChars: opts.text.length, stats: payload?.stats, ok: true });
    return { text, stats: payload?.stats ?? null };
  } catch (error) {
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: opts.model, phase: 'translate', promptChars: opts.text.length, ok: false, error });
    throw error;
  }
}

export async function peerEmbed(opts: { base: string; tier: TierId; text: string | string[] }): Promise<{ vectors: number[][]; stats: PeerStats | null }> {
  const promptChars = Array.isArray(opts.text) ? opts.text.join(' ').length : opts.text.length;
  try {
    const payload = await requestJson<any>(opts.base, '/v1/embeddings', {
      method: 'POST',
      contentType: 'application/json',
      timeoutMs: 120000,
      body: JSON.stringify({ model: PEER_MODELS.embed, input: opts.text }),
    });
    const vectors = (payload?.data ?? []).map((row: any) => row.embedding).filter((v: any) => Array.isArray(v)) as number[][];
    if (vectors.length === 0) throw new Error('peer-empty-embedding');
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: PEER_MODELS.embed, phase: 'embed', promptChars, stats: payload?.usage, ok: true });
    return { vectors, stats: payload?.usage ?? null };
  } catch (error) {
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: PEER_MODELS.embed, phase: 'embed', promptChars, ok: false, error });
    throw error;
  }
}

export async function peerTranscribe(opts: { base: string; tier: TierId; audioPath: string }): Promise<{ text: string; stats: PeerStats | null }> {
  const form = new FormData();
  const filename = opts.audioPath.split('/').pop() || 'recording.m4a';
  const type = filename.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mp4';
  form.append('file', { uri: opts.audioPath, name: filename, type } as any);
  form.append('model', PEER_MODELS.transcribe);
  try {
    const payload = await requestJson<any>(opts.base, '/v1/audio/transcriptions', { method: 'POST', body: form, timeoutMs: 180000 });
    const text = String(payload?.text ?? '').trim();
    if (!text) throw new Error('peer-empty-transcript');
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: PEER_MODELS.transcribe, phase: 'transcribe', promptChars: 0, stats: payload?.usage, ok: true });
    return { text, stats: payload?.usage ?? null };
  } catch (error) {
    await logPeerSpan({ base: opts.base, tier: opts.tier, model: PEER_MODELS.transcribe, phase: 'transcribe', promptChars: 0, ok: false, error });
    throw error;
  }
}

async function photoDataUrl(photoPath: string): Promise<string> {
  const encoding = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
  const base64 = await FileSystem.readAsStringAsync(photoPath, { encoding });
  const mime = /\.png$/i.test(photoPath) ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

export async function peerVision(opts: { base: string; tier: TierId; photoPath: string; prompt: string; phase?: PerfSpan['phase'] }): Promise<string> {
  const imageUrl = await photoDataUrl(opts.photoPath);
  const result = await peerChat({
    base: opts.base,
    tier: opts.tier,
    model: PEER_MODELS.vision,
    phase: opts.phase ?? 'completion',
    maxTokens: 512,
    reasoningBudget: 0,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: opts.prompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }],
  });
  return result.text;
}

export async function peerOcr(opts: { base: string; tier: TierId; photoPath: string }): Promise<string> {
  return peerVision({
    base: opts.base,
    tier: opts.tier,
    photoPath: opts.photoPath,
    phase: 'ocr',
    prompt: 'Read only visible equipment label text in this image. Return strict JSON only: {"text":"..."}. Do not invent text. If no readable label exists, return {"text":""}.',
  }).then((raw) => {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) return String(JSON.parse(raw.slice(start, end + 1))?.text ?? '').trim();
    } catch {}
    return raw.trim();
  });
}
