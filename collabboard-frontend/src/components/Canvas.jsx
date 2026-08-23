import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Arrow, Path, Transformer } from 'react-konva';
import ShapeNode from './ShapeNode.jsx';
import LiveCursors from './LiveCursors.jsx';
import Minimap from './Minimap.jsx';
import GridLayer from './GridLayer.jsx';
import SelectionToolbar from './SelectionToolbar.jsx';
import { generateId, snap, freehandPath } from '../utils/drawingUtils.js';
import {
  BOARD_FONT, TEXT_LINE_HEIGHT, textMetrics,
  STICKY_WIDTH, STICKY_HEIGHT, STICKY_FONT_SIZE, STICKY_TEXT_COLOR,
} from '../utils/textConfig.js';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

function getViewSize() {
  return { width: window.innerWidth, height: window.innerHeight - 56 };
}

function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

const Canvas = forwardRef(function Canvas(props, ref) {
  const {
    shapes, tool, strokeColor, fillColor, strokeWidth, fontSize, fontStyle,
    stickyColor, selectedEmoji, identity, gridVisible, snapEnabled, backgroundColor,
    cursors, remoteLasers, addShape, updateShape, deleteShapes,
    onCursorMove, onLaser, onZoomChange,
  } = props;

  const [view, setView] = useState(getViewSize);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const [selectedIds, setSelectedIds] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [preview, setPreview] = useState(null);
  const [arrowStart, setArrowStart] = useState(null);
  const [arrowEnd, setArrowEnd] = useState(null);
  const [textEditor, setTextEditor] = useState(null);
  const [localLasers, setLocalLasers] = useState([]);
  const [selBox, setSelBox] = useState(null);

  const stageRef = useRef(null);
  const trRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const isDrawing = useRef(false);
  const startPoint = useRef(null);
  const panning = useRef(false);
  const panStart = useRef(null);
  const spaceHeld = useRef(false);
  const textareaRef = useRef(null);
  const openedAt = useRef(0);

  const registerRef = (id, node) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  };

  useEffect(() => {
    const onResize = () => setView(getViewSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const down = (e) => { if (e.code === 'Space' && !isEditableTarget(e.target)) spaceHeld.current = true; };
    const up = (e) => { if (e.code === 'Space') spaceHeld.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => { if (onZoomChange) onZoomChange(stageScale); }, [stageScale, onZoomChange]);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const nodes = selectedIds.map((id) => nodeRefs.current.get(id)).filter(Boolean);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
    if (nodes.length > 0) {
      const stage = stageRef.current;
      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      nodes.forEach((n) => {
        const r = n.getClientRect({ relativeTo: stage });
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
      });
      setSelBox({ x: (minX + maxX) / 2, y: minY });
    } else {
      setSelBox(null);
    }
  }, [selectedIds, shapes, stageScale, stagePos]);

  useEffect(() => {
    if (localLasers.length === 0) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setLocalLasers((prev) => prev.filter((l) => now - l.ts < 3000));
    }, 500);
    return () => clearInterval(timer);
  }, [localLasers.length]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => applyZoom(stageScale * 1.2),
    zoomOut: () => applyZoom(stageScale / 1.2),
    resetZoom: () => { setStageScale(1); setStagePos({ x: 0, y: 0 }); },
    // Note: no `tool === 'select'` guard here. Ctrl+A switches the tool and
    // calls selectAll in the same tick, so `tool` would still hold the old
    // value and the selection would be silently dropped.
    selectAll: () => setSelectedIds(shapes.map((s) => s.id)),
    deselect: () => setSelectedIds([]),
    deleteSelection: () => removeSelected(),
    exportImage: (mimeType = 'image/png') => exportImage(mimeType),
    copyImage: () => copyImage(),
  }));

  const applyZoom = (next, center) => {
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    const c = center || { x: view.width / 2, y: view.height / 2 };
    const worldX = (c.x - stagePos.x) / stageScale;
    const worldY = (c.y - stagePos.y) / stageScale;
    setStageScale(newScale);
    setStagePos({ x: c.x - worldX * newScale, y: c.y - worldY * newScale });
  };

  const worldPointer = () => {
    const stage = stageRef.current;
    return stage ? stage.getRelativePointerPosition() : null;
  };

  const snapW = (v) => snap(v, snapEnabled);

  const handlePointerDown = (e) => {
    const stage = e.target.getStage();
    const isMiddle = e.evt && e.evt.button === 1;
    if (spaceHeld.current || isMiddle) {
      panning.current = true;
      panStart.current = { pointer: stage.getPointerPosition(), pos: { ...stagePos } };
      return;
    }

    // A click anywhere on the board finishes an open text edit first. The text
    // tool suppresses the default mousedown behaviour (see below), which also
    // suppresses the textarea's blur — so without this the pending text would
    // be silently dropped when starting the next one.
    if (textEditor) {
      commitText();
      return;
    }

    const p = worldPointer();
    if (!p) return;
    const sx = snapW(p.x);
    const sy = snapW(p.y);

    if (tool === 'select') {
      if (e.target === stage) setSelectedIds([]);
      return;
    }

    if (tool === 'pen' || tool === 'highlighter' || tool === 'laser') {
      isDrawing.current = true;
      setCurrentStroke({
        points: [p.x, p.y],
        tool: tool === 'laser' ? 'laser' : tool,
        color: tool === 'laser' ? '#ff3b3b' : strokeColor,
        strokeWidth: tool === 'laser' ? 4 : strokeWidth,
      });
      return;
    }

    if (tool === 'rectangle' || tool === 'circle' || tool === 'diamond' || tool === 'triangle') {
      isDrawing.current = true;
      startPoint.current = { x: sx, y: sy };
      setPreview({ tool, x: sx, y: sy, width: 0, height: 0 });
      return;
    }

    if (tool === 'arrow') {
      if (!arrowStart) {
        setArrowStart({ x: sx, y: sy });
        setArrowEnd({ x: sx, y: sy });
      } else {
        addShape({
          id: generateId(), tool: 'arrow',
          points: [arrowStart.x, arrowStart.y, sx, sy],
          x: 0, y: 0, color: strokeColor, strokeWidth, userId: identity.userId,
        });
        setArrowStart(null);
        setArrowEnd(null);
      }
      return;
    }

    if (tool === 'text') {
      // Without this, the browser's default mousedown focus handling moves
      // focus to the stage canvas right after the textarea mounts. That fires
      // onBlur, which commits an empty string and closes the editor again —
      // so the box appears to flash and nothing can be typed.
      if (e.evt && e.evt.preventDefault) e.evt.preventDefault();
      openTextEditor({ x: sx, y: sy, isSticky: false });
      return;
    }

    if (tool === 'stickyNote') {
      if (e.evt && e.evt.preventDefault) e.evt.preventDefault();
      const shape = {
        id: generateId(), tool: 'stickyNote', x: sx, y: sy,
        width: STICKY_WIDTH, height: STICKY_HEIGHT, fillColor: stickyColor,
        text: '', fontSize: STICKY_FONT_SIZE, userId: identity.userId,
      };
      addShape(shape);
      openTextEditor({
        id: shape.id, x: sx, y: sy, isSticky: true, value: '',
        fontSize: STICKY_FONT_SIZE, color: STICKY_TEXT_COLOR, fontStyle: 'normal',
        fillColor: stickyColor,
      });
      return;
    }

    if (tool === 'emoji') {
      addShape({
        id: generateId(), tool: 'emoji', x: sx, y: sy,
        text: selectedEmoji || '⭐', fontSize: 32, userId: identity.userId,
      });
    }
  };

  const handlePointerMove = (e) => {
    const stage = e.target.getStage();
    if (panning.current && panStart.current) {
      const pointer = stage.getPointerPosition();
      const dx = pointer.x - panStart.current.pointer.x;
      const dy = pointer.y - panStart.current.pointer.y;
      setStagePos({ x: panStart.current.pos.x + dx, y: panStart.current.pos.y + dy });
      return;
    }

    const p = worldPointer();
    if (!p) return;
    if (onCursorMove) onCursorMove(p.x, p.y);

    if (tool === 'arrow' && arrowStart) {
      setArrowEnd({ x: snapW(p.x), y: snapW(p.y) });
      return;
    }

    if (!isDrawing.current) return;

    if (currentStroke) {
      setCurrentStroke((prev) => (prev ? { ...prev, points: [...prev.points, p.x, p.y] } : prev));
    } else if (preview && startPoint.current) {
      const sx = startPoint.current.x;
      const sy = startPoint.current.y;
      const ex = snapW(p.x);
      const ey = snapW(p.y);
      setPreview({
        tool: preview.tool,
        x: Math.min(sx, ex),
        y: Math.min(sy, ey),
        width: Math.abs(ex - sx),
        height: Math.abs(ey - sy),
      });
    }
  };

  const handlePointerUp = () => {
    if (panning.current) { panning.current = false; panStart.current = null; return; }
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentStroke) {
      const pts = currentStroke.points;
      if (currentStroke.tool === 'laser') {
        if (pts.length >= 2) {
          setLocalLasers((prev) => [...prev, { id: generateId(), points: pts, color: currentStroke.color, ts: Date.now() }]);
          if (onLaser) onLaser(pts);
        }
      } else if (pts.length >= 2) {
        addShape({
          id: generateId(), tool: currentStroke.tool, points: pts, x: 0, y: 0,
          color: currentStroke.color, strokeWidth: currentStroke.strokeWidth,
          opacity: currentStroke.tool === 'highlighter' ? 0.4 : 1, userId: identity.userId,
        });
      }
      setCurrentStroke(null);
      return;
    }

    if (preview) {
      if (preview.width > 3 && preview.height > 3) {
        addShape({
          id: generateId(), tool: preview.tool, x: preview.x, y: preview.y,
          width: preview.width, height: preview.height,
          color: strokeColor, fillColor, strokeWidth, userId: identity.userId,
        });
      }
      setPreview(null);
      startPoint.current = null;
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const factor = 1.1;
    const next = e.evt.deltaY > 0 ? stageScale / factor : stageScale * factor;
    applyZoom(next, pointer);
  };

  const handleSelectShape = (id, shiftKey) => {
    setSelectedIds((prev) => {
      if (shiftKey) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return [id];
    });
  };

  const removeSelected = () => {
    if (selectedIds.length === 0) return;
    deleteShapes(selectedIds);
    setSelectedIds([]);
  };

  const applyToSelection = (patch) => {
    selectedIds.forEach((id) => {
      const shape = shapes.find((s) => s.id === id);
      if (shape) updateShape({ ...shape, ...patch });
    });
  };

  const openTextEditor = (opts) => {
    openedAt.current = Date.now();
    setTextEditor({
      id: opts.id || null, x: opts.x, y: opts.y, value: opts.value || '',
      isSticky: opts.isSticky || false,
      fontSize: opts.fontSize || fontSize,
      // An existing shape keeps its own styling while being edited; a brand new
      // one picks up whatever the toolbar currently has selected.
      color: opts.color || strokeColor,
      fontStyle: opts.fontStyle || fontStyle,
      fillColor: opts.fillColor || stickyColor,
    });
  };

  const editExistingText = (shape) => {
    setSelectedIds([]);
    const isSticky = shape.tool === 'stickyNote';
    openTextEditor({
      id: shape.id, x: shape.x, y: shape.y, value: shape.text || '',
      isSticky,
      fontSize: shape.fontSize || (isSticky ? STICKY_FONT_SIZE : fontSize),
      color: isSticky ? STICKY_TEXT_COLOR : (shape.color || strokeColor),
      fontStyle: shape.fontStyle || 'normal',
      // Show the note being edited in its own colour, not the toolbar's.
      fillColor: shape.fillColor || stickyColor,
    });
  };

  // Focus after the browser has finished the click that opened the editor,
  // otherwise the focus is immediately stolen back by the canvas.
  useEffect(() => {
    if (!textEditor) return undefined;
    const raf = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(raf);
  }, [textEditor?.id, textEditor?.x, textEditor?.y]);

  // Grow a plain text box downwards as lines are added, so the editor always
  // shows exactly as much as the canvas will render.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !textEditor || textEditor.isSticky) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [textEditor?.value, textEditor?.fontSize, stageScale, textEditor?.isSticky]);

  const commitText = () => {
    if (!textEditor) return;
    const value = textEditor.value;
    const existing = textEditor.id ? shapes.find((s) => s.id === textEditor.id) : null;
    if (existing) {
      const emptied = value.trim() === '';
      // An empty sticky is still a useful object; an empty text label is not.
      if (emptied && existing.tool === 'text') {
        deleteShapes([existing.id]);
      } else {
        updateShape({
          ...existing,
          text: value,
          fontSize: textEditor.fontSize,
          ...(existing.tool === 'text'
            ? { color: textEditor.color, fontStyle: textEditor.fontStyle }
            : {}),
        });
      }
    } else if (value.trim() !== '') {
      addShape({
        id: generateId(), tool: 'text', x: textEditor.x, y: textEditor.y, text: value,
        color: textEditor.color, fontSize: textEditor.fontSize,
        fontStyle: textEditor.fontStyle, userId: identity.userId,
      });
    }
    setTextEditor(null);
  };

  const cancelText = () => {
    // Discard an unsaved new shape entirely; leave existing shapes as they were.
    if (textEditor && !textEditor.id) setTextEditor(null);
    else commitText();
  };

  const exportImage = (mimeType) => {
    const stage = stageRef.current;
    if (!stage) return null;
    setSelectedIds([]);
    const uri = stage.toDataURL({ pixelRatio: 2, mimeType });
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const link = document.createElement('a');
    link.download = `collabboard.${ext}`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return uri;
  };

  const copyImage = async () => {
    const stage = stageRef.current;
    if (!stage || !navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
    setSelectedIds([]);
    return new Promise((resolve) => {
      stage.toCanvas({ pixelRatio: 2 }).toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          resolve(true);
        } catch {
          resolve(false);
        }
      });
    });
  };

  const worldLeft = -stagePos.x / stageScale;
  const worldTop = -stagePos.y / stageScale;
  const visW = view.width / stageScale;
  const visH = view.height / stageScale;

  const selectable = tool === 'select';
  const cursorStyle = panning.current ? 'grabbing' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div className="relative flex-1 overflow-hidden h-full" style={{ background: backgroundColor }}>
      <Stage
        ref={stageRef}
        width={view.width}
        height={view.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onWheel={handleWheel}
        style={{ cursor: cursorStyle }}
      >
        <Layer listening={false}>
          <Rect x={worldLeft} y={worldTop} width={visW} height={visH} fill={backgroundColor} />
        </Layer>

        {gridVisible && (
          <GridLayer stagePos={stagePos} stageScale={stageScale} width={view.width} height={view.height} />
        )}

        <Layer>
          {shapes.map((shape) => (
            <ShapeNode
              key={shape.id}
              shape={shape}
              clickMode={tool === 'select' ? 'select' : tool === 'eraser' ? 'erase' : null}
              onSelect={handleSelectShape}
              onErase={(id) => deleteShapes([id])}
              onChange={updateShape}
              onEditText={editExistingText}
              registerRef={registerRef}
            />
          ))}

          {currentStroke && (
            <Path
              data={freehandPath(currentStroke.points, currentStroke.tool === 'laser' ? 'pen' : currentStroke.tool, currentStroke.strokeWidth)}
              fill={currentStroke.color}
              opacity={currentStroke.tool === 'highlighter' ? 0.4 : 1}
              listening={false}
            />
          )}

          {localLasers.map((l) => (
            <Path key={l.id} data={freehandPath(l.points, 'pen', 4)} fill={l.color} opacity={0.8} listening={false} />
          ))}
          {Object.entries(remoteLasers || {}).map(([uid, l]) => (
            <Path key={uid} data={freehandPath(l.points, 'pen', 4)} fill={l.color || '#ff3b3b'} opacity={0.8} listening={false} />
          ))}

          {preview && preview.tool === 'rectangle' && (
            <Rect x={preview.x} y={preview.y} width={preview.width} height={preview.height} stroke={strokeColor} strokeWidth={strokeWidth} dash={[6, 4]} />
          )}
          {preview && preview.tool === 'circle' && (
            <Ellipse x={preview.x + preview.width / 2} y={preview.y + preview.height / 2} radiusX={preview.width / 2} radiusY={preview.height / 2} stroke={strokeColor} strokeWidth={strokeWidth} dash={[6, 4]} />
          )}
          {preview && preview.tool === 'diamond' && (
            <Line x={preview.x} y={preview.y} points={[preview.width / 2, 0, preview.width, preview.height / 2, preview.width / 2, preview.height, 0, preview.height / 2]} closed stroke={strokeColor} strokeWidth={strokeWidth} dash={[6, 4]} />
          )}
          {preview && preview.tool === 'triangle' && (
            <Line x={preview.x} y={preview.y} points={[preview.width / 2, 0, preview.width, preview.height, 0, preview.height]} closed stroke={strokeColor} strokeWidth={strokeWidth} dash={[6, 4]} />
          )}

          {arrowStart && arrowEnd && (
            <Arrow points={[arrowStart.x, arrowStart.y, arrowEnd.x, arrowEnd.y]} stroke={strokeColor} fill={strokeColor} strokeWidth={strokeWidth} pointerLength={10} pointerWidth={10} dash={[6, 4]} />
          )}

          <Transformer
            ref={trRef}
            rotateEnabled
            borderStroke="#818cf8"
            anchorStroke="#818cf8"
            anchorFill="#1e1e3f"
            anchorSize={8}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>

      {shapes.length === 0 && !textEditor && !currentStroke && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center">
            <p className="text-gray-500 text-lg font-medium">This board is empty</p>
            <p className="text-gray-600 text-sm mt-1">
              Pick a tool below and start drawing · press{' '}
              <kbd className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs font-mono text-gray-400">?</kbd>{' '}
              for shortcuts
            </p>
          </div>
        </div>
      )}

      <LiveCursors cursors={cursors} currentUserId={identity.userId} stageScale={stageScale} stagePos={stagePos} />

      {selBox && selectedIds.length > 0 && (
        <SelectionToolbar
          x={selBox.x}
          y={selBox.y}
          onColor={(c) => applyToSelection({ color: c })}
          onStroke={(w) => applyToSelection({ strokeWidth: w })}
          onDelete={removeSelected}
        />
      )}

      {textEditor && (() => {
        const m = textMetrics(textEditor.isSticky);
        const size = textEditor.fontSize || fontSize;
        return (
          <textarea
            ref={textareaRef}
            value={textEditor.value}
            onChange={(e) => setTextEditor((prev) => ({ ...prev, value: e.target.value }))}
            onBlur={() => {
              // Ignore the spurious blur that can fire in the same tick the
              // editor opened; a real click-away always comes later.
              if (Date.now() - openedAt.current < 250) {
                requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
                return;
              }
              commitText();
            }}
            onKeyDown={(e) => {
              // Enter makes a new line. Escape, Ctrl/Cmd+Enter or clicking away
              // finishes editing — the same convention Excalidraw uses.
              e.stopPropagation();
              if (e.key === 'Escape') { e.preventDefault(); cancelText(); }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitText(); }
            }}
            onWheel={(e) => e.stopPropagation()}
            spellCheck={false}
            className="absolute z-30 outline-none resize-none overflow-hidden"
            style={{
              left: (textEditor.x - m.padding) * stageScale + stagePos.x,
              top: (textEditor.y - m.padding) * stageScale + stagePos.y,
              width: m.width * stageScale,
              minHeight: (size * TEXT_LINE_HEIGHT + m.padding * 2) * stageScale,
              height: textEditor.isSticky ? STICKY_HEIGHT * stageScale : 'auto',
              padding: m.padding * stageScale,
              color: textEditor.isSticky ? STICKY_TEXT_COLOR : textEditor.color,
              background: textEditor.isSticky ? textEditor.fillColor : 'transparent',
              caretColor: textEditor.isSticky ? STICKY_TEXT_COLOR : textEditor.color,
              fontFamily: BOARD_FONT,
              fontSize: size * stageScale,
              fontWeight: textEditor.fontStyle.includes('bold') ? 'bold' : 'normal',
              fontStyle: textEditor.fontStyle.includes('italic') ? 'italic' : 'normal',
              lineHeight: TEXT_LINE_HEIGHT,
              border: `1px dashed ${textEditor.isSticky ? 'rgba(0,0,0,.35)' : 'rgba(129,140,248,.9)'}`,
              borderRadius: textEditor.isSticky ? 10 : 4,
              boxSizing: 'border-box',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            placeholder="Type…  (Esc or click away when done)"
          />
        );
      })()}

      <Minimap shapes={shapes} stagePos={stagePos} stageScale={stageScale} viewWidth={view.width} viewHeight={view.height} />
    </div>
  );
});

export default Canvas;
