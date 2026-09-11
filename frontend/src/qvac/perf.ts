// perf.ts — structured perf log (F09). One JSONL row per span.
// Schema: {ts, device, tier, model, quant, engine, phase, prompt_chars,
// tokens_in/out, ttft_ms, throughput_tps, load_ms, ctx_size,
// image_no_upscale, mode, peer_id, ok}
// Written to FileSystem.documentDirectory/cibi/PERF_LOG.jsonl so the jury
// can pull it from the physical device. Also kept in memory for ⓘ sheet.

import * as FileSystem from 'expo-file-system';
import * as Device from 'expo-device';

export interface PerfSpan {
  ts: string;
  device: string;
  tier: string;
  model: string;
  quant: string;
  engine: string;
  phase: 'load' | 'translate' | 'completion' | 'ocr' | 'embed' | 'ragSearch' | 'transcribe';
  prompt_chars: number;
  tokens_in: number;
  tokens_out: number;
  ttft_ms: number | null;
  throughput_tps: number | null;
  load_ms: number | null;
  ctx_size: number | null;
  image_no_upscale?: string | null;
  mode: 'offline' | 'peer';
  peer_id: string | null;
  ok: boolean;
  error?: string;
}

const memorySpans: PerfSpan[] = [];

export function deviceLabel(): string {
  // Exact Build.MODEL is recorded here at smoke test (F09 acceptance).
  const brand = Device.brand ?? 'unknown-brand';
  const model = Device.modelName ?? Device.deviceName ?? 'unknown-model';
  const os = `${Device.osName ?? 'Android'} ${Device.osVersion ?? ''}`.trim();
  const mem = Device.totalMemory ? ` · ${Math.round(Device.totalMemory / 1e9)}GB RAM` : '';
  return `${os} · ${brand} ${model}${mem}`;
}

function perfPath(): string {
  const base = (FileSystem as any).documentDirectory as string;
  return `${base}cibi/PERF_LOG.jsonl`;
}

export async function logSpan(span: PerfSpan): Promise<void> {
  memorySpans.push(span);
  try {
    const path = perfPath();
    await FileSystem.makeDirectoryAsync(`${(FileSystem as any).documentDirectory}cibi`, { intermediates: true }).catch(() => {});
    const line = JSON.stringify(span) + '\n';
    const info = await FileSystem.getInfoAsync(path).catch(() => null);
    if (info && (info as any).exists) {
      const prev = await FileSystem.readAsStringAsync(path).catch(() => '');
      await FileSystem.writeAsStringAsync(path, prev + line).catch(() => {});
    } else {
      await FileSystem.writeAsStringAsync(path, line).catch(() => {});
    }
  } catch {
    // Logging must never break the judged flow.
  }
  if (__DEV__) {
    // Load spans carry load_ms (there is no TTFT for a load); other spans
    // carry ttft_ms where available. This is what the smoke log reads.
    const ms = span.phase === 'load' ? span.load_ms : span.ttft_ms ?? span.load_ms;
    const rate = span.throughput_tps != null ? `${span.throughput_tps.toFixed(1)}t/s` : '-t/s';
    const tok = span.tokens_out ? `${span.tokens_out}tok` : '';
    console.log('[perf]', span.phase, span.model, `${ms != null ? `${Math.round(ms)}ms` : '-ms'}`, rate, tok);
  }
}

export function recentSpans(n = 8): PerfSpan[] {
  return memorySpans.slice(-n).reverse();
}

export async function readPerfFile(): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(perfPath());
  } catch {
    return '';
  }
}
