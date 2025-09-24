// app/tabs/home.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDataContext } from '../../context/DataContext';

export default function HomeScreen() {
  const router = useRouter();
  const { setDiameter } = useDataContext();

  // Datos para los botones de diámetro
  const diameterOptions = ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"'];

  const handleSelectDiameter = (option: string) => {
    setDiameter(option);
    // ir a la pantalla donde se pide la longitud comercial (9 o 12)
    router.push('/tabs/AddPieceScreen');
  };

  return (
    <View style={styles.fullScreenContainer}>
      {/* tarjeta que contiene la UI */}
      <View style={styles.cardContainer}>
        <Text style={styles.sectionTitle}>Diámetro Ø (")</Text>

        <View style={styles.diameterButtonsContainer}>
          {diameterOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.diameterButton}
              onPress={() => handleSelectDiameter(option)}
              accessibilityLabel={`Seleccionar diámetro ${option}`}
            >
              <Text style={styles.diameterButtonText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Botón Agregar + (ir a pantalla para agregar diámetro manual) */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/tabs/agregadiametro')}
        >
          <Text style={styles.addButtonText}>Agregar +</Text>
        </TouchableOpacity>

        {/* botones de navegación inferior */}
        <View style={styles.navigationButtonsContainer}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.back()}
          >
            <Text style={styles.navButtonText}>Atrás</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push('/tabs/longitud')}
          >
            <Text style={styles.navButtonText}>Siguiente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#30475E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  cardContainer: {
    width: '90%',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#d46a26',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 25,
  },
  diameterButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
    width: '100%',
  },
  diameterButton: {
    backgroundColor: '#A9B3D3',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    margin: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  diameterButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#A9B3D3',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 40,
    marginTop: 10,
  },
  addButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  navButton: {
    backgroundColor: '#d46a26',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
});
