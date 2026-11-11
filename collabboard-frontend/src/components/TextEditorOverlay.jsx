import { useEffect, useRef } from 'react';
import {
  BOARD_FONT, TEXT_LINE_HEIGHT, textMetrics,
  STICKY_HEIGHT, STICKY_TEXT_COLOR,
} from '../utils/textConfig.js';
import { BoardLimits } from '../utils/boardOps.js';

// A blur this soon after opening is the click that opened the editor settling,
// not the person clicking away.
const SPURIOUS_BLUR_MS = 250;

/**
 * The HTML textarea shown on top of the canvas while a text label or sticky
 * note is being edited. It is positioned and sized from the same metrics the
 * canvas renders with, so the text does not jump when editing ends.
 */
export default function TextEditorOverlay({
  editor, fallbackFontSize, stageScale, stagePos, onChange, onCommit, onCancel,
}) {
  const textareaRef = useRef(null);
  const openedAt = useRef(Date.now());
  const metrics = textMetrics(editor.isSticky);
  const size = editor.fontSize || fallbackFontSize;

  // Focus after the browser has finished the click that opened the editor,
  // otherwise the focus is immediately stolen back by the canvas.
  useEffect(() => {
    openedAt.current = Date.now();
    const raf = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(raf);
  }, [editor.id, editor.x, editor.y]);

  // Grow a plain text box downwards as lines are added, so the editor always
  // shows exactly as much as the canvas will render.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || editor.isSticky) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [editor.value, editor.fontSize, editor.isSticky, stageScale]);

  const handleBlur = () => {
    if (Date.now() - openedAt.current < SPURIOUS_BLUR_MS) {
      requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
      return;
    }
    onCommit();
  };

  // Enter makes a new line. Escape, Ctrl/Cmd+Enter or clicking away finishes
  // editing — the same convention Excalidraw uses.
  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onCommit(); }
  };

  const textColor = editor.isSticky ? STICKY_TEXT_COLOR : editor.color;
  // A text label's (x, y) is where its glyphs start, so the box is pulled back
  // by its padding. A note's (x, y) is the note's own corner, so the box goes
  // exactly on top of it.
  const inset = editor.isSticky ? 0 : metrics.padding;

  return (
    <textarea
      ref={textareaRef}
      value={editor.value}
      aria-label={editor.isSticky ? 'Sticky note text' : 'Text'}
      maxLength={BoardLimits.MAX_TEXT_LENGTH}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onWheel={(e) => e.stopPropagation()}
      spellCheck={false}
      className="absolute z-30 outline-none resize-none overflow-hidden"
      style={{
        left: (editor.x - inset) * stageScale + stagePos.x,
        top: (editor.y - inset) * stageScale + stagePos.y,
        // A note that has been resized is edited at its own size.
        width: (editor.isSticky && editor.width ? editor.width : metrics.width) * stageScale,
        minHeight: (size * TEXT_LINE_HEIGHT + metrics.padding * 2) * stageScale,
        height: editor.isSticky ? (editor.height || STICKY_HEIGHT) * stageScale : 'auto',
        padding: metrics.padding * stageScale,
        color: textColor,
        background: editor.isSticky ? editor.fillColor : 'transparent',
        caretColor: textColor,
        fontFamily: BOARD_FONT,
        fontSize: size * stageScale,
        fontWeight: editor.fontStyle.includes('bold') ? 'bold' : 'normal',
        fontStyle: editor.fontStyle.includes('italic') ? 'italic' : 'normal',
        lineHeight: TEXT_LINE_HEIGHT,
        border: editor.isSticky ? 'none' : '1px dashed rgba(129,140,248,.9)',
        boxShadow: editor.isSticky ? '0 0 0 2px rgba(129,140,248,.9)' : 'none',
        borderRadius: editor.isSticky ? 10 : 4,
        boxSizing: 'border-box',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      placeholder="Type…  (Esc or click away when done)"
    />
  );
}
