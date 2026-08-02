import { shapesBounds } from '../utils/drawingUtils.js';

const MM_W = 160;
const MM_H = 100;
const PAD = 40;

// Lightweight SVG minimap showing all shapes + the current viewport rectangle.
export default function Minimap({ shapes, stagePos, stageScale, viewWidth, viewHeight }) {
  const bounds = shapesBounds(shapes);
  const worldW = Math.max(1, bounds.maxX - bounds.minX) + PAD * 2;
  const worldH = Math.max(1, bounds.maxY - bounds.minY) + PAD * 2;
  const originX = bounds.minX - PAD;
  const originY = bounds.minY - PAD;

  const fit = Math.min(MM_W / worldW, MM_H / worldH);
  const offsetX = (MM_W - worldW * fit) / 2;
  const offsetY = (MM_H - worldH * fit) / 2;

  const toMM = (x, y) => ({
    x: offsetX + (x - originX) * fit,
    y: offsetY + (y - originY) * fit,
  });

  // Visible world region from stage transform.
  const scale = stageScale || 1;
  const visLeft = -stagePos.x / scale;
  const visTop = -stagePos.y / scale;
  const visW = viewWidth / scale;
  const visH = viewHeight / scale;
  const vp = toMM(visLeft, visTop);

  return (
    <div className="absolute bottom-4 right-4 z-20 rounded-lg overflow-hidden border border-gray-700 shadow-lg">
      <svg width={MM_W} height={MM_H} style={{ background: '#15152b', display: 'block' }}>
        {shapes.map((s, i) => {
          if (s.tool === 'stickyNote' || s.tool === 'rectangle' || s.tool === 'circle' ||
              s.tool === 'diamond' || s.tool === 'triangle') {
            const p = toMM(s.x || 0, s.y || 0);
            return (
              <rect
                key={s.id || i}
                x={p.x}
                y={p.y}
                width={Math.max(2, (s.width || 60) * fit)}
                height={Math.max(2, (s.height || 40) * fit)}
                fill={s.fillColor && s.fillColor !== 'transparent' ? s.fillColor : 'none'}
                stroke={s.color || '#8b8bd0'}
                strokeWidth={0.7}
                rx={1}
              />
            );
          }
          if ((s.tool === 'pen' || s.tool === 'highlighter' || s.tool === 'arrow') && s.points) {
            const pts = [];
            for (let j = 0; j < s.points.length; j += 2) {
              const p = toMM((s.points[j] || 0) + (s.x || 0), (s.points[j + 1] || 0) + (s.y || 0));
              pts.push(`${p.x},${p.y}`);
            }
            return (
              <polyline
                key={s.id || i}
                points={pts.join(' ')}
                fill="none"
                stroke={s.color || '#8b8bd0'}
                strokeWidth={0.7}
              />
            );
          }
          // text / emoji
          const p = toMM(s.x || 0, s.y || 0);
          return <circle key={s.id || i} cx={p.x} cy={p.y} r={1.5} fill={s.color || '#8b8bd0'} />;
        })}

        <rect
          x={vp.x}
          y={vp.y}
          width={visW * fit}
          height={visH * fit}
          fill="rgba(99,102,241,0.15)"
          stroke="#818cf8"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
