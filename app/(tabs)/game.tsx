import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, Alert, TouchableOpacity } from 'react-native';
import { Canvas, Circle, Rect, Group, Text as SkiaText, useFont, vec, LinearGradient, Shadow, BlurMask } from '@shopify/react-native-skia';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { updateStats } from '@/lib/firebase-db';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from 'expo-router';
import { BlackholeEngine, GameState } from '@/lib/game-engine-blackhole';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function GameScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerInput, setPlayerInput] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(true);
  const engineRef = useRef<BlackholeEngine | null>(null);
  const lastTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);

  // Load font for Skia
  const font = useFont(require('@/assets/fonts/SpaceMono-Regular.ttf'), 14);

  // Orientation Lock
  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, [])
  );

  // Initialize Engine
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new BlackholeEngine('infinity');
      setGameState(engineRef.current.getGameState());
    }
  }, []);

  // Game Loop
  useEffect(() => {
    if (!engineRef.current || !isPlaying) return;

    const loop = () => {
      const now = Date.now();
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      engineRef.current!.update(dt, playerInput);
      const newState = engineRef.current!.getGameState();
      setGameState({ ...newState });

      if (newState.isGameOver) {
        setIsPlaying(false);
        handleGameOver(newState);
      } else {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playerInput]);

  const handleGameOver = (state: GameState) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Game Over!', `Score: ${state.score}\nCoins: ${state.coins}`, [
      {
        text: 'Save & Exit',
        onPress: async () => {
          if (user) {
            await updateStats(user.uid, state.xp, state.coins);
            await refreshUserData();
          }
        },
      },
      {
        text: 'Retry',
        onPress: () => {
          engineRef.current = new BlackholeEngine('infinity');
          setIsPlaying(true);
          lastTimeRef.current = Date.now();
        },
      },
    ]);
  };

  // Joystick Input
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dx, dy }) => {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const max = 80;
        const nx = Math.min(1, dx / max);
        const ny = Math.min(1, dy / max);
        setPlayerInput({ x: nx, y: ny });
      },
      onPanResponderRelease: () => setPlayerInput({ x: 0, y: 0 }),
    })
  ).current;

  if (!gameState) return null;

  const { player, foods, bots, dangerZones, blackHoles } = gameState;
  const cameraX = player.x - SCREEN_WIDTH / 2;
  const cameraY = player.y - SCREEN_HEIGHT / 2;

  return (
    <ScreenContainer safeAreaClassName="flex-1" edges={[]}>
      <View style={styles.container} {...panResponder.panHandlers}>
        <Canvas style={styles.canvas}>
          {/* Background */}
          <Rect x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} color="#020617" />
          
          {/* World Border */}
          <Circle cx={engineRef.current!.worldSize / 2 - cameraX} cy={engineRef.current!.worldSize / 2 - cameraY} r={engineRef.current!.worldSize / 2} color="#1e293b" style="stroke" strokeWidth={5} />

          {/* Render Food */}
          {foods.map((f, i) => (
            <Circle key={f.id} cx={f.x - cameraX} cy={f.y - cameraY} r={f.radius} color={f.color}>
              <BlurMask blur={2} style="normal" />
            </Circle>
          ))}

          {/* Render Bots */}
          {bots.filter(b => b.alive).map(b => (
            <Group key={b.id}>
              <Circle cx={b.x - cameraX} cy={b.y - cameraY} r={b.radius} color={b.color}>
                <Shadow dx={0} dy={0} blur={10} color={b.color!} />
              </Circle>
              {font && <SkiaText x={b.x - cameraX - 20} y={b.y - cameraY - b.radius - 5} text={b.name!} font={font} color="white" />}
            </Group>
          ))}

          {/* Render Danger Zones */}
          {dangerZones.map(z => (
            <Circle key={z.id} cx={z.x - cameraX} cy={z.y - cameraY} r={z.radius} color="rgba(239, 68, 68, 0.3)">
              <BlurMask blur={20} style="normal" />
            </Circle>
          ))}

          {/* Render Black Holes */}
          {blackHoles.map(bh => (
            <Circle key={bh.id} cx={bh.x - cameraX} cy={bh.y - cameraY} r={bh.radius} color="black">
              <Shadow dx={0} dy={0} blur={30} color="#a855f7" />
            </Circle>
          ))}

          {/* Render Player */}
          <Circle cx={SCREEN_WIDTH / 2} cy={SCREEN_HEIGHT / 2} r={player.radius} color={player.color}>
            <LinearGradient start={vec(0, 0)} end={vec(player.radius * 2, player.radius * 2)} colors={['#a855f7', '#7c3aed']} />
            <Shadow dx={0} dy={0} blur={20} color="#a855f7" />
          </Circle>
        </Canvas>

        {/* UI Overlay */}
        <View style={styles.ui}>
          <View style={styles.stats}>
            <Text style={styles.text}>Score: {gameState.score}</Text>
            <Text style={styles.text}>Mass: {Math.floor(player.mass)}</Text>
            <Text style={styles.text}>Level: {gameState.level}</Text>
          </View>

          {/* Instability Bar */}
          <View style={styles.instabilityContainer}>
            <View style={[styles.instabilityFill, { width: `${player.instability}%`, backgroundColor: player.instability > 80 ? '#ef4444' : '#a855f7' }]} />
          </View>

          {/* Event Text */}
          {gameState.eventText && (
            <View style={styles.eventBox}>
              <Text style={styles.eventText}>{gameState.eventText}</Text>
            </View>
          )}

          {/* Surge Button */}
          {player.mass >= 20000 && (
            <TouchableOpacity 
              style={[styles.surgeBtn, { opacity: engineRef.current!.rocketCooldown > 0 ? 0.5 : 1 }]} 
              onPress={() => {
                engineRef.current!.activateSurge();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }}
            >
              <Text style={styles.surgeText}>🚀 SURGE</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Minimap */}
        <View style={styles.minimap}>
          <View style={styles.minimapPlayer} style={{ left: (player.x / 8000) * 100, top: (player.y / 8000) * 100 }} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  canvas: { flex: 1 },
  ui: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, pointerEvents: 'box-none' },
  stats: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8, alignSelf: 'flex-start' },
  text: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  instabilityContainer: { position: 'absolute', bottom: 20, left: '25%', width: '50%', height: 10, backgroundColor: '#1e293b', borderRadius: 5, overflow: 'hidden' },
  instabilityFill: { height: '100%' },
  eventBox: { position: 'absolute', top: 50, alignSelf: 'center', backgroundColor: 'rgba(239, 68, 68, 0.8)', padding: 10, borderRadius: 20 },
  eventText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  surgeBtn: { position: 'absolute', bottom: 50, right: 20, backgroundColor: '#a855f7', padding: 15, borderRadius: 30, elevation: 5 },
  surgeText: { color: 'white', fontWeight: 'bold' },
  minimap: { position: 'absolute', top: 20, right: 20, width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  minimapPlayer: { position: 'absolute', width: 4, height: 4, backgroundColor: '#a855f7', borderRadius: 2 },
});
