import { useRouter } from 'expo-router';
import { Alert, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  const handleStart = async () => {
    try {
      // Ajusta la ruta según dónde esté tu archivo home.tsx:
      // - Si está en app/home.tsx  -> '/home'
      // - Si está en app/tabs/home.tsx -> '/tabs/home'
      await router.push('/tabs/longitud'); // <- CAMBIA a '/tabs/home' si corresponde
    } catch (err: any) {
      console.error('Navigation error:', err);
      Alert.alert('Error', 'No se pudo abrir la pantalla. Revisa la consola.');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/fondo.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>Bienvenido a Acerix</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleStart}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>INGRESAR</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  button: {
    backgroundColor: '#d46a26',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
});
