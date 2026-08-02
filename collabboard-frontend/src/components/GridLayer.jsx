import { Layer, Circle } from 'react-konva';
import { GRID_SIZE } from '../utils/drawingUtils.js';

// Renders dot-grid covering the currently visible world region.
export default function GridLayer({ stagePos, stageScale, width, height }) {
  const scale = stageScale || 1;
  const worldLeft = -stagePos.x / scale;
  const worldTop = -stagePos.y / scale;
  const worldRight = (width - stagePos.x) / scale;
  const worldBottom = (height - stagePos.y) / scale;

  const startX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;

  const dots = [];
  const MAX_DOTS = 5000;
  let count = 0;
  for (let x = startX; x < worldRight && count < MAX_DOTS; x += GRID_SIZE) {
    for (let y = startY; y < worldBottom && count < MAX_DOTS; y += GRID_SIZE) {
      dots.push(
        <Circle
          key={`${x}-${y}`}
          x={x}
          y={y}
          radius={1 / scale}
          fill="#3b3b5c"
          listening={false}
          perfectDrawEnabled={false}
        />
      );
      count += 1;
    }
  }

  return <Layer listening={false}>{dots}</Layer>;
}
