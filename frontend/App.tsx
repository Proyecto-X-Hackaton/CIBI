import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text } from 'react-native';
import {
  BERGAMOT_ES_EN,
  completion,
  downloadAsset,
  embed,
  HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
  GTE_LARGE_FP16,
  loadModel,
  translate,
  unloadModel,
  type ModelProgressUpdate,
} from '@qvac/sdk';

// D1 smoke test: sequential load→infer→unload, ONE model resident at a time.
// Stage 1: TranslatePsy ES→EN · Stage 2: MedPsy-1.7B structuring · Stage 3: GTE embed.
// VisionPsy smoke lands with the camera screen (needs a photo); lifecycle is identical.
export default function App() {
  const [log, setLog] = useState<string[]>(['CIBI D1 smoke test — starting…']);

  useEffect(() => {
    let cancelled = false;
    const line = (s: string) => {
      // eslint-disable-next-line no-console
      console.log(s);
      if (!cancelled) setLog((prev) => [...prev, s]);
    };
    (async () => {
      try {
        // ── Stage 1: TranslatePsy ──────────────────────────────
        let t0 = Date.now();
        await downloadAsset({
          assetSrc: BERGAMOT_ES_EN,
          onProgress: (p: ModelProgressUpdate) => line(`dl translate ${Math.round(p.percentage)}%`),
        });
        let modelId = await loadModel({ modelSrc: BERGAMOT_ES_EN });
        line(`translate load_ms=${Date.now() - t0}`);
        t0 = Date.now();
        const tr = await translate({
          modelId,
          text: 'Visité el Hospital Alpha hoy. Tienen tres sistemas MR y dos CT.',
          modelType: 'nmt',
          stream: false,
        });
        line(`translate infer_ms=${Date.now() - t0} text=${tr.text}`);
        await unloadModel({ modelId });
        line('translate unloaded ✓');

        // ── Stage 2: MedPsy-1.7B structuring ────────────────────
        t0 = Date.now();
        await downloadAsset({
          assetSrc: HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
          onProgress: (p: ModelProgressUpdate) => line(`dl medpsy ${Math.round(p.percentage)}%`),
        });
        modelId = await loadModel({
          modelSrc: HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
          modelConfig: { ctx_size: 4096 },
        });
        line(`medpsy load_ms=${Date.now() - t0}`);
        t0 = Date.now();
        const comp = await completion({
          modelId,
          history: [
            {
              role: 'user',
              content:
                'Extract ONLY customer/facility, city, country, items[{modality, manufacturer, model, qty, age_text, age_years}], strict JSON, unknown→null. Equipment inventory, not medical advice. Text: They have three MR systems, two CT systems and four ultrasound systems. Two of the MR systems appear to be around 8-10 years old.',
            },
          ],
          stream: false,
        });
        const out = await comp.text;
        line(`medpsy infer_ms=${Date.now() - t0} out=${String(out).slice(0, 300)}`);
        await unloadModel({ modelId });
        line('medpsy unloaded ✓');

        // ── Stage 3: GTE embedding ─────────────────────────────
        t0 = Date.now();
        await downloadAsset({
          assetSrc: GTE_LARGE_FP16,
          onProgress: (p: ModelProgressUpdate) => line(`dl gte ${Math.round(p.percentage)}%`),
        });
        modelId = await loadModel({ modelSrc: GTE_LARGE_FP16 });
        line(`gte load_ms=${Date.now() - t0}`);
        t0 = Date.now();
        const em = await embed({ modelId, text: 'MR system Hospital Alpha' });
        line(`gte infer_ms=${Date.now() - t0} dims=${em.embedding.length}`);
        await unloadModel({ modelId });
        line('gte unloaded ✓');
        line('SMOKE TEST DONE ✅ — 3 stages sequential, one resident at a time');
      } catch (e: unknown) {
        line(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.container}>
        <Text style={styles.h1}>CIBI · D1 smoke test</Text>
        <Text style={styles.disclaimer}>
          Extracción de inventario de equipamiento. No es diagnóstico clínico.
        </Text>
        {log.map((l, i) => (
          <Text key={i} style={styles.line}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1, padding: 16 },
  h1: { color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  disclaimer: { color: '#F59E0B', fontSize: 12, marginBottom: 12 },
  line: { color: '#D6D6DE', fontSize: 12, fontFamily: 'monospace', marginBottom: 4 },
});
