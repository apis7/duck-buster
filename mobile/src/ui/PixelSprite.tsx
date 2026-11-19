import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

/** Any text-grid sprite as an SVG, one path per color. `.` is transparent. */
export const PixelSprite = memo(function PixelSprite({
  rows, palette, pixel = 4,
}: { rows: string[]; palette: Record<string, string>; pixel?: number }) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const paths = new Map<string, string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = palette[row[x]];
      if (!c) continue;
      paths.set(c, (paths.get(c) ?? '') + `M${x} ${y}h1v1h-1z`);
    }
  });
  return (
    <Svg width={w * pixel} height={h * pixel} viewBox={`0 0 ${w} ${h}`}>
      {Array.from(paths.entries()).map(([color, d]) => (
        <Path key={color} d={d} fill={color} stroke={color} strokeWidth={0.04} />
      ))}
    </Svg>
  );
});
