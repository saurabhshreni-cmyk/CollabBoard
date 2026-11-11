import { Group, Rect, Ellipse, Line, Text, Arrow, Path } from 'react-konva';
import { freehandPath } from '../utils/drawingUtils.js';
import {
  BOARD_FONT, TEXT_LINE_HEIGHT, textMetrics,
  STICKY_WIDTH, STICKY_HEIGHT, STICKY_PADDING, STICKY_FONT_SIZE, STICKY_TEXT_COLOR,
} from '../utils/textConfig.js';

/**
 * Renders a single board shape and wires up selection / drag / transform.
 * Bounded shapes (rect, circle, diamond, triangle, text, sticky, emoji) are
 * wrapped in a Group positioned at (x, y); freehand paths and arrows are
 * translated via their own x/y offset.
 */
export default function ShapeNode({
  shape,
  clickMode,
  onSelect,
  onErase,
  onChange,
  onEditText,
  registerRef,
}) {
  const isSelectable = clickMode === 'select';
  const commonRef = (node) => registerRef(shape.id, node);

  // Erase on press, and on drag-over while the button (or finger) is down, so
  // the eraser can be swept across the board instead of clicked shape by shape.
  const handlePress = (e) => {
    if (clickMode !== 'erase') return;
    e.cancelBubble = true;
    onErase(shape.id);
  };

  const handleEnter = (e) => {
    if (clickMode === 'erase' && e.evt?.buttons === 1) onErase(shape.id);
  };

  const handleClick = (e) => {
    if (clickMode === 'select') {
      e.cancelBubble = true;
      onSelect(shape.id, e.evt?.shiftKey || false);
    }
  };

  const handleDragEnd = (e) => {
    onChange({ ...shape, x: e.target.x(), y: e.target.y() });
  };

  // Bake Group scale into width/height (or fontSize) so persisted data stays clean.
  const handleTransformEnd = (e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const next = {
      ...shape,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    };

    if (shape.tool === 'text' || shape.tool === 'emoji') {
      next.fontSize = Math.max(8, (shape.fontSize || 16) * scaleX);
    } else {
      next.width = Math.max(5, (shape.width || 10) * scaleX);
      next.height = Math.max(5, (shape.height || 10) * scaleY);
    }
    onChange(next);
  };

  // Freehand strokes and arrows are defined by their points, so there is no
  // width/height to bake a resize into. Keep the scale on the shape instead.
  const handlePointShapeTransformEnd = (e) => {
    const node = e.target;
    onChange({
      ...shape,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
    });
  };

  const pressProps = {
    onMouseDown: handlePress,
    onTouchStart: handlePress,
    onMouseEnter: handleEnter,
  };

  const pointShapeProps = {
    ref: commonRef,
    x: shape.x || 0,
    y: shape.y || 0,
    rotation: shape.rotation || 0,
    scaleX: shape.scaleX ?? 1,
    scaleY: shape.scaleY ?? 1,
    draggable: isSelectable,
    onClick: handleClick,
    onTap: handleClick,
    onDragEnd: handleDragEnd,
    onTransformEnd: handlePointShapeTransformEnd,
    ...pressProps,
  };

  const groupProps = {
    x: shape.x || 0,
    y: shape.y || 0,
    rotation: shape.rotation || 0,
    draggable: isSelectable,
    onClick: handleClick,
    onTap: handleClick,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    ref: commonRef,
    ...pressProps,
  };

  const stroke = shape.color || '#ffffff';
  const strokeWidth = shape.strokeWidth || 2;
  const fill = shape.fillColor && shape.fillColor !== 'transparent' ? shape.fillColor : undefined;
  const w = shape.width || 0;
  const h = shape.height || 0;

  switch (shape.tool) {
    case 'pen':
    case 'highlighter': {
      const data = freehandPath(shape.points, shape.tool, strokeWidth);
      return (
        <Path
          {...pointShapeProps}
          data={data}
          fill={stroke}
          opacity={shape.opacity != null ? shape.opacity : shape.tool === 'highlighter' ? 0.4 : 1}
        />
      );
    }

    case 'arrow':
      return (
        <Arrow
          {...pointShapeProps}
          points={shape.points || [0, 0, 0, 0]}
          stroke={stroke}
          fill={stroke}
          strokeWidth={strokeWidth}
          pointerLength={10}
          pointerWidth={10}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(12, strokeWidth)}
        />
      );

    case 'rectangle':
      return (
        <Group {...groupProps}>
          <Rect width={w} height={h} stroke={stroke} strokeWidth={strokeWidth} fill={fill} cornerRadius={2} />
        </Group>
      );

    case 'circle':
      return (
        <Group {...groupProps}>
          <Ellipse
            x={w / 2}
            y={h / 2}
            radiusX={w / 2}
            radiusY={h / 2}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill={fill}
          />
        </Group>
      );

    case 'diamond':
      return (
        <Group {...groupProps}>
          <Line
            points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]}
            closed
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill={fill}
          />
        </Group>
      );

    case 'triangle':
      return (
        <Group {...groupProps}>
          <Line
            points={[w / 2, 0, w, h, 0, h]}
            closed
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill={fill}
          />
        </Group>
      );

    case 'text':
      return (
        <Group
          {...groupProps}
          onDblClick={() => onEditText && onEditText(shape)}
          onDblTap={() => onEditText && onEditText(shape)}
        >
          <Text
            text={shape.text || ''}
            width={textMetrics(false).wrapWidth}
            fontFamily={BOARD_FONT}
            fontSize={shape.fontSize || 24}
            fontStyle={shape.fontStyle || 'normal'}
            fill={stroke}
            lineHeight={TEXT_LINE_HEIGHT}
            wrap="word"
          />
        </Group>
      );

    case 'stickyNote':
      return (
        <Group
          {...groupProps}
          onDblClick={() => onEditText && onEditText(shape)}
          onDblTap={() => onEditText && onEditText(shape)}
        >
          <Rect
            width={w || STICKY_WIDTH}
            height={h || STICKY_HEIGHT}
            fill={shape.fillColor || '#FFEAA7'}
            cornerRadius={10}
            shadowColor="#000000"
            shadowBlur={10}
            shadowOpacity={0.25}
            shadowOffsetX={2}
            shadowOffsetY={4}
          />
          <Text
            text={shape.text || ''}
            x={STICKY_PADDING}
            y={STICKY_PADDING}
            width={(w || STICKY_WIDTH) - STICKY_PADDING * 2}
            height={(h || STICKY_HEIGHT) - STICKY_PADDING * 2}
            fontFamily={BOARD_FONT}
            fontSize={shape.fontSize || STICKY_FONT_SIZE}
            fontStyle={shape.fontStyle || 'normal'}
            fill={STICKY_TEXT_COLOR}
            lineHeight={TEXT_LINE_HEIGHT}
            wrap="word"
          />
        </Group>
      );

    case 'emoji':
      return (
        <Group {...groupProps}>
          <Text text={shape.text || '⭐'} fontSize={shape.fontSize || 32} />
        </Group>
      );

    default:
      return null;
  }
}
