// Shared API client — same endpoints the web app uses (server/server.mjs).
// Point EXPO_PUBLIC_API_URL elsewhere to override (defaults to the live tunnel).
const API =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://chance-wood-neighbor-writings.trycloudflare.com';

export interface Book {
  slug: string;
  title: string;
  author: string;
  units: number;
}

export interface Passage {
  ref: string;
  text: string;
  score?: number;
}

export interface AskResult {
  covered: boolean;
  spoken: string;
  passages: Passage[];
}

export interface ReasonResult {
  reasoning: string;
  model: string;
  passages: Passage[];
  references: { title: string; link: string }[];
}

export interface Story {
  title: string;
  link: string;
}

async function json<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const listBooks = () => json<{ books: Book[] }>('/api/books').then((d) => d.books);
export const askBook = (slug: string, question: string) =>
  json<AskResult>(`/api/books/${slug}/ask`, { question });
export const getNews = () => json<{ stories: Story[] }>('/api/news').then((d) => d.stories);
export const reasonNews = (slug: string, story: string) =>
  json<ReasonResult>('/api/news/reason', { slug, story });
