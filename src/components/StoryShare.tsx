import React, { useEffect, useId, useRef, useState } from 'react';
import { useStory } from '../context/StoryContext';
import { StoryItem } from '../types';

export interface StoryShareProps {
  story: StoryItem;
  userName?: string;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Accessible share sheet with a reliable copy-link fallback. Requires StoryProvider. */
export const StoryShare: React.FC<StoryShareProps> = ({ story, userName, onClose, returnFocusRef }) => {
  const { pause, resume, playbackKey } = useStory();
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef(0);
  const busyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  let url = '';
  try {
    const parsed = new URL(story.share?.url ?? story.url, typeof document !== 'undefined' ? document.baseURI : undefined);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') url = parsed.href;
  } catch { /* Invalid links remain visible as an actionable unavailable state. */ }
  const data: ShareData = {
    url,
    title: story.share?.title ?? (userName ? `${userName}'s story` : 'Story'),
    text: story.share?.text ?? story.altText,
  };
  const nativeAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    const reason = `share:${story.id}:${playbackKey}`;
    const previousFocus = returnFocusRef?.current ?? document.activeElement as HTMLElement | null;
    pause(reason);
    sheetRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !focusable.includes(document.activeElement as HTMLElement);
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus, true);
    return () => {
      document.removeEventListener('keydown', trapFocus, true);
      versionRef.current += 1;
      resume(reason);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [pause, resume, story.id, playbackKey, returnFocusRef]);

  const copyLink = async () => {
    if (busyRef.current || !url) return;
    const version = versionRef.current;
    busyRef.current = true;
    setBusy(true);
    setStatus('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (version === versionRef.current) setStatus('Link copied');
    } catch {
      if (version !== versionRef.current) return;
      linkRef.current?.focus();
      linkRef.current?.select();
      setStatus('Could not copy automatically. Select the link above and copy it.');
    } finally {
      if (version === versionRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const shareNative = async () => {
    if (busyRef.current || !url) return;
    const version = versionRef.current;
    busyRef.current = true;
    setBusy(true);
    setStatus('');
    try {
      // Invoke directly from the click to preserve the browser's user activation.
      await navigator.share(data);
      if (version === versionRef.current) onClose();
    } catch (error) {
      if (version === versionRef.current && !(typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'))
        setStatus('Device sharing is unavailable. You can copy the link instead.');
    } finally {
      if (version === versionRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const buttonStyle: React.CSSProperties = {
    minHeight: 44, minWidth: 44, border: 0, borderRadius: 12, padding: '10px 16px',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  };

  return <div
    role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
    data-storykit-share-dialog="true" data-interactive="true"
    style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
    onPointerDown={event => event.stopPropagation()}
    onPointerUp={event => event.stopPropagation()}
    onPointerCancel={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => event.stopPropagation()}
  >
    <div ref={sheetRef} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '16px 20px max(24px, env(safe-area-inset-bottom))', borderRadius: '20px 20px 0 0', background: '#111827', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxShadow: '0 -8px 32px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Share story</h2>
        <button type="button" aria-label="Close sharing" onClick={onClose} style={{ ...buttonStyle, padding: 0, background: 'transparent', color: '#fff', fontSize: 24 }}>×</button>
      </div>
      <p id={descriptionId} style={{ color: '#cbd5e1', fontSize: 14, margin: '8px 0 16px' }}>Send this story to someone or copy its link.</p>
      {url ? <>
        <input ref={linkRef} aria-label="Story link" value={url} readOnly onFocus={event => event.currentTarget.select()}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid #64748b', borderRadius: 12, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', color: '#e2e8f0', background: '#1e293b' }} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => void copyLink()} disabled={busy} style={{ ...buttonStyle, flex: 1, background: '#fff', color: '#111827' }}>Copy link</button>
          {nativeAvailable && <button type="button" onClick={() => void shareNative()} disabled={busy} style={{ ...buttonStyle, flex: 1, background: '#334155', color: '#fff' }}>Share via device</button>}
        </div>
      </> : <p style={{ color: '#e2e8f0', fontSize: 14 }}>This story does not have a shareable link.</p>}
      <p role="status" style={{ margin: status ? '12px 0 0' : 0, color: '#e2e8f0', fontSize: 14 }}>{status}</p>
    </div>
  </div>;
};
