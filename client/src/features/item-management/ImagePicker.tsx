import { useEffect, useMemo, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { ALLOWED_IMAGE_TYPES, LIMITS } from '@borrowbox/shared';
import { Button } from '@/components/ui/Button';

export interface ExistingImage { id: string; url: string; altText: string }

interface Props {
  existing: ExistingImage[];
  files: File[];
  onFiles: (f: File[]) => void;
  onRemoveExisting: (img: ExistingImage) => void;
  removing?: string | null;
  error?: string | null;
  onError: (m: string | null) => void;
}

export function ImagePicker({ existing, files, onFiles, onRemoveExisting, removing, error, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const total = existing.length + files.length;

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = [...list];
    const bad = incoming.find((f) => !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type));
    if (bad) return onError(`"${bad.name}" isn't a supported image. Use JPEG, PNG or WebP.`);
    const big = incoming.find((f) => f.size > LIMITS.MAX_IMAGE_BYTES);
    if (big) return onError(`"${big.name}" is larger than ${LIMITS.MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
    if (total + incoming.length > LIMITS.MAX_IMAGES) return onError(`You can add up to ${LIMITS.MAX_IMAGES} photos.`);
    onError(null);
    onFiles([...files, ...incoming]);
    if (input.current) input.current.value = '';
  };

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Photos <span className="font-normal text-charcoal-70">({total}/{LIMITS.MAX_IMAGES})</span></legend>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {existing.map((img) => (
          <li key={img.id} className="relative overflow-hidden rounded-xl border border-blush">
            <img src={img.url} alt={img.altText} className="aspect-[4/3] w-full object-cover" />
            <button type="button" disabled={removing === img.id} onClick={() => onRemoveExisting(img)} aria-label={`Remove photo ${img.altText}`} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow-card hover:bg-white disabled:opacity-50"><X className="h-4 w-4" aria-hidden /></button>
          </li>
        ))}
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="relative overflow-hidden rounded-xl border border-dashed border-mist">
            <img src={previews[i]} alt={`Preview of ${f.name}`} className="aspect-[4/3] w-full object-cover" />
            <span className="absolute bottom-1.5 left-1.5 rounded bg-charcoal/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">New</span>
            <button type="button" onClick={() => onFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow-card hover:bg-white"><X className="h-4 w-4" aria-hidden /></button>
          </li>
        ))}
        {total < LIMITS.MAX_IMAGES && (
          <li>
            <button type="button" onClick={() => input.current?.click()} className="grid aspect-[4/3] w-full place-items-center rounded-xl border-2 border-dashed border-blush text-sm text-charcoal-70 hover:border-burgundy/40 hover:bg-blush/30">
              <span className="flex flex-col items-center gap-1"><ImagePlus className="h-6 w-6" aria-hidden />Add photos</span>
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} multiple className="sr-only" aria-label="Choose photos" onChange={(e) => add(e.target.files)} />
      {error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{error}</p>}
      <p className="mt-2 text-xs text-charcoal-70">JPEG, PNG or WebP, up to {LIMITS.MAX_IMAGE_BYTES / 1024 / 1024} MB each. The first photo is the cover.</p>
      {files.length > 0 && <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => onFiles([])}>Clear new photos</Button>}
    </fieldset>
  );
}
