import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { base } from './api';



export interface Alert {
  id: string;
  bookTitle: string;
  signal: { title: string; url: string; source: string };
  passage: { ref: string; text: string };
  score: number;
  suggestedReply: string;
  suggestedVia: string;
  status: string;
  finalReply?: string;
  turnLiveUrl?: string;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const reload = async () =>
    fetch(`${await base()}/api/alerts?all=1`)
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => {});
  useEffect(() => {
    reload();
    const t = setInterval(reload, 45_000);
    return () => clearInterval(t);
  }, []);
  return { alerts, reload };
}

// The scout's inbox: your books found something in the world worth replying
// to. Review the grounded draft, edit, approve — approval renders the exact
// turn where your book speaks on it, and the reply carries that link.
export default function Alerts({ alerts, reload }: { alerts: Alert[]; reload: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function dismiss(alert: Alert) {
    setBusy(alert.id);
    try {
      await fetch(`${await base()}/api/alerts/${alert.id}/dismiss`, { method: 'POST' });
      reload();
    } finally {
      setBusy(null);
    }
  }

  async function approve(alert: Alert) {
    setBusy(alert.id);
    try {
      const res = await fetch(`${await base()}/api/alerts/${alert.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: drafts[alert.id] ?? alert.suggestedReply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      reload();
      await Share.share({ message: data.finalReply });
    } catch {
      /* shown on next poll */
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={st.pad}>
      <Text style={st.h}>Alerts</Text>
      <Text style={st.sub}>
        Your books watch arXiv and the news hourly. When the world talks about what you wrote,
        it lands here — with a reply drafted from your own words. Nothing posts without you.
      </Text>
      {alerts.length === 0 && <Text style={st.sub}>Nothing yet — the scout runs hourly.</Text>}
      {alerts.map((a) => (
        <View key={a.id} style={st.card}>
          <Text style={st.book}>
            📖 {a.bookTitle} · match {Math.round(a.score * 100)}% · {a.signal.source}
          </Text>
          <Text style={st.signal} onPress={() => Linking.openURL(a.signal.url)}>
            {a.signal.title}
          </Text>
          <Text style={st.passage}>
            Your words ({a.passage.ref}): “{a.passage.text.slice(0, 140)}…”
          </Text>
          {a.status === 'pending' ? (
            <>
              <TextInput
                style={st.input}
                multiline
                defaultValue={a.suggestedReply}
                onChangeText={(t) => setDrafts((d) => ({ ...d, [a.id]: t }))}
              />
              <Pressable style={st.cta} onPress={() => approve(a)} disabled={busy === a.id}>
                {busy === a.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={st.ctaText}>✓ Approve — render my book's turn & share</Text>
                )}
              </Pressable>
              <Text style={st.via}>drafted via {a.suggestedVia}</Text>
              <Pressable style={st.dismiss} onPress={() => dismiss(a)} disabled={busy === a.id}>
                <Text style={st.dismissText}>✕ Dismiss</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={st.final}>{a.finalReply}</Text>
              {a.turnLiveUrl && (
                <Text style={st.link} onPress={() => Linking.openURL(a.turnLiveUrl!)}>
                  ▶ Watch the rendered turn
                </Text>
              )}
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
  h: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 13, color: '#5d5a72', lineHeight: 19, marginTop: 6, marginBottom: 6 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20, 18, 45, 0.11)',
    padding: 14,
    marginTop: 12,
  },
  book: { fontSize: 12, color: '#5d5a72' },
  signal: { fontSize: 15, fontWeight: '600', color: '#7c3aed', marginTop: 4, lineHeight: 21 },
  passage: { fontSize: 13, color: '#5d5a72', marginTop: 8, fontStyle: 'italic', lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(20, 18, 45, 0.11)',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginTop: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  cta: { backgroundColor: '#7c3aed', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  via: { fontSize: 11, color: '#5d5a72', marginTop: 6 },
  final: { fontSize: 13, color: '#333', marginTop: 8, lineHeight: 19 },
  link: { color: '#7c3aed', fontSize: 14, marginTop: 8, fontWeight: '600' },
  dismiss: { alignSelf: 'flex-start', marginTop: 6 },
  dismissText: { color: '#5d5a72', fontSize: 12 },
});
