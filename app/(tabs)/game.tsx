import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from 'expo-router';

export default function GameScreen() {
  const { user, userData } = useAuth();

  // The web app is hosted at https://absorbio.vercel.app/
  const gameUrl = `https://absorbio.vercel.app/?uid=${user?.uid || ''}&name=${encodeURIComponent(userData?.name || 'Player')}&mobile=true`;

  useFocusEffect(
    React.useCallback(() => {
      // Lock to landscape when entering the game screen
      async function lockOrientation() {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
      lockOrientation();

      return () => {
        // Unlock or return to portrait when leaving the game screen
        async function unlockOrientation() {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
        unlockOrientation();
      };
    }, [])
  );

  return (
    <ScreenContainer safeAreaClassName="flex-1" edges={[]}>
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
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              console.log('Message from game:', data);
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
