// components/BarGraphic.tsx
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type Segment = { name: string; length: number }; // metros

// Paleta (puedes ampliarla)
const PALETTE = [
  '#f59e0b', // naranja
  '#10b981', // verde
  '#3b82f6', // azul
  '#ef4444', // rojo
  '#8b5cf6', // violeta
  '#14b8a6', // turquesa
];

function hashNameToIndex(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % PALETTE.length;
}
function colorFor(name: string) {
  return PALETTE[hashNameToIndex(name)];
}

type BarGraphicProps = {
  index: number;
  L: number;
  segments: Segment[];
  waste: number;                // sobrante en metros
  showMinorTicks?: boolean;     // rejilla cada 0.5 m
  wasteColor?: string;          // color del sobrante (gris por defecto)
};

export function BarGraphic({
  index,
  L,
  segments,
  waste,
  showMinorTicks = true,
  wasteColor = '#9CA3AF',
}: BarGraphicProps) {
  // Dimensiones del gráfico (viewBox para que escale)
  const VB_W = 980;
  const VB_H = 160;
  const PAD_X = 40;
  const PAD_TOP = 36;
  const PAD_BOTTOM = 34;

  const innerW = VB_W - PAD_X * 2;
  const innerH = 44; // altura de la “barra”
  const barY = PAD_TOP + 8;

  const safeL = Math.max(0.0001, L);
  const pxPerMeter = innerW / safeL;

  // Construir rectángulos de segmentos
  let x = PAD_X;
  const segRects = segments.map((s) => {
    const w = Math.max(0, s.length * pxPerMeter);
    const rect = { x, w, name: s.name, len: s.length, fill: colorFor(s.name) };
    x += w;
    return rect;
  });

  const wasteW = Math.max(0, waste * pxPerMeter);

  // Ticks 0..floor(L) (enteros) + menores a 0.5 m
  const Lint = Math.floor(L);
  const ticksMajor = Array.from({ length: Lint + 1 }, (_, i) => PAD_X + i * pxPerMeter);
  const ticksMinor = useMemo(() => {
    if (!showMinorTicks) return [] as number[];
    const n = Math.max(0, Math.floor(L * 2)); // cada 0.5 m
    return Array.from({ length: n + 1 }, (_, i) => PAD_X + (i * innerW) / (n || 1));
  }, [L, innerW, PAD_X, showMinorTicks]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{`Barra #${index + 1} — Total ${L.toFixed(2)} m`}</Text>

      <Svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height={170}>
        <Defs>
          {/* resalte suave para segmentos */}
          <LinearGradient id="barGloss" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* fondo */}
        <Rect x={0} y={0} width={VB_W} height={VB_H} fill="#ffffff" rx={12} />

        {/* rejilla menor */}
        {ticksMinor.map((tx, i) => (
          <Line
            key={`mn-${i}`}
            x1={tx}
            y1={PAD_TOP - 8}
            x2={tx}
            y2={VB_H - PAD_BOTTOM + 8}
            stroke="#eef2f7"
            strokeWidth={1}
          />
        ))}

        {/* eje X base */}
        <Line
          x1={PAD_X}
          y1={VB_H - PAD_BOTTOM}
          x2={PAD_X + innerW}
          y2={VB_H - PAD_BOTTOM}
          stroke="#94a3b8"
          strokeWidth={1.2}
        />

        {/* ticks mayores + números */}
        {ticksMajor.map((tx, i) => (
          <G key={`mj-${i}`}>
            <Line
              x1={tx}
              y1={VB_H - PAD_BOTTOM - 6}
              x2={tx}
              y2={VB_H - PAD_BOTTOM + 6}
              stroke="#94a3b8"
              strokeWidth={1.2}
            />
            <SvgText
              x={tx}
              y={VB_H - PAD_BOTTOM + 20}
              fontSize={11}
              fill="#475569"
              textAnchor="middle"
            >
              {i}
            </SvgText>
          </G>
        ))}

        {/* etiqueta eje */}
        <SvgText
          x={PAD_X + innerW / 2}
          y={VB_H - 6}
          fontSize={12}
          fill="#64748b"
          textAnchor="middle"
        >
          Metros
        </SvgText>

        {/* marco claro de la barra */}
        <Rect
          x={PAD_X}
          y={barY}
          width={innerW}
          height={innerH}
          fill="#f8fafc"
          stroke="#e5e7eb"
          strokeWidth={1}
          rx={8}
        />

        {/* segmentos */}
        {segRects.map((r, i) => (
          <G key={i}>
            <Rect x={r.x} y={barY} width={r.w} height={innerH} fill={r.fill} rx={8} />
            <Rect x={r.x} y={barY} width={r.w} height={innerH} fill="url(#barGloss)" rx={8} />
            {/* bordecito separador entre piezas */}
            {i > 0 && (
              <Line
                x1={r.x}
                y1={barY}
                x2={r.x}
                y2={barY + innerH}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            )}
            {/* texto centrado si hay espacio */}
            {r.w > 70 ? (
              <>
                <SvgText
                  x={r.x + r.w / 2}
                  y={barY + innerH / 2 - 3}
                  fontSize={12}
                  fontWeight="700"
                  fill="#1f2937"
                  textAnchor="middle"
                >
                  {r.name}
                </SvgText>
                <SvgText
                  x={r.x + r.w / 2}
                  y={barY + innerH / 2 + 12}
                  fontSize={11}
                  fill="#1f2937"
                  textAnchor="middle"
                >
                  {`${r.len.toFixed(2)} m`}
                </SvgText>
              </>
            ) : null}
          </G>
        ))}

        {/* sobrante (usa wasteColor) */}
        {wasteW > 0 && (
          <>
            <Rect
              x={PAD_X + innerW - wasteW}
              y={barY}
              width={wasteW}
              height={innerH}
              fill={wasteColor}
              rx={8}
            />
            <SvgText
              x={PAD_X + innerW - 6}
              y={barY - 4}
              fontSize={11}
              fill="#64748b"
              textAnchor="end"
            >
              {`Sobrante: ${waste.toFixed(2)} m`}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

export function Legend({ names }: { names: string[] }) {
  const unique = Array.from(new Set(names)).slice(0, 12);
  return (
    <View style={styles.legendWrap}>
      {unique.map((n) => (
        <View key={n} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colorFor(n) }]} />
          <Text style={styles.legendText} numberOfLines={1}>
            {n}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  title: {
    color: '#111827',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 4,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '48%',
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  legendText: { color: '#334155' },
});
