import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';

export default function GameScreen() {
  const { user, userData } = useAuth();

  // The web app is hosted at https://absorbio.vercel.app/
  // We can pass user data via URL parameters or postMessage
  const gameUrl = `https://absorbio.vercel.app/?uid=${user?.uid || ''}&name=${encodeURIComponent(userData?.name || 'Player')}&mobile=true`;

  return (
    <ScreenContainer safeAreaClassName="flex-1" edges={['top']}>
      <View style={styles.container}>
        <WebView
          source={{ uri: gameUrl }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
            </View>
          )}
          // Handle messages from the game (e.g., score updates, coin gains)
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              console.log('Message from game:', data);
              // Handle game events here if needed
            } catch (e) {
              console.error('Error parsing game message:', e);
            }
          }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
});
