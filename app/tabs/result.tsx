// app/tabs/result.tsx
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { PieceLine } from '../../context/DataContext';
import { useDataContext } from '../../context/DataContext';
import { BarGraphic, Legend } from '../BarGraphic';

/* ================== Parámetros del solver local ================== */
const SCALE = 1000;            // mm (0.001 m)
const MAX_PATTERNS = 800;      // límite superior (reduce memoria/CPU)
const MAX_NODES_EXACT = 200000; // tope de nodos visitados en búsqueda exacta
const KERF_M = 0;              // merma por corte (m), ajusta si quieres

/* DP tuning (ajustable según dispositivo) */
const DP_TOP_BASE = 600; // TOP por item (se adapta abajo)
const DP_K_BASE = 600;   // patrones máximos devueltos por DP

/* ================== Tipos ================== */
type Pattern = {
  counts: number[];  // cuántas piezas de cada ítem van en una barra
  usedU: number;     // unidades usadas
  wasteU: number;    // unidades sobrantes
  piecesTotal: number;
};

type Solution = {
  bars: Array<Array<[string, number]>>; // [[ [name,len_m], ... ], ...]
  total_bars: number;
  total_required_m: number;
  total_bought_m: number;
  total_waste_m: number;
  utilization_pct: number;
  waste_pct: number;
};

type ExactResp =
  | { status: 'ok'; solution: Solution }
  | { status: 'infeasible' };

/* ================== Utilidades ================== */
function toUnits(m: number) { return Math.round(m * SCALE); }
function toMeters(u: number) { return Math.round((u / SCALE) * 1000) / 1000; }

