import { useState } from 'react';
import type { MaskySession } from './lib/masky';

// Styled popup: choose which image of the selected avatar represents a book.
// The set starts with the avatar's canonical image; "Generate variant" grows it
// via Masky /images/edit on the USER's credits. Save commits avatar + image.
export interface PickedAvatar {
  avatarId: string;
  avatarOwnerUserId: string;
  displayName: string;
  imageUrl: string;
}

export default function AvatarModal({
  session,
  avatar,
  bookTitle,
  onSave,
  onClose,
  saving,
}: {
  session: MaskySession;
  avatar: PickedAvatar;
  bookTitle: string;
  onSave: (imageUrl: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [images, setImages] = useState<string[]>([avatar.imageUrl]);
  const [selected, setSelected] = useState<string>(avatar.imageUrl);
  const [variantPrompt, setVariantPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateVariant() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('https://masky.ai/api/images/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          prompt: variantPrompt.trim() || 'A refined portrait variant, same person, warm light',
          imageUrl: avatar.imageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setImages((im) => [...im, data.imageUrl]);
      setSelected(data.imageUrl);
      setVariantPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {avatar.displayName} → <em>{bookTitle}</em>
          </h3>
          <button className="ghost small" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="sub">Choose the image that will represent this book.</p>
        <div className="modal-images">
          {images.map((url) => (
            <button
              key={url}
              className={selected === url ? 'imgpick selected' : 'imgpick'}
              onClick={() => setSelected(url)}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
        <div className="askrow">
          <input
            value={variantPrompt}
            onChange={(e) => setVariantPrompt(e.target.value)}
            placeholder="Describe a variant (e.g. 'holding the book, library behind')"
          />
          <button className="ghost" disabled={generating} onClick={generateVariant}>
            {generating ? 'Generating…' : '✨ Generate variant'}
          </button>
        </div>
        <p className="notice">
          Variants render on your Masky credits. The talking-head video always uses the
          avatar&rsquo;s canonical Masky image; this choice sets the book&rsquo;s face on LivingBook.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="cta" disabled={saving} onClick={() => onSave(selected)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
