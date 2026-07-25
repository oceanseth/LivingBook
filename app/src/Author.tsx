import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { base } from './api';

const MASKY = 'https://masky.ai/api';


interface Session {
  accessToken: string;
  user: { sub: string; name: string; picture?: string };
}

interface MaskyAvatar {
  avatarId: string;
  avatarOwnerUserId: string;
  displayName: string;
  avatarImageUrl?: string;
  imageUrl?: string;
}

// The full author flow on mobile: pair with your web session, pick which of
// your Masky avatars IS the author, upload the book PDF, then ask it a
// question and watch the author answer on video (rendered on your credits).
export default function Author({ onBookCreated }: { onBookCreated: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [code, setCode] = useState('');
  const [avatars, setAvatars] = useState<MaskyAvatar[]>([]);
  const [avatar, setAvatar] = useState<MaskyAvatar | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function api<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${await base()}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    return data as T;
  }

  async function claim() {
    setBusy(true);
    setStatus('');
    try {
      const res = await fetch(`${await base()}/api/pair/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSession(data);
      setStatus(`Signed in as ${data.user.name}. Loading your avatars…`);
      const av = await fetch(`${MASKY}/avatars`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      }).then((r) => r.json());
      setAvatars(av.avatars ?? []);
      setStatus(`Signed in as ${data.user.name}. Pick the avatar who IS this author.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createBook() {
    setBusy(true);
    setStatus('Creating book…');
    try {
      const d = await api<{ book: { slug: string } }>('/api/books', {
        title,
        avatarId: avatar?.avatarId,
        avatarOwnerUserId: avatar?.avatarOwnerUserId,
        authorName: avatar?.displayName,
      });
      setSlug(d.book.slug);
      setStatus(`Book created. Now upload its PDF.`);
      onBookCreated();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPdf() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    setBusy(true);
    setStatus('Extracting and ingesting the PDF…');
    try {
      const asset = picked.assets[0];
      const pdfBase64 = await new File(asset.uri).base64();
      const d = await api<{ unitsAdded: number; totalUnits: number }>(
        `/api/books/${slug}/content`,
        { title: asset.name, sourceType: 'book', pdfBase64 },
      );
      setStatus(`✓ Ingested ${d.unitsAdded} verbatim units. Ask the author something!`);
      onBookCreated();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function askOnVideo() {
    setBusy(true);
    setStatus('Retrieving the exact passage and rendering your author…');
    try {
      const d = await api<{ spoken: string; conversation: { liveUrl: string } }>('/api/render', {
        slug,
        question,
        output: 'video',
      });
      setStatus(`“${d.spoken.slice(0, 120)}…” — opening the video player.`);
      Linking.openURL(d.conversation.liveUrl);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={a.pad} keyboardShouldPersistTaps="handled">
      <Text style={a.h}>Author studio</Text>
      {!session && (
        <>
          <Text style={a.sub}>
            1. On livingbook.masky.ai, sign in with Masky → Books → “📱 Connect mobile app”.
            {'\n'}2. Enter the 6-character code here.
          </Text>
          <TextInput
            style={a.input}
            value={code}
            onChangeText={setCode}
            placeholder="PAIRING CODE"
            autoCapitalize="characters"
          />
          <Pressable style={a.cta} onPress={claim} disabled={busy || code.trim().length < 6}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={a.ctaText}>Sign in</Text>}
          </Pressable>
        </>
      )}
      {session && !slug && (
        <>
          <Text style={a.step}>① Pick the avatar who is the author</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={a.row}>
            {avatars.map((av) => (
              <Pressable
                key={av.avatarId}
                style={[a.avatarCard, avatar?.avatarId === av.avatarId && a.avatarSel]}
                onPress={() => setAvatar(av)}
              >
                {(av.avatarImageUrl ?? av.imageUrl) && (
                  <Image source={{ uri: av.avatarImageUrl ?? av.imageUrl }} style={a.avatarImg} />
                )}
                <Text style={a.avatarName} numberOfLines={1}>
                  {av.displayName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={a.step}>② Name the book</Text>
          <TextInput style={a.input} value={title} onChangeText={setTitle} placeholder="Book title" />
          <Pressable style={a.cta} onPress={createBook} disabled={busy || !avatar || !title.trim()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={a.ctaText}>Create book</Text>}
          </Pressable>
        </>
      )}
      {session && slug && (
        <>
          <Text style={a.step}>③ Upload the book PDF</Text>
          <Pressable style={a.cta} onPress={uploadPdf} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={a.ctaText}>📄 Pick a PDF</Text>}
          </Pressable>
          <Text style={a.step}>④ Ask — the author answers on video</Text>
          <TextInput
            style={a.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask the book anything…"
          />
          <Pressable style={a.cta} onPress={askOnVideo} disabled={busy || !question.trim()}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={a.ctaText}>🎬 Author answers (your credits)</Text>
            )}
          </Pressable>
        </>
      )}
      {status ? <Text style={a.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const a = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
  h: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 13, color: '#5d5a72', lineHeight: 19, marginBottom: 10 },
  step: { fontSize: 15, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  row: { flexGrow: 0 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(20, 18, 45, 0.11)',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    marginTop: 4,
  },
  cta: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  ctaText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  avatarCard: {
    width: 92,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'rgba(20, 18, 45, 0.11)',
    borderRadius: 14,
    padding: 6,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  avatarSel: { borderColor: '#7c3aed' },
  avatarImg: { width: 72, height: 72, borderRadius: 8 },
  avatarName: { fontSize: 11, marginTop: 4 },
  status: { marginTop: 14, fontSize: 13, color: '#5d5a72', lineHeight: 19 },
});
