import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  askBook,
  getNews,
  listBooks,
  reasonNews,
  type AskResult,
  type Book,
  type ReasonResult,
  type Story,
} from './src/api';

type Tab = 'ask' | 'news' | 'books';
const PURPLE = '#7c3aed';

export default function App() {
  const [tab, setTab] = useState<Tab>('ask');
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    listBooks().then(setBooks).catch(() => {});
  }, []);

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.logo}>📖 LivingBook</Text>
        <Text style={s.tagline}>Books that talk back.</Text>
      </View>
      <View style={s.body}>
        {tab === 'ask' && <Ask books={books} />}
        {tab === 'news' && <News books={books} />}
        {tab === 'books' && <Books books={books} />}
      </View>
      <View style={s.tabbar}>
        {(['ask', 'news', 'books'] as Tab[]).map((t) => (
          <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'ask' ? '💬 Ask' : t === 'news' ? '📰 News' : '📚 Books'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BookPicker({
  books,
  slug,
  onPick,
}: {
  books: Book[];
  slug: string;
  onPick: (slug: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.picker}>
      {books.map((b) => (
        <Pressable
          key={b.slug}
          style={[s.chip, slug === b.slug && s.chipActive]}
          onPress={() => onPick(b.slug)}
        >
          <Text style={[s.chipText, slug === b.slug && s.chipTextActive]}>
            {b.title.split('(')[0].trim()}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Ask({ books }: { books: Book[] }) {
  const [slug, setSlug] = useState('bible-kjv');
  const [q, setQ] = useState('');
  const [result, setResult] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await askBook(slug, q));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <BookPicker books={books} slug={slug} onPick={setSlug} />
      <TextInput
        style={s.input}
        value={q}
        onChangeText={setQ}
        placeholder="What does this book say about…"
        onSubmitEditing={run}
        returnKeyType="send"
      />
      <Pressable style={s.cta} onPress={run} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Ask</Text>}
      </Pressable>
      {error && <Text style={s.error}>{error}</Text>}
      {result && (
        <View style={s.answer}>
          <Text style={s.spoken}>{result.spoken}</Text>
          {result.passages.map((p) => (
            <Text key={p.ref} style={s.passage}>
              <Text style={s.ref}>{p.ref}</Text> — {p.text}
            </Text>
          ))}
        </View>
      )}
      <Text style={s.note}>
        Every answer is the book's exact words — retrieved verbatim, never invented.
      </Text>
    </ScrollView>
  );
}

function News({ books }: { books: Book[] }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [slug, setSlug] = useState('bible-kjv');
  const [takes, setTakes] = useState<Record<string, ReasonResult | AskResult>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getNews().then(setStories).catch(() => {});
  }, []);

  async function reason(story: Story) {
    setBusy(story.title);
    try {
      const r = await reasonNews(slug, story.title);
      setTakes((t) => ({ ...t, [story.title]: r }));
    } catch {
      const r = await askBook(slug, `What does this book say about: ${story.title}`);
      setTakes((t) => ({ ...t, [story.title]: r }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <FlatList
      data={stories}
      keyExtractor={(x) => x.title}
      ListHeaderComponent={<BookPicker books={books} slug={slug} onPick={setSlug} />}
      contentContainerStyle={s.pad}
      renderItem={({ item }) => {
        const take = takes[item.title];
        return (
          <View style={s.story}>
            <Text style={s.storyTitle}>{item.title}</Text>
            <Pressable style={s.ghost} onPress={() => reason(item)} disabled={busy === item.title}>
              <Text style={s.ghostText}>
                {busy === item.title ? 'Reasoning…' : '💭 What does the book say?'}
              </Text>
            </Pressable>
            {take && 'reasoning' in take && (
              <View style={s.take}>
                <Text style={s.takeText}>{take.reasoning}</Text>
                {take.passages.map((p) => (
                  <Text key={p.ref} style={s.passage}>
                    <Text style={s.ref}>{p.ref}</Text> — “{p.text.slice(0, 200)}…”
                  </Text>
                ))}
                {take.references?.map((r) => (
                  <Text key={r.link} style={s.link} onPress={() => Linking.openURL(r.link)}>
                    🔗 {r.title}
                  </Text>
                ))}
              </View>
            )}
            {take && !('reasoning' in take) && (
              <View style={s.take}>
                <Text style={s.takeText}>{take.spoken}</Text>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

function Books({ books }: { books: Book[] }) {
  const shelf = (filter: (b: Book) => boolean) =>
    books.filter(filter).map((b) => (
      <View key={b.slug} style={s.bookCard}>
        <Text style={s.bookTitle}>{b.title}</Text>
        <Text style={s.bookMeta}>
          {b.author} · {b.units} verbatim units
        </Text>
      </View>
    ));
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.section}>Public Domain shelf</Text>
      {shelf((b) => b.author === 'Public Domain')}
      <Text style={s.section}>Author books</Text>
      {shelf((b) => b.author !== 'Public Domain')}
      <Text style={s.note}>
        Authors: sign in on livingbook.masky.ai to claim books, upload podcasts and Q&A
        transcripts, and record VoiceCert-attested spoken sessions your agent quotes verbatim.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf9fc' },
  header: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 8 },
  logo: { fontSize: 26, fontWeight: '800' },
  tagline: { fontSize: 14, color: '#666', marginTop: 2 },
  body: { flex: 1 },
  pad: { padding: 20, paddingBottom: 40 },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabActive: { borderTopWidth: 2, borderColor: PURPLE },
  tabText: { fontSize: 14, color: '#777' },
  tabTextActive: { color: PURPLE, fontWeight: '700' },
  picker: { flexGrow: 0, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  chipText: { color: '#444', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  cta: {
    backgroundColor: PURPLE,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ghost: {
    borderWidth: 1,
    borderColor: PURPLE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  ghostText: { color: PURPLE, fontSize: 13 },
  answer: { marginTop: 16 },
  spoken: { fontSize: 16, fontStyle: 'italic', lineHeight: 23 },
  passage: { fontSize: 13, color: '#555', marginTop: 10, lineHeight: 19 },
  ref: { fontWeight: '700', color: '#333' },
  error: { color: '#dc2626', marginTop: 10 },
  note: { fontSize: 12, color: '#999', marginTop: 24, lineHeight: 17 },
  story: { borderTopWidth: 1, borderColor: '#eee', paddingVertical: 12 },
  storyTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  take: {
    borderLeftWidth: 3,
    borderColor: PURPLE,
    backgroundColor: '#7c3aed11',
    padding: 10,
    marginTop: 8,
    borderRadius: 6,
  },
  takeText: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  link: { color: PURPLE, fontSize: 13, marginTop: 8 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  bookCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  bookTitle: { fontSize: 16, fontWeight: '600' },
  bookMeta: { fontSize: 12, color: '#888', marginTop: 3 },
});
