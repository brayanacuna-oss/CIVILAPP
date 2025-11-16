// app/tabs/addpiece.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  SectionList,
  SectionListData,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { PieceLine } from '../../context/DataContext';
import { useDataContext } from '../../context/DataContext';

// Acepta: "3", "2.4", "1/2", "2 1/4", comas, quitar 'm' y comillas
function parseLengthInput(raw: string): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/m\b/g, '').replace(/"/g, '').trim();
  if (/^\d+\s+\d+\/\d+$/.test(s)) {
    const [whole, frac] = s.split(/\s+/);
    const [num, den] = frac.split('/');
    return parseInt(whole, 10) + parseInt(num, 10) / parseInt(den, 10);
  }
  if (/^\d+\/\d+$/.test(s)) {
    const [num, den] = s.split('/');
    return parseInt(num, 10) / parseInt(den, 10);
  }
  const normalized = s.replace(',', '.');
  const num = parseFloat(normalized);
  if (!Number.isNaN(num) && isFinite(num)) return num;
  return null;
}

type Section = { title: string; data: PieceLine[] };

export default function AddPieceScreen() {
  const router = useRouter();
  const { pieces, addPiece, removePiece, diameter, stockLength } = useDataContext();

  // Form: etiqueta + cantidad de piezas + longitud de corte
  const [label, setLabel] = useState('');
  const [minCutInput, setMinCutInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');

  // ====== Secciones (todas las líneas visibles agrupadas por diámetro) ======
  const sections: Section[] = useMemo(() => {
    const map = new Map<string, PieceLine[]>();
    for (const p of pieces) {
      const key = String(p.diameter ?? '—');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const arr = Array.from(map.entries()).map(([title, data]) => ({ title, data }));
    arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
    return arr;
  }, [pieces]);

  // ====== SectionList ref + scroll ======
  const listRef = useRef<SectionList<PieceLine>>(null);
  const pendingTarget = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);

  const scrollToActive = () => {
    const idx = sections.findIndex((s) => s.title === String(diameter));
    if (idx >= 0) {
      pendingTarget.current = { sectionIndex: idx, itemIndex: 0 };
      requestAnimationFrame(() => {
        listRef.current?.scrollToLocation({
          sectionIndex: idx,
          itemIndex: 0,
          animated: true,
          viewOffset: 0,
          viewPosition: 0,
        });
      });
    }
  };

  useEffect(() => {
    if (diameter != null) scrollToActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diameter, sections.length]);

  // ====== Actions ======
  const onAdd = () => {
    if (!diameter) {
      Alert.alert('Selecciona diámetro', 'Primero elige un diámetro para agregar líneas.');
      return;
    }
    const minCut = parseLengthInput(minCutInput);
    const qty = parseInt(qtyInput, 10);

    if (minCut === null || minCut <= 0) {
      Alert.alert('Longitud de corte inválida', 'Ingresa la longitud de corte por pieza (ej: 3, 2.4, 1/2).');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      Alert.alert('Cantidad de piezas inválida', 'Ingresa una cantidad de piezas entera mayor que 0.');
      return;
    }

    const piece: PieceLine = {
      id: `${Date.now()}`,
      diameter: String(diameter),
      label: label || 'Sin etiqueta',
      minCut,
      qty,
    };
    addPiece(piece);

    setLabel('');
    setMinCutInput('');
    setQtyInput('');

    setTimeout(scrollToActive, 0);
  };

  const onRemove = (id?: string) => {
    if (!id) return;
    Alert.alert('Eliminar', '¿Eliminar esta línea?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removePiece(id) },
    ]);
  };

  const goOptimize = () => {
    if (!stockLength) {
      Alert.alert('Falta longitud de varilla', 'Define la longitud comercial (9 m o 12 m).');
      return;
    }
    if (pieces.length === 0) {
      Alert.alert('No hay líneas', 'Agrega al menos una línea.');
      return;
    }
    router.push('/tabs/result');
  };

  const goAddDiameter = () => {
    router.push('/tabs/home'); // pantalla para cambiar/seleccionar diámetro
  };

  return (
    <ImageBackground
      source={require('../../assets/images/fondo.png')}
      style={styles.bg}
      imageStyle={{ opacity: 0.12 }}
    >
      <View style={styles.container}>
        <Text style={styles.header}>Datos por diámetro</Text>

        {/* Info + botón agregar diámetro */}
        <View style={styles.topRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Diámetro activo:</Text> {diameter ?? '—'}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Varilla:</Text> {stockLength ? `${stockLength} m` : '—'}
            </Text>
          </View>
          <TouchableOpacity style={styles.addDiameterBtn} onPress={goAddDiameter}>
            <Text style={styles.addDiameterTxt}>Agregar diámetro</Text>
          </TouchableOpacity>
        </View>

        {/* Formulario (labels fuera; no dependemos de placeholders) */}
        <View style={styles.card}>
          

          <View style={styles.formRow}>
            <Text style={styles.fieldLabel}>Etiqueta</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              style={styles.input}
              // sin placeholder para que no dependa del APK
            />
            <Text style={styles.fieldHelp}>Ej.: Zapata, Columna, Viga…</Text>
          </View>

          <View style={styles.rowTwo}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>Longitud de corte por pieza (m)</Text>
              <TextInput
                value={minCutInput}
                onChangeText={setMinCutInput}
                style={styles.input}
              />
              <Text style={styles.fieldHelp}>Ej.: 3, 2.4, 1/2, 2 1/4</Text>
            </View>

            <View style={{ width: 150 }}>
              <Text style={styles.fieldLabel}>Cantidad de piezas</Text>
              <TextInput
                value={qtyInput}
                onChangeText={setQtyInput}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.addButton} onPress={onAdd}>
              <Text style={styles.addButtonText}>Agregar línea</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setLabel('');
                setMinCutInput('');
                setQtyInput('');
              }}
            >
              
            </TouchableOpacity>
          </View>
        </View>

        {/* Lista agrupada por diámetro (todas las líneas visibles) */}
        <Text style={styles.sectionTitle}>Líneas por diámetro</Text>
        <SectionList
          ref={listRef}
          sections={sections as SectionListData<PieceLine>[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 8 }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Ø {section.title}</Text>
              <Text style={styles.sectionHeaderSub}>{section.data.length} línea(s)</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemSmall}>Longitud de corte: {item.minCut} m</Text>
                <Text style={styles.itemSmall}>Cantidad de piezas: {item.qty}</Text>
              </View>
              <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.removeBtn}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: '#666', padding: 8 }}>Sin líneas aún</Text>}
          onContentSizeChange={() => scrollToActive()}
          onScrollToIndexFailed={() => {
            setTimeout(() => {
              if (pendingTarget.current) {
                listRef.current?.scrollToLocation({
                  ...pendingTarget.current,
                  animated: true,
                  viewOffset: 0,
                  viewPosition: 0,
                });
              }
            }, 80);
          }}
        />

        {/* Footer */}
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.footerTxt}>Volver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optimizeBtn} onPress={goOptimize}>
            <Text style={styles.footerTxt}>Optimizar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // layout
  bg: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, padding: 16 },

  // header
  header: {
    fontSize: 24, fontWeight: '900', color: '#fff',
    backgroundColor: '#d46a26', alignSelf: 'center',
    paddingVertical: 6, paddingHorizontal: 18, borderRadius: 30, marginBottom: 12,
  },

  // top bar
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  infoCard: { backgroundColor: '#FFF7E6', padding: 10, borderRadius: 12, flex: 1, marginRight: 8 },
  infoText: { color: '#333' },
  bold: { fontWeight: '700' },
  addDiameterBtn: { backgroundColor: '#0EA5E9', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  addDiameterTxt: { color: '#fff', fontWeight: '800' },

  // card form
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  formRow: { marginBottom: 8 },
  fieldLabel: { fontWeight: '700', color: '#111827', marginBottom: 6 },
  fieldHelp: { color: '#6B7280', fontSize: 12, marginTop: 6 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e6e6e6' },
  rowTwo: { flexDirection: 'row', alignItems: 'flex-start' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  addButtonText: { color: '#fff', fontWeight: '700' },
  clearButton: { backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  clearButtonText: { color: '#333', fontWeight: '700' },

  // section list
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  sectionHeader: { backgroundColor: '#F1F5F9', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginBottom: 6, flexDirection:'row', justifyContent:'space-between', alignItems:'baseline' },
  sectionHeaderText: { fontWeight: '900', color: '#111827' },
  sectionHeaderSub: { color: '#6B7280', fontSize: 12 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0'
  },
  itemLabel: { fontWeight: '700' },
  itemSmall: { color: '#666', marginTop: 3 },
  removeBtn: { backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },

  // footer
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  backBtn: { backgroundColor: '#9CA3AF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  optimizeBtn: { backgroundColor: '#F97316', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  footerTxt: { color: 'white', fontWeight: '800' },
});
