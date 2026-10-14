import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadImage, errorMessage } from '@/lib/api';

export default function ImageUploader({ value, onChange, max = 5, error }) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(0);

  const pick = async (files) => {
    const list = Array.from(files || []).slice(0, max - value.length);
    if (!list.length) return;
    const bad = list.find((f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
    if (bad) return toast.error('Use JPG, PNG or WebP photos');
    const huge = list.find((f) => f.size > 15 * 1024 * 1024);
    if (huge) return toast.error('Each photo must be under 15 MB');
    setUploading(list.length);
    const urls = [];
    for (const f of list) {
      try {
        urls.push(await uploadImage(f));
      } catch (err) {
        toast.error(errorMessage(err, 'Upload failed'));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onChange([...value, ...urls]);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {value.map((src, i) => (
          <div key={src} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-sand">
            <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="badge absolute left-1.5 top-1.5 bg-surface/95 text-ink"><Star className="h-3 w-3" /> Cover</span>}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
              {i > 0 ? (
                <button type="button" className="rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold" onClick={() => onChange([src, ...value.filter((v) => v !== src)])}>Make cover</button>
              ) : <span />}
              <button type="button" aria-label="Remove photo" className="grid h-6 w-6 place-items-center rounded-full bg-surface/95" onClick={() => onChange(value.filter((v) => v !== src))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="grid aspect-[4/5] place-items-center rounded-xl bg-sand"><Loader2 className="h-5 w-5 animate-spin text-moss" /></div>
        ))}
        {value.length + uploading < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files);
            }}
            className={`flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-medium text-muted transition hover:border-moss hover:text-moss ${error ? 'border-red-300' : 'border-line'}`}
          >
            <ImagePlus className="h-6 w-6" />
            Add photo
            <span className="text-[10px] font-normal">{value.length}/{max}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      {error ? <p className="error-text">{error}</p> : <p className="help">Natural light, front + back + label + any flaws. Photos are compressed automatically.</p>}
    </div>
  );
}
