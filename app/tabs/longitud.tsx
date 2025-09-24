// app/tabs/addlength.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDataContext } from '../../context/DataContext';

export default function AddLengthScreen() {
  const router = useRouter();
  const { setStockLength } = useDataContext();
  const [selected, setSelected] = useState<number | null>(null); // 9 o 12

  const handleNext = () => {
    if (selected == null) {
      Alert.alert('Selecciona una longitud', 'Elige 9 m o 12 m para continuar.');
      return;
    }
    setStockLength(selected);
    router.push('/tabs/home');
  };

  return (
    <ImageBackground source={require('../../assets/images/fondo.png')} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.cardContainer}>
        <Text style={styles.sectionTitle}>Longitud de varilla comercial (m)</Text>

        {/* Opciones 9 m y 12 m */}
        <View style={styles.optionsRow}>
          {[9, 12].map((len) => {
            const isActive = selected === len;
            return (
              <TouchableOpacity
                key={len}
                style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                onPress={() => setSelected(len)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{len} m</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.navigationButtonsContainer}>
          <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
            <Text style={styles.navButtonText}>Atrás</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, selected == null && styles.navButtonDisabled]}
            onPress={handleNext}
            disabled={selected == null}
          >
            <Text style={styles.navButtonText}>Siguiente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  cardContainer: { width: '90%', backgroundColor: '#F0F0F0', borderRadius: 20, padding: 20, alignItems: 'center', elevation: 5 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#d46a26',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 25,
    textAlign: 'center',
  },

  // === Botones de opción ===
  optionsRow: { flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 32 },
  optionBtn: {
    backgroundColor: '#E6E9F5',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 28,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E6E9F5',
  },
  optionBtnActive: {
    backgroundColor: '#d46a26',
    borderColor: '#b2561f',
  },
  optionText: { fontSize: 22, fontWeight: '700', color: '#333' },
  optionTextActive: { color: '#fff' },

  // Navegación
  navigationButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 },
  navButton: { backgroundColor: '#d46a26', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10, minWidth: 140, alignItems: 'center' },
  navButtonDisabled: { opacity: 0.5 },
  navButtonText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
});
