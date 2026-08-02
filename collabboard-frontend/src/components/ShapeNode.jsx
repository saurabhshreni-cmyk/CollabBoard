import { Group, Rect, Ellipse, Line, Text, Arrow, Path } from 'react-konva';
import { freehandPath } from '../utils/drawingUtils.js';

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

  const handleClick = (e) => {
    if (clickMode === 'erase') {
      e.cancelBubble = true;
      onErase(shape.id);
      return;
    }
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
          ref={commonRef}
          data={data}
          x={shape.x || 0}
          y={shape.y || 0}
          rotation={shape.rotation || 0}
          fill={stroke}
          opacity={shape.opacity != null ? shape.opacity : shape.tool === 'highlighter' ? 0.4 : 1}
          draggable={isSelectable}
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={handleDragEnd}
          listening
        />
      );
    }

    case 'arrow':
      return (
        <Arrow
          ref={commonRef}
          points={shape.points || [0, 0, 0, 0]}
          x={shape.x || 0}
          y={shape.y || 0}
          rotation={shape.rotation || 0}
          stroke={stroke}
          fill={stroke}
          strokeWidth={strokeWidth}
          pointerLength={10}
          pointerWidth={10}
          lineCap="round"
          lineJoin="round"
          draggable={isSelectable}
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={handleDragEnd}
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
            fontSize={shape.fontSize || 24}
            fontStyle={shape.fontStyle || 'normal'}
            fill={stroke}
            lineHeight={1.2}
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
            width={w || 200}
            height={h || 150}
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
            x={14}
            y={14}
            width={(w || 200) - 28}
            height={(h || 150) - 28}
            fontSize={shape.fontSize || 18}
            fontStyle={shape.fontStyle || 'normal'}
            fill="#1a1a2e"
            lineHeight={1.3}
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
