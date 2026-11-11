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
import TextEditorOverlay from './TextEditorOverlay.jsx';
import {
  generateId, snap, freehandPath, appendStrokePoint, roundCoord, STICKY_COLORS,
} from '../utils/drawingUtils.js';
import {
  STICKY_WIDTH, STICKY_HEIGHT, STICKY_FONT_SIZE, STICKY_TEXT_COLOR,
} from '../utils/textConfig.js';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const TOP_BAR_HEIGHT = 56;
// Mouse events arrive far more densely than a stroke needs; skip points
// closer than this many screen pixels to the previous one.
const MIN_POINT_SPACING_PX = 1.5;
const LASER_COLOR = '#ff3b3b';
const LASER_TTL_MS = 3000;
// Shapes drawn with an outline, i.e. the ones a line width means something for.
const OUTLINED_TOOLS = new Set(['pen', 'highlighter', 'rectangle', 'circle', 'diamond', 'triangle', 'arrow']);
// How often a note being typed is shared with everyone else.
const LIVE_TEXT_INTERVAL_MS = 150;

function touchDistance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function getViewSize() {
  // Never zero or negative: a minimised window reports a tiny viewport.
  return {
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight - TOP_BAR_HEIGHT),
  };
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
    cursors, remoteLasers, addShape, updateShapes, previewShapes, deleteShapes, onToolChange,
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
  const [panning, setPanning] = useState(false);
  const panStart = useRef(null);
  const pinch = useRef(null);
  const spaceHeld = useRef(false);

  const updateShape = (shape) => updateShapes([shape]);

  const cancelInProgress = () => {
    isDrawing.current = false;
    startPoint.current = null;
    setCurrentStroke(null);
    setPreview(null);
    setArrowStart(null);
    setArrowEnd(null);
  };

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

  // A half-finished arrow or shape belongs to the tool that started it.
  useEffect(() => {
    cancelInProgress();
    if (tool !== 'select') setSelectedIds([]);
  }, [tool]);

  // Drop selected ids whose shapes are gone (deleted by someone else, undone…).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const alive = new Set(shapes.map((s) => s.id));
      const kept = prev.filter((id) => alive.has(id));
      return kept.length === prev.length ? prev : kept;
    });
  }, [shapes]);

  // If the note being typed in is deleted by someone else, close the editor
  // rather than leaving a text box floating over nothing.
  const editingId = textEditor?.id || null;
  useEffect(() => {
    if (editingId && !shapes.some((s) => s.id === editingId)) setTextEditor(null);
  }, [shapes, editingId]);

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
      setLocalLasers((prev) => prev.filter((l) => now - l.ts < LASER_TTL_MS));
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
    deselect: () => { setSelectedIds([]); cancelInProgress(); },
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
    const touches = e.evt?.touches;
    if (touches && touches.length >= 2) {
      // Second finger down: stop whatever one finger was doing and pinch.
      cancelInProgress();
      setPanning(false);
      panStart.current = null;
      pinch.current = startPinch(touches);
      return;
    }

    const isMiddle = e.evt && e.evt.button === 1;
    // With the select tool, dragging empty canvas pans: the only way to move
    // around on a touch screen, and the familiar one with a mouse.
    const dragEmptyCanvas = tool === 'select' && e.target === stage;
    if (spaceHeld.current || isMiddle || dragEmptyCanvas) {
      setPanning(true);
      panStart.current = { pointer: stage.getPointerPosition(), pos: { ...stagePos } };
      if (dragEmptyCanvas) setSelectedIds([]);
      if (!textEditor) return;
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

    if (tool === 'select') return;

    if (tool === 'pen' || tool === 'highlighter' || tool === 'laser') {
      isDrawing.current = true;
      setCurrentStroke({
        points: [roundCoord(p.x), roundCoord(p.y)],
        tool,
        color: tool === 'laser' ? LASER_COLOR : strokeColor,
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
        fillColor: stickyColor, original: shape,
      });
      // One click places one note. Switching to Select means the next click
      // finishes typing instead of dropping another note, and the note can be
      // dragged or resized straight away.
      onToolChange?.('select');
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
    const touches = e.evt?.touches;
    if (pinch.current && touches && touches.length >= 2) {
      e.evt.preventDefault();
      applyPinch(touches);
      return;
    }
    if (panStart.current) {
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
      setCurrentStroke((prev) => {
        if (!prev) return prev;
        const points = appendStrokePoint(prev.points, p.x, p.y, MIN_POINT_SPACING_PX / stageScale);
        return points === prev.points ? prev : { ...prev, points };
      });
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
    pinch.current = null;
    if (panStart.current) { setPanning(false); panStart.current = null; return; }
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

  const touchCenter = (touches) => {
    const rect = stageRef.current.container().getBoundingClientRect();
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    };
  };

  const startPinch = (touches) => ({
    distance: touchDistance(touches[0], touches[1]),
    center: touchCenter(touches),
    scale: stageScale,
    pos: { ...stagePos },
  });

  // Two fingers zoom about their midpoint and pan as the midpoint moves.
  const applyPinch = (touches) => {
    const start = pinch.current;
    const center = touchCenter(touches);
    const distance = touchDistance(touches[0], touches[1]);
    if (start.distance === 0) return;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, start.scale * (distance / start.distance)));
    const worldX = (start.center.x - start.pos.x) / start.scale;
    const worldY = (start.center.y - start.pos.y) / start.scale;
    setStageScale(scale);
    setStagePos({ x: center.x - worldX * scale, y: center.y - worldY * scale });
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
    // One call so the whole selection changes, and undoes, as a single step.
    const selected = new Set(selectedIds);
    updateShapes(shapes.filter((s) => selected.has(s.id)).map((s) => ({ ...s, ...patch })));
  };

  const openTextEditor = (opts) => {
    setTextEditor({
      id: opts.id || null, x: opts.x, y: opts.y, value: opts.value || '',
      isSticky: opts.isSticky || false,
      fontSize: opts.fontSize || fontSize,
      // An existing shape keeps its own styling while being edited; a brand new
      // one picks up whatever the toolbar currently has selected.
      color: opts.color || strokeColor,
      fontStyle: opts.fontStyle || fontStyle,
      fillColor: opts.fillColor || stickyColor,
      // The shape as it was before editing: what undo goes back to.
      original: opts.original || null,
      width: opts.original?.width,
      height: opts.original?.height,
    });
  };

  // Share text with everyone while it is being typed, not only when editing
  // ends. Throttled, and sent as a preview so each keystroke is not an undo step.
  const liveText = textEditor?.id ? textEditor.value : null;
  const liveTextId = textEditor?.id || null;
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  useEffect(() => {
    if (liveTextId === null) return undefined;
    const timer = setTimeout(() => {
      const shape = shapesRef.current.find((s) => s.id === liveTextId);
      if (shape && (shape.text || '') !== liveText) previewShapes?.([{ ...shape, text: liveText }]);
    }, LIVE_TEXT_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [liveText, liveTextId, previewShapes]);

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
      original: shape,
    });
  };

  const commitText = () => {
    if (!textEditor) return;
    const value = textEditor.value;
    const existing = textEditor.id ? shapes.find((s) => s.id === textEditor.id) : null;
    if (existing) {
      const emptied = value.trim() === '';
      // An empty sticky is still a useful object; an empty text label is not.
      if (emptied && existing.tool === 'text') {
        // Undo should bring back the label as it read before editing, not
        // the emptied live preview.
        deleteShapes([existing.id], textEditor.original ? [textEditor.original] : undefined);
      } else {
        const finished = {
          ...existing,
          text: value,
          fontSize: textEditor.fontSize,
          ...(existing.tool === 'text'
            ? { color: textEditor.color, fontStyle: textEditor.fontStyle }
            : {}),
        };
        // Undo should restore the text from before editing began, not from
        // the last live preview.
        updateShapes([finished], textEditor.original ? [textEditor.original] : undefined);
        // Leave the note selected so it can be moved or resized immediately.
        if (tool === 'select') setSelectedIds([existing.id]);
      }
    } else if (!textEditor.id && value.trim() !== '') {
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

  // Selection handles are editing UI, not part of the drawing. State updates
  // are asynchronous, so hide the transformer node directly for the capture.
  const withoutSelectionHandles = (capture) => {
    const tr = trRef.current;
    tr?.hide();
    try {
      return capture();
    } finally {
      tr?.show();
    }
  };

  const exportImage = (mimeType) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const uri = withoutSelectionHandles(() => stage.toDataURL({ pixelRatio: 2, mimeType }));
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
    const canvas = withoutSelectionHandles(() => stage.toCanvas({ pixelRatio: 2 }));
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve(false); return; }
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

  const selectedIdSet = new Set(selectedIds);
  const selectedShapes = shapes.filter((s) => selectedIdSet.has(s.id));
  // A note's colour is its background, not an outline.
  const onlyNotesSelected = selectedShapes.length > 0 && selectedShapes.every((s) => s.tool === 'stickyNote');

  const cursorStyle = panning ? 'grabbing' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    // touch-action none: the canvas handles its own panning and pinch zoom,
    // so the browser must not scroll or zoom the page underneath it.
    <div className="relative flex-1 overflow-hidden h-full" style={{ background: backgroundColor, touchAction: 'none' }}>
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
        onTouchCancel={handlePointerUp}
        onMouseLeave={handlePointerUp}
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
          colors={onlyNotesSelected ? STICKY_COLORS : undefined}
          showStroke={selectedShapes.some((s) => OUTLINED_TOOLS.has(s.tool))}
          onColor={(c) => applyToSelection(onlyNotesSelected ? { fillColor: c } : { color: c })}
          onStroke={(w) => applyToSelection({ strokeWidth: w })}
          onDelete={removeSelected}
        />
      )}

      {textEditor && (
        <TextEditorOverlay
          editor={textEditor}
          fallbackFontSize={fontSize}
          stageScale={stageScale}
          stagePos={stagePos}
          onChange={(value) => setTextEditor((prev) => (prev ? { ...prev, value } : prev))}
          onCommit={commitText}
          onCancel={cancelText}
        />
      )}

      <Minimap shapes={shapes} stagePos={stagePos} stageScale={stageScale} viewWidth={view.width} viewHeight={view.height} />
    </div>
  );
});

export default Canvas;
