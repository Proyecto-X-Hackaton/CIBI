// ChatCaptureScreen — SCREEN_01 + F01/F02/F10 chat loop.
// Composer WhatsApp style: input + 📷 + 🎙️ inside + ➤. Tier bar (mascots as
// colored dots; PNGs optional in assets/). No model names in chat — tier +
// ⓘ detalles only. Photo path: consent gate → camera → VisionPsy-Flash +
// OCR on-device → merged hints → write-through SQLite.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { C, Disclaimer } from '../components/atoms';
import { useApp } from '../state/AppState';
import { getMessages, appendMessage, savePhotoEvidence, getInspection, updateInspection, mediaDir, type ChatMsg } from '../db/database';
import { normalizeToEnglish } from '../qvac/translate';
import { describePhoto, readLabelText } from '../qvac/visionOcr';
import { matchCatalog, guidanceText } from '../catalog/catalog';
import { transcribeAudio } from '../qvac/voice';

export default function ChatCaptureScreen({ inspectionId }: { inspectionId: string }) {
  const { setWizard, setDetailsOpen, tier } = useApp();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const scroll = useRef<ScrollView>(null);

  const reload = async () => setMsgs(await getMessages(inspectionId).catch(() => []));
  useEffect(() => {
    reload();
    (async () => {
      const cur = await getMessages(inspectionId).catch(() => []);
      if (cur.length === 0) {
        const hello: ChatMsg = { role: 'assistant', text_original: '👋 Soy tu asistente de inventario. Háblame en ES/PT y te guío: qué mirar, qué foto tomar, a quién preguntar.', lang: null, text_en: null };
        await appendMessage(inspectionId, hello);
        reload();
      }
    })();
  }, [inspectionId]);

  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100); }, [msgs]);

  const push = async (m: ChatMsg) => {
    await appendMessage(inspectionId, m);
    await reload();
  };

  const sendText = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy('Traduciendo…');
    await push({ role: 'user', text_original: text, lang: null, text_en: null });
    try {
      const { text_en, lang, untranslated } = await normalizeToEnglish({ text });
      const match = matchCatalog(text_en);
      // Patch inspection customer/city guess is done at review (MedPsy). Here: guidance.
      const counts = quickCounts(text_en);
      const guide = guidanceText(match);
      await push({
        role: 'assistant',
        text_original: `Anoté ${counts || 'tu reporte'}. ${untranslated ? '(traducción no disponible offline — uso original)' : ''}\n\n🤖 Lo más valioso: ${nextQuestion(text_en)}\n\n${guide}`,
        lang,
        text_en,
      });
    } catch {
      await push({ role: 'assistant', text_original: 'Guardé tu mensaje localmente. Sin conexión sigo anotando — revisamos al final.', lang: null, text_en: null });
    } finally {
      setBusy(null);
    }
  };

  const takePhoto = async () => {
    if (busy) return;
    if (!authorized) {
      Alert.alert('Foto autorizada', 'Confirma que el sitio autoriza fotografiar la placa del equipo.', [
        { text: 'No autorizado', style: 'cancel' },
        { text: '☑ Autorizada', onPress: () => { setAuthorized(true); setTimeout(takePhoto, 300); } },
      ]);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      await push({ role: 'assistant', text_original: 'Sin permiso de cámara seguimos con texto — la inspección igual se completa.', lang: null, text_en: null });
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false });
    if (shot.canceled || !shot.assets?.[0]?.uri) return;
    setBusy('Viendo + leyendo placa…');
    try {
      const src = shot.assets[0].uri;
      const dst = `${mediaDir()}/photos/${inspectionId}-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: src, to: dst }).catch(() => {});
      const path = await FileSystem.getInfoAsync(dst).then((i) => (i.exists ? dst : src)).catch(() => src);
      const [vision, ocrRes] = await Promise.all([
        describePhoto({ photoPath: path }),
        readLabelText({ photoPath: path }),
      ]);
      await savePhotoEvidence(inspectionId, path, true, ocrRes.blocks, vision);
      const agree = !!vision.modality_guess && ocrRes.joinedText.length > 0;
      await push({
        role: 'assistant',
        text_original: `📷 Placa recibida. Texto leído ${ocrRes.topConfidence.toFixed(2)} · modalidad ${vision.modality_guess ?? '?'} ✓\n${ocrRes.joinedText ? `Leído: ${ocrRes.joinedText.slice(0, 160)}` : 'Sin texto legible — vale la descripción visual.'}${agree ? '\n✓ Foto+texto coinciden → candidato a Confirmed en Revisar.' : ''}`,
        lang: null,
        text_en: vision.raw || null,
      });
    } catch {
      await push({ role: 'assistant', text_original: 'No pude procesar la foto en el teléfono — la guardé como evidencia y seguimos.', lang: null, text_en: null });
    } finally {
      setBusy(null);
    }
  };

  const toggleRecord = async () => {
    try {
      if (recording) {
        setBusy('Transcribiendo voz…');
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (uri) {
          const dst = `${mediaDir()}/audio/${inspectionId}-${Date.now()}.m4a`;
          await FileSystem.copyAsync({ from: uri, to: dst }).catch(() => {});
          const { text, ok } = await transcribeAudio({ audioPath: dst });
          if (ok) setInput(text);
          else Alert.alert('Voz no disponible', 'Usa el teclado — el texto lleva el demo (voz es stretch).');
        }
        setBusy(null);
        return;
      }
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Micrófono', 'Sin permiso — escribe el reporte, el flujo no se bloquea.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch {
      setRecording(null);
      setBusy(null);
      Alert.alert('Voz no disponible', 'Usa el teclado — el texto lleva el demo (voz es stretch).');
    }
  };

  return (
    <View style={s.wrap}>
      <View style={s.step}><Text style={s.stepText}>‹ Salir · Paso 1 de 2 — Chat experto · Borrador ●</Text></View>
      <View style={s.tierbar}>
        {(['CIBI', 'CIBI_PRO', 'CIBI_SUPER'] as const).map((t) => (
          <View key={t} style={[s.tier, t === 'CIBI' && s.tierOn]}>
            <Text style={s.tierText}>{t === 'CIBI' ? '🟢 CIBI' : t === 'CIBI_PRO' ? '🔵 CIBI Pro · 🔒' : '🟣 CIBI Super · 🔒'}</Text>
          </View>
        ))}
      </View>
      <ScrollView ref={scroll} style={s.chat} contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
        {msgs.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === 'user' ? s.user : s.ai]}>
            <Text style={s.msgText}>{m.text_original}</Text>
            {m.role === 'user' && m.text_en ? <Text style={s.meta}>ES/PT detectado → EN guardado</Text> : null}
            {m.role === 'assistant' ? <Text style={s.meta}>{tier === 'CIBI' ? '🟢 CIBI' : tier} · en tu teléfono · <Text onPress={() => setDetailsOpen(true)} style={{ textDecorationLine: 'underline' }}>ⓘ detalles</Text></Text> : null}
          </View>
        ))}
        {busy ? <View style={[s.bubble, s.ai]}><ActivityIndicator color={C.green} /><Text style={s.meta}>{busy} (modelo on-device, uno a la vez)</Text></View> : null}
      </ScrollView>
      <View style={s.composer}>
        <View style={s.wabar}>
          <View style={s.inputwrap}>
            <TextInput style={s.input} placeholder="Escribe un mensaje…" placeholderTextColor="#6E6E78" value={input} onChangeText={setInput} multiline />
            <TouchableOpacity onPress={takePhoto}><Text style={s.attach}>📷</Text></TouchableOpacity>
            <TouchableOpacity onPress={toggleRecord}><Text style={[s.attach, recording && { color: C.amber }]}>{recording ? '⏹️' : '🎙️'}</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={s.send} onPress={sendText}><Text style={s.sendText}>➤</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={s.cta} onPress={() => setWizard({ name: 'review', inspectionId })}>
          <Text style={s.ctaText}>Pasar a revisar →</Text>
        </TouchableOpacity>
      </View>
      <Disclaimer />
    </View>
  );
}

function quickCounts(en: string): string | null {
  const t = en.toLowerCase();
  const find = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1]) : null;
  };
  const mr = find(/(\d+)\s*(mr|magnetic|resonan)/) ?? (/\bmr\b/.test(t) ? 1 : null);
  const ct = find(/(\d+)\s*(ct|tomograph)/) ?? (/\bct\b/.test(t) ? 1 : null);
  const us = find(/(\d+)\s*(us|ultrasound|ultrason)/) ?? (/\bultrasound\b/.test(t) ? 1 : null);
  const parts: string[] = [];
  if (mr) parts.push(`${mr} MR`);
  if (ct) parts.push(`${ct} CT`);
  if (us) parts.push(`${us} US`);
  return parts.length ? parts.join(' / ') : null;
}

function nextQuestion(en: string): string {
  const t = en.toLowerCase();
  if (/\bct\b|tomograph/.test(t) && !/(siemens|ge\b|philips|canon|toshiba|hitachi|fabricante)/.test(t)) return '¿fabricante de los CT?';
  if (!/(\d+)\s*(y|year|año)/.test(t)) return '¿edad aproximada de los equipos?';
  return '¿cantidad exacta por modalidad?';
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  step: { paddingHorizontal: 16, paddingTop: 10 },
  stepText: { color: C.muted, fontSize: 12 },
  tierbar: { flexDirection: 'row', gap: 6, padding: 10 },
  tier: { flex: 1, borderRadius: 12, padding: 7, borderWidth: 1, borderColor: '#34343F', backgroundColor: '#1A1A24' },
  tierOn: { borderColor: C.green, backgroundColor: 'rgba(34,197,94,.12)' },
  tierText: { color: '#D6D6DE', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  chat: { flex: 1, paddingHorizontal: 16 },
  bubble: { maxWidth: '88%', borderRadius: 16, padding: 12 },
  ai: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, alignSelf: 'flex-start' },
  user: { backgroundColor: 'rgba(59,130,246,.18)', borderColor: 'rgba(59,130,246,.5)', borderWidth: 1, alignSelf: 'flex-end' },
  msgText: { color: C.text, fontSize: 13.5, lineHeight: 20 },
  meta: { color: C.muted, fontSize: 11, marginTop: 6 },
  composer: { borderTopColor: C.border, borderTopWidth: 1, backgroundColor: '#101016', padding: 10 },
  wabar: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  inputwrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E28', borderColor: '#3A3A45', borderWidth: 1, borderRadius: 26, paddingLeft: 14, minHeight: 52 },
  input: { flex: 1, color: '#fff', fontSize: 14 },
  attach: { fontSize: 19, padding: 8, color: '#C9C9D4' },
  send: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' },
  sendText: { fontSize: 19, color: '#04120A', fontWeight: '800' },
  cta: { backgroundColor: C.green, borderRadius: 14, minHeight: 50, justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#04120A', fontWeight: '800', fontSize: 15, textAlign: 'center' },
});
