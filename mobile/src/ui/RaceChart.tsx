import { View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { daysBetween } from '@/domain/season';

import { Pixel } from './kit';
import { C } from './theme';

/** Cumulative birds through the season, one stepped line per hunter. */
export function RaceChart({
  series, width, height = 170, start,
}: { series: { color: string; points: { date: string; total: number }[] }[]; width: number; height?: number; start: string }) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const maxY = Math.max(1, ...all.map((p) => p.total));
  const lastDay = Math.max(1, ...all.map((p) => daysBetween(start, p.date)));
  const pad = 8;
  const x = (date: string) => pad + (daysBetween(start, date) / lastDay) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / maxY) * (height - pad * 2);

  return (
    <View>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={C.white} />
        {[0.25, 0.5, 0.75].map((f) => (
          <Line key={f} x1={pad} x2={width - pad} y1={y(maxY * f)} y2={y(maxY * f)} stroke={C.line} strokeWidth={1} />
        ))}
        {series.map((s, i) => {
          if (s.points.length === 0) return null;
          // Stepped: the total jumps on hunt day and holds until the next.
          const pts: string[] = [`${x(s.points[0].date)},${y(0)}`];
          let prev = 0;
          for (const p of s.points) {
            pts.push(`${x(p.date)},${y(prev)}`, `${x(p.date)},${y(p.total)}`);
            prev = p.total;
          }
          pts.push(`${width - pad},${y(prev)}`);
          return <Polyline key={i} points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={3.5} strokeLinejoin="miter" />;
        })}
      </Svg>
      <Pixel size={7} color={C.muted} style={{ position: 'absolute', top: 4, left: 10 }}>{`${maxY}`}</Pixel>
    </View>
  );
}
