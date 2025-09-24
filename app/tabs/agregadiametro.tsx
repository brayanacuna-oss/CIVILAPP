import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDataContext } from '../../context/DataContext';

export default function AddDiameterScreen() {
  const router = useRouter();
  const { setDiameter } = useDataContext();
  const [inputValue, setInputValue] = useState('');

  const handleNext = () => {
    setDiameter(inputValue);
    router.push('/tabs/AddPieceScreen');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/fondo.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.cardContainer}>
        <Text style={styles.sectionTitle}>Agrega diámetro Ø (")</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ingrese el diámetro"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={inputValue}
            onChangeText={setInputValue}
          />
        </View>
        <View style={styles.navigationButtonsContainer}>
          <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
            <Text style={styles.navButtonText}>Atrás</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={handleNext}>
            <Text style={styles.navButtonText}>Siguiente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

// (puedes dejar tus estilos igual)


const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 40,
    marginTop: 20,
    width: '80%',
  },
  input: {
    backgroundColor: '#A9B3D3',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
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