/* ================== MinHeap (cola de prioridad) ================== */
class MinHeap<T> {
  private data: T[] = [];
  constructor(private cmp: (a: T, b: T) => number) {}
  size() { return this.data.length; }
  push(v: T) {
    this.data.push(v);
    this.bubbleUp(this.data.length - 1);
  }
  pop(): T | undefined {
    if (!this.data.length) return undefined;
    const res = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return res;
  }
  private bubbleUp(i: number) {
    while (i > 0) {
      const p = Math.floor((i-1)/2);
      if (this.cmp(this.data[i], this.data[p]) < 0) {
        [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
        i = p;
      } else break;
    }
  }
  private bubbleDown(i: number) {
    const n = this.data.length;
    while (true) {
      let l = 2*i + 1, r = 2*i + 2, smallest = i;
      if (l < n && this.cmp(this.data[l], this.data[smallest]) < 0) smallest = l;
      if (r < n && this.cmp(this.data[r], this.data[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

/* ================== Heurística greedy (First-Fit Decreasing) para obtener cota superior ================== */
function greedyPack(itemsLens: number[], demands: number[], L_u: number, names?: string[]) : { solution: Solution } {
  const pieces: { len: number; name?: string }[] = [];
  for (let i = 0; i < itemsLens.length; i++) {
    const q = demands[i];
    const cap = (q > 2000) ? 2000 : q;
    for (let k = 0; k < cap; k++) pieces.push({ len: itemsLens[i], name: names?.[i] });
  }

  pieces.sort((a,b) => b.len - a.len);

  const bars: number[] = [];
  const assignment: Array<Array<{name?:string,len:number}>> = [];

  for (const p of pieces) {
    let placed = false;
    for (let i = 0; i < bars.length; i++) {
      if (bars[i] + p.len <= L_u) {
        bars[i] += p.len;
        assignment[i].push({ name: p.name, len: toMeters(p.len) });
        placed = true; break;
      }
    }
    if (!placed) {
      bars.push(p.len);
      assignment.push([{ name: p.name, len: toMeters(p.len) }]);
    }
  }

  const total_bars = bars.length;
  const total_bought_m = toMeters(total_bars * L_u);
  const used_m = assignment.reduce((s, b) => s + b.reduce((t, seg) => t + seg.len, 0), 0);
  const total_waste_m = Math.round((total_bought_m - used_m) * 1000) / 1000;
  const util = total_bought_m > 0 ? Math.round(10000 * used_m / total_bought_m) / 100 : 0;

  const barsAssignment = assignment.map(bar =>
    bar.map(seg => {
      const nm = typeof seg.name === 'string' && seg.name.length > 0 ? seg.name : 'pieza';
      return [nm, seg.len] as [string, number];
    })
  );

  return {
    solution: {
      bars: barsAssignment,
      total_bars,
      total_required_m: Math.round(used_m * 1000) / 1000,
      total_bought_m: Math.round(total_bought_m * 1000) / 1000,
      total_waste_m,
      utilization_pct: util,
      waste_pct: Math.round((100 - util) * 100) / 100,
    }
  };
}

/* ================== Generador de patrones (DP con poda TOP adaptativa) ================== */
function generatePatternsDP(itemLensU: number[], demands: number[], L_u: number, K = DP_K_BASE, TOP_BASE = DP_TOP_BASE): Pattern[] {
  const n = itemLensU.length;
  if (n === 0) return [];

  const totalPieces = demands.reduce((a,b) => a + b, 0);
  const TOP = Math.max(80, Math.min(1200, Math.floor(TOP_BASE * Math.max(1, 1000 / Math.max(1, totalPieces / (n || 1))))));

  type State = { used: number; counts: Int32Array };
  let states: State[] = [{ used: 0, counts: new Int32Array(n) }];

  for (let i = 0; i < n; i++) {
    const li = itemLensU[i];
    const maxq = Math.min(demands[i], Math.floor(L_u / Math.max(1, li)));
    const nextStates: State[] = [];

    for (const s of states) {
      for (let q = 0; q <= maxq; q++) {
        const newUsed = s.used + q * li;
        if (newUsed > L_u) break;
        const nc = s.counts.slice() as Int32Array;
        nc[i] = q;
        nextStates.push({ used: newUsed, counts: nc });
      }
    }

    nextStates.sort((a, b) => b.used - a.used);
    states = nextStates.slice(0, TOP);
  }

  const uniq = new Map<string, { used: number; counts: number[] }>();
  for (const s of states) {
    if (s.used === 0) continue;
    const key = Array.from(s.counts).join(',');
    const prev = uniq.get(key);
    if (!prev || s.used > prev.used) uniq.set(key, { used: s.used, counts: Array.from(s.counts) });
  }

  // asegurar patrones unitarios
  for (let i = 0; i < n; i++) {
    if (itemLensU[i] <= L_u) {
      const counts = Array(n).fill(0);
      counts[i] = 1;
      const key = counts.join(',');
      if (!uniq.has(key)) uniq.set(key, { used: itemLensU[i], counts });
    }
  }

  const arr = Array.from(uniq.values())
    .map(x => ({ counts: x.counts, usedU: x.used, wasteU: L_u - x.used, piecesTotal: x.counts.reduce((a,b)=>a+b, 0) }))
    .sort((a,b) => a.wasteU - b.wasteU || b.usedU - a.usedU);

  return arr.slice(0, K);
}

/* ================== Fallback: cubrir demanda con patrones (greedy sobre patrones válidos)
   - NO permite producir piezas extra (p.counts[i] > rem[i] no se usa)
   - Permite usar más barras (repetición de patrones) para lograr cubrir la demanda exacta
*/
function greedyCoverPatterns(patterns: Pattern[], demand: number[]): Pattern[] | null {
  const n = demand.length;
  const rem = demand.slice();
  const chosenPatterns: Pattern[] = [];
  const maxSteps = demand.reduce((a,b)=>a+b, 0) * 4 + 1000; // tope de seguridad
  let steps = 0;

  while (rem.some(r => r > 0) && steps < maxSteps) {
    let bestIdx = -1;
    let bestScore = -1; // número piezas cubiertas
    let bestWaste = Infinity;

    for (let j = 0; j < patterns.length; j++) {
      const p = patterns[j];
      // solo patrones que no generen piezas extra
      let valid = true;
      let covered = 0;
      for (let i = 0; i < n; i++) {
        if (p.counts[i] > rem[i]) { valid = false; break; }
        covered += p.counts[i];
      }
      if (!valid) continue;
      // preferir patrón que cubra más piezas; en empate, menor desperdicio
      if (covered > bestScore || (covered === bestScore && p.wasteU < bestWaste)) {
        bestIdx = j;
        bestScore = covered;
        bestWaste = p.wasteU;
      }
    }

    if (bestIdx === -1) {
      // no hay patrón válido restante -> no podemos cubrir exactamente sin crear piezas extra
      return null;
    }

    const p = patterns[bestIdx];
    chosenPatterns.push(p);
    for (let i = 0; i < n; i++) rem[i] -= p.counts[i];
    steps++;
  }

  if (rem.some(r => r > 0)) return null;
  return chosenPatterns;
}

/* ================== Último recurso: empaquetar piezas individualmente (si todo lo anterior falla)
   Esto siempre produce solución exacta sin sobreproducción (crea más barras si hace falta).
*/
function packPiecesExactly(itemLensU: number[], demand: number[], names: string[], L_u: number): Pattern[] {
  const pieces: { len: number; idx: number }[] = [];
  for (let i = 0; i < itemLensU.length; i++) {
    for (let q = 0; q < demand[i]; q++) pieces.push({ len: itemLensU[i], idx: i });
  }

  // ordenar desc por tamaño
  pieces.sort((a,b) => b.len - a.len);

  const bars: Array<{ used: number; segs: { idx: number; len: number }[] }> = [];

  for (const p of pieces) {
    let placed = false;
    for (const b of bars) {
      if (b.used + p.len <= L_u) {
        b.segs.push({ idx: p.idx, len: p.len });
        b.used += p.len;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bars.push({ used: p.len, segs: [{ idx: p.idx, len: p.len }] });
    }
  }

  // convertir cada barra a Pattern
  const patterns: Pattern[] = bars.map(b => {
    const counts = new Array(itemLensU.length).fill(0);
    for (const s of b.segs) counts[s.idx] += 1;
    const usedU = b.used;
    const wasteU = Math.max(0, L_u - usedU);
    const piecesTotal = counts.reduce((a,b)=>a+b,0);
    return { counts, usedU, wasteU, piecesTotal };
  });

  return patterns;
}

/* ================== Solver EXACTO (sin sobreproducción) con heap y poda por cota superior ================== */
function solveExactByPatterns(
  patterns: Pattern[],
  demand: number[],
  itemsNames: string[],
  itemsLenU: number[],
  L_u: number,
  upperBoundBars?: number // cota superior (opcional)
): ExactResp {
  const n = demand.length;
  type Node = { rem: number[]; bars: number; wasteU: number; path: number[] };
  const cmp = (a: Node, b: Node) => (a.bars - b.bars) || (a.wasteU - b.wasteU);

  const start: Node = { rem: demand.slice(), bars: 0, wasteU: 0, path: [] };
  const heap = new MinHeap<Node>(cmp);
  heap.push(start);

  const seen = new Map<string, { bars: number; wasteU: number }>();
  seen.set(demand.join(','), { bars: 0, wasteU: 0 });

  let visited = 0;

  while (heap.size()) {
    const cur = heap.pop()!;
    if (++visited > MAX_NODES_EXACT) break;

    if (cur.rem.every(x => x === 0)) {
      const barsPat = cur.path.map(i => patterns[i]);
      return { status: 'ok', solution: buildSolutionFromBars(barsPat, itemsNames, itemsLenU, L_u) };
    }

    if (upperBoundBars !== undefined && cur.bars >= upperBoundBars) continue;

    for (let j = 0; j < patterns.length; j++) {
      const p = patterns[j];
      let valid = true;
      const next = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        if (p.counts[i] > cur.rem[i]) { valid = false; break; }
        next[i] = cur.rem[i] - p.counts[i];
      }
      if (!valid) continue;

      const nb = cur.bars + 1;
      if (upperBoundBars !== undefined && nb >= upperBoundBars) continue;

      const nw = cur.wasteU + p.wasteU;
      const key = next.join(',');
      const best = seen.get(key);
      if (!best || nb < best.bars || (nb === best.bars && nw < best.wasteU)) {
        seen.set(key, { bars: nb, wasteU: nw });
        heap.push({ rem: next, bars: nb, wasteU: nw, path: [...cur.path, j] });
      }
    }
  }

  return { status: 'infeasible' };
}

/* ================== Reconstrucción de Solution ================== */
function buildSolutionFromBars(barsPat: Pattern[], names: string[], lensU: number[], L_u: number): Solution {
  const bars: Array<Array<[string, number]>> = [];
  for (const p of barsPat) {
    const segs: Array<[string, number]> = [];
    for (let i = 0; i < p.counts.length; i++) {
      const c = p.counts[i];
      for (let k = 0; k < c; k++) segs.push([names[i], toMeters(lensU[i])]);
    }
    bars.push(segs);
  }
  const total_bars = bars.length;
  const total_bought_m = toMeters(total_bars * L_u);
  const used_m = bars.reduce((s, bar) => s + bar.reduce((t, seg) => t + seg[1], 0), 0);
  const total_waste_m = Math.round((total_bought_m - used_m) * 1000) / 1000;
  const util = total_bought_m > 0 ? Math.round(10000 * used_m / total_bought_m) / 100 : 0;

  return {
    bars,
    total_bars,
    total_required_m: Math.round(used_m * 1000) / 1000,
    total_bought_m: Math.round(total_bought_m * 1000) / 1000,
    total_waste_m,
    utilization_pct: util,
    waste_pct: Math.round((100 - util) * 100) / 100,
  };
}

/* ================== Agrupar por diámetro ================== */
function groupByDiameter(pcs: PieceLine[]) {
  const map = new Map<string, PieceLine[]>();
  for (const p of pcs) {
    const k = String(p.diameter);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(p);
  }
  return map;
}

/* ================== Componente principal ================== */
export default function ResultScreen() {
  const router = useRouter();
  const { pieces, stockLength } = useDataContext();
  const L = stockLength || 12;

  const L_u = toUnits(L);

  const byDiam = useMemo(() => groupByDiameter(pieces || []), [pieces]);
  const [solutions, setSolutions] = useState<Record<string, {
    exact?: ExactResp;
    items: { name: string; length_m: number; demand: number }[];
  }>>({});

  const [isComputing, setIsComputing] = useState(false);
  const [loadingDiam, setLoadingDiam] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      if (!stockLength) {
        Alert.alert('Falta longitud de varilla', 'Define 9 m o 12 m antes de optimizar.');
        return;
      }

      setIsComputing(true);
      try {
        await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));

        const out: Record<string, any> = {};

        let diamIndex = 0;
        for (const [diam, arr] of byDiam.entries()) {
          setLoadingDiam(s => ({ ...s, [diam]: true }));
          diamIndex++;

          const items = arr.map(p => ({ name: p.label || `${p.minCut} m`, length_m: p.minCut, demand: p.qty }));
          out[diam] = { items } as { items: any; exact?: ExactResp };

          if (!items.length) {
            // crea solución vacía (no hay piezas)
            out[diam].exact = { status: 'ok', solution: {
              bars: [],
              total_bars: 0, total_required_m: 0, total_bought_m: 0, total_waste_m: 0, utilization_pct: 0, waste_pct: 0
            } };
            setLoadingDiam(s => ({ ...s, [diam]: false }));
            continue;
          }

          const lensU = items.map(it => toUnits(it.length_m));
          const demands = items.map(i => i.demand);

          // heurística rápida para cota superior
          const greedy = greedyPack(lensU, demands, L_u, items.map(i => i.name));
          const upperBoundBars = greedy.solution.total_bars || Infinity;

          // patrones por DP (rápido con poda TOP adaptativa)
          const K = Math.min(MAX_PATTERNS, DP_K_BASE);
          const patterns = generatePatternsDP(lensU, demands, L_u, K, DP_TOP_BASE);

          // si no hay patrones (pieza > L) -> usar packPiecesExactly para devolver barras unitarias (maneja pieza > L al no encajar)
          if (!patterns.length) {
            const finalPatterns = packPiecesExactly(lensU, demands, items.map(i => i.name), L_u);
            out[diam].exact = { status: 'ok', solution: buildSolutionFromBars(finalPatterns, items.map(i => i.name), lensU, L_u) };
            setLoadingDiam(s => ({ ...s, [diam]: false }));
            continue;
          }

          // intento exacto
          const exact = solveExactByPatterns(patterns, demands, items.map(i => i.name), lensU, L_u, upperBoundBars);

          if (exact.status === 'ok') {
            out[diam].exact = exact;
          } else {
            // FALLBACK 1: intentar cubrir exactamente usando patrones (permitir repetir patrones -> más barras)
            const cover = greedyCoverPatterns(patterns, demands);
            if (cover) {
              out[diam].exact = { status: 'ok', solution: buildSolutionFromBars(cover, items.map(i => i.name), lensU, L_u) };
            } else {
              // FALLBACK 2 (último recurso): empacar cada pieza individualmente con First-Fit Decreasing -> garantiza solución exacta
              const finalPatterns = packPiecesExactly(lensU, demands, items.map(i => i.name), L_u);
              out[diam].exact = { status: 'ok', solution: buildSolutionFromBars(finalPatterns, items.map(i => i.name), lensU, L_u) };
            }
          }

          setLoadingDiam(s => ({ ...s, [diam]: false }));

          if ((diamIndex % 2) === 0) await new Promise(r => setTimeout(r, 0));
        }

        setSolutions(out);

        // ya no mostramos alerta "Sin solución exacta": siempre devolvemos solución (se crean más barras si necesario)
      } finally {
        setIsComputing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDiam, stockLength]);

  /* ============ Exportar PDF (igual que antes) ============ */
  const exportAllPDF = async () => {
    const entries = Object.entries(solutions).sort((a,b)=> a[0].localeCompare(b[0], undefined, { numeric:true }));
    if (!entries.length) {
      Alert.alert('Nada para exportar', 'No hay resultados.');
      return;
    }

    const makeColorMap = (names: string[]) => {
      const PALETTE = ['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#14B8A6','#EAB308','#F97316','#22D3EE','#84CC16'];
      const map: Record<string,string> = {};
      names.forEach((n, i)=> map[n] = PALETTE[i % PALETTE.length]);
      return map;
    };

    const svgBar = (bar: Array<[string, number]>, Lm: number, colorMap: Record<string,string>) => {
      const W = 820, H = 64;
      const PAD_L = 32, PAD_R = 10, innerW = W - PAD_L - PAD_R;
      const unit = innerW / Lm;

      let x = PAD_L, used = 0;
      const segs: string[] = [];

      for (const [name, len] of bar) {
        const w = Math.max(0, len * unit);
        const cx = x + w / 2;
        const color = colorMap[name] || '#ddd';
        segs.push(`
          <rect x="${x.toFixed(2)}" y="16" width="${w.toFixed(2)}" height="28" rx="4" fill="${color}"/>
          <text x="${cx.toFixed(2)}" y="31" font-size="10" text-anchor="middle" fill="#1f2937">
            <tspan>${name}</tspan>
            <tspan x="${cx.toFixed(2)}" dy="12">${len.toFixed(2)} m</tspan>
          </text>
        `);
        x += w; used += len;
      }

      const waste = Math.max(0, Lm - used);
      if (waste > 1e-4) {
        const ww = waste * unit, cx = x + ww / 2;
        segs.push(`
          <rect x="${x.toFixed(2)}" y="16" width="${ww.toFixed(2)}" height="28" rx="4" fill="#e5e7eb"/>
          <text x="${cx.toFixed(2)}" y="31" font-size="10" text-anchor="middle" fill="#374151">
            <tspan>Sobrante</tspan>
            <tspan x="${cx.toFixed(2)}" dy="12">${waste.toFixed(2)} m</tspan>
          </text>
        `);
      }

      const ticks: string[] = [];
      for (let m = 0; m <= Math.floor(Lm); m++) {
        const tx = PAD_L + m * unit;
        ticks.push(`
          <line x1="${tx.toFixed(2)}" y1="16" x2="${tx.toFixed(2)}" y2="${(H-10)}" stroke="#e5e7eb" stroke-width="1"/>
          <text x="${tx.toFixed(2)}" y="${H-2}" font-size="9" text-anchor="middle" fill="#6b7280">${m}</text>
        `);
      }

      return `
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${PAD_L}" y="16" width="${innerW}" height="28" rx="6" fill="#fff"/>
          ${ticks.join('')}
          ${segs.join('')}
          <text x="${W-40}" y="12" font-size="9" text-anchor="end" fill="#6b7280">Metros</text>
        </svg>
      `;
    };

    const legendHtml = (names: string[], colorMap: Record<string,string>) => `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 2px 0;">
        ${names.map(n => `
          <span style="display:inline-flex;align-items:center;font-size:12px;color:#111;border:1px solid #eee;border-radius:999px;padding:3px 8px;background:#fff">
            <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${colorMap[n]};margin-right:6px"></span>${n}
          </span>
        `).join('')}
      </div>
    `;

    const sections: string[] = [];
    for (const [diam, rec] of entries) {
      const resp = rec.exact;
      if (!resp || resp.status !== 'ok') {
        sections.push(`
          <section style="margin-top:18px;padding:12px;border:1px solid #eee;border-radius:8px;background:#fffef6">
            <h2 style="margin:0 0 8px 0;">Ø ${diam} — Sin solución</h2>
            <p style="color:#b91c1c;margin:0;">No hay datos.</p>
          </section>
        `);
        continue;
      }

      const s = resp.solution;
      const allNames = [...new Set((s.bars.flat() as Array<[string, number]>).map(([n]) => n))];
      const colorMap = makeColorMap(allNames);

      const barsHtml = s.bars.map((bar, i) => `
        <div style="margin:8px 0 14px 0;">
          <div style="font-weight:700;margin:2px 0 6px 2px;">Barra #${i+1} — Total ${L.toFixed(2)} m</div>
          ${svgBar(bar, L, colorMap)}
        </div>
      `).join('');

      sections.push(`
        <section style="margin-top:18px;padding:12px;border:1px solid #eee;border-radius:8px;">
          <h2 style="margin:0 0 4px 0;">Ø ${diam}</h2>
          <p style="margin:0 0 6px 0;color:#111">
            <b>Barras:</b> ${s.total_bars} &nbsp;·&nbsp;
            <b>Utilización:</b> ${s.utilization_pct}% (${s.total_required_m.toFixed(2)} m usados) &nbsp;·&nbsp;
            <b>Desperdicio:</b> ${s.waste_pct}% (${s.total_waste_m.toFixed(2)} m desperdiciados)
          </p>
          ${legendHtml(allNames, colorMap)}
          ${barsHtml}
        </section>
      `);
    }

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Acerix — Plan de corte (todos los diámetros)</title>
          <style>
            body{font-family:Arial,Helvetica,sans-serif;color:#222;padding:18px}
            h1{background:#ffd7b0;padding:8px 12px;border-radius:8px;display:inline-block}
          </style>
        </head>
        <body>
          <h1>Acerix — Plan de corte (todos los diámetros)</h1>
          <p style="margin-top:8px;">Longitud de varilla L = <b>${L.toFixed(2)} m</b></p>
          ${sections.join('\n')}
          <p style="font-size:12px;color:#666;margin-top:18px">Generado por Acerix — ${new Date().toLocaleString()}</p>
        </body>
      </html>`;

    const printResult = await Print.printToFileAsync({ html });
    const uri = (printResult as any).uri || printResult;

    let fileUriToShare = uri;
    const docDir = (FileSystem as any).documentDirectory as string | null;
    if (docDir) {
      const dest = `${docDir}acerix_todos_${Date.now()}.pdf`;
      try { await FileSystem.moveAsync({ from: uri, to: dest }); fileUriToShare = dest; }
      catch { try { await FileSystem.copyAsync({ from: uri, to: dest }); fileUriToShare = dest; } catch {} }
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(fileUriToShare, { mimeType: 'application/pdf', dialogTitle: 'Exportar plan de corte' });
    else Alert.alert('PDF generado', fileUriToShare);
  };

  return (
    <>
      <Modal visible={isComputing} transparent animationType="fade">
        <View style={overlayStyles.backdrop}>
          <View style={overlayStyles.box}>
            <ActivityIndicator size="large" color="#e11d48" />
            <Text style={overlayStyles.msgTitle}>Optimizando cortes</Text>
            <Text style={overlayStyles.msg}>Cálculo en progreso — por favor espera.</Text>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }} nestedScrollEnabled>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Acerix <Text style={{ fontWeight: '900' }}>— Resultado por diámetro</Text></Text>
          <Text style={{ color: '#666', marginTop: 6 }}>Varilla L = {L} m (fija para todos los diámetros)</Text>
        </View>

        {[...byDiam.entries()]
          .sort((a,b)=>a[0].localeCompare(b[0], undefined, {numeric:true}))
          .map(([diam])=>{
            const rec = solutions[diam];

            let body: React.ReactNode = <Text style={{ color:'#666' }}>Calculando…</Text>;

            if (rec?.exact?.status === 'ok') {
              const s = rec.exact.solution;
              body = (
                <>
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Barras</Text>
                      <Text style={styles.statValue}>{s.total_bars}</Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Utilización</Text>
                      <Text style={styles.statValue}>{s.utilization_pct}%</Text>
                      <Text style={styles.statSub}>{s.total_required_m.toFixed(2)} m usados</Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Desperdicio</Text>
                      <Text style={styles.statValue}>{s.waste_pct}%</Text>
                      <Text style={styles.statSub}>{s.total_waste_m.toFixed(2)} m desperdiciados</Text>
                    </View>
                  </View>

                  <Legend
                    names={[...new Set((s.bars.flat() as Array<[string, number]>).map(([n]) => n))]}
                  />

                  <Text style={{ fontWeight: '800', marginTop: 10 }}>Cortes por barra:</Text>
                  <View style={styles.barsBox}>
                    <ScrollView nestedScrollEnabled>
                      {s.bars.map((bar, i)=>{
                        const segments = bar.map(([name, len]) => ({ name, length: len }));
                        const used = segments.reduce((acc, seg) => acc + seg.length, 0);
                        const waste = Math.max(0, L - used);
                        return (
                          <BarGraphic
                            key={i}
                            index={i}
                            L={L}
                            segments={segments}
                            waste={waste}
                            wasteColor="#9CA3AF"
                          />
                        );
                      })}
                    </ScrollView>
                  </View>
                </>
              );
            } else {
              // si no hay exact (aún calculando) mostramos spinner local
              if (loadingDiam[diam]) {
                body = (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#0ea5e9" />
                    <Text style={{ color: '#666', marginTop: 6 }}>Calculando diámetro {diam}…</Text>
                  </View>
                );
              } else {
                // en práctica no debería llegar aquí porque siempre devolvemos solución
                body = <Text style={{ color:'#b91c1c' }}>No hay resultado.</Text>;
              }
            }

            return (
              <View key={diam} style={styles.card}>
                <Text style={styles.cardHeader}>Ø {diam}</Text>
                {body}
              </View>
            );
        })}

        <View style={{ height: 24 }} />
        <TouchableOpacity style={styles.exportAllBtn} onPress={exportAllPDF}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Exportar PDF (todos los diámetros)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/tabs/AddPieceScreen')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Volver y editar</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

/* ================== Estilos ================== */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  headerRow: { alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 22, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#ffd7b0', borderRadius: 24, overflow: 'hidden' },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { fontSize: 18, fontWeight: '900', marginBottom: 6 },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  statBox: { flex: 1, backgroundColor: '#fffef6', padding: 10, borderRadius: 10, alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 18, fontWeight: '900', marginTop: 3 },
  statSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  barsBox: { maxHeight: 420, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginTop: 8, backgroundColor: '#f9fafb' },

  exportAllBtn: { backgroundColor: '#e11d48', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignSelf:'center' },
  backBtn: { backgroundColor: '#6b7280', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignSelf:'center', marginTop: 10 },
});

/* ================== Estilos del overlay (modal) ================== */
const overlayStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,20,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  msgTitle: {
    marginTop: 10,
    fontWeight: '800',
    fontSize: 16,
    color: '#111827',
  },
  msg: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});

/* ================== Helper para colores PDF ================== */
function makeColorMap(names: string[]) {
  const PALETTE = ['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#14B8A6','#EAB308','#F97316','#22D3EE','#84CC16'];
  const map: Record<string,string> = {};
  names.forEach((n, i)=> map[n] = PALETTE[i % PALETTE.length]);
  return map;
}
