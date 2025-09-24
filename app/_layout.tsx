import { Slot } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { DataProvider } from '../context/DataContext';

export default function Layout() {
  return (
    <DataProvider>
      <SafeAreaView style={styles.container}>
        <Slot />
      </SafeAreaView>
    </DataProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
