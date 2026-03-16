import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Alert,
  PanResponder,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { updateStats } from '@/lib/firebase-db';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Rect } from 'react-native-svg';
import { GameEngine, GameState } from '@/lib/game-engine';

const CANVAS_WIDTH = Dimensions.get('window').width;
const CANVAS_HEIGHT = Dimensions.get('window').height;

export default function GameScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerInput, setPlayerInput] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(true);
  const gameEngineRef = useRef<GameEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // Setup orientation lock
  useFocusEffect(
    React.useCallback(() => {
      async function lockOrientation() {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
      lockOrientation();

      return () => {
        async function unlockOrientation() {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
        unlockOrientation();
      };
    }, [])
  );

  // Initialize game engine
  useEffect(() => {
    if (!gameEngineRef.current) {
      gameEngineRef.current = new GameEngine(userData?.name || 'Player');
      setGameState(gameEngineRef.current.getGameState());
    }
  }, [userData]);

  // Game loop
  useEffect(() => {
    if (!gameEngineRef.current || !isPlaying) return;

    const gameLoop = () => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      gameEngineRef.current!.update(deltaTime, playerInput);
      setGameState({ ...gameEngineRef.current!.getGameState() });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playerInput]);

  // Handle game over
  useEffect(() => {
    if (gameState?.isGameOver) {
      setIsPlaying(false);
      handleGameOver();
    }
  }, [gameState?.isGameOver]);

  const handleGameOver = async () => {
    if (!user || !userData) return;

    Alert.alert('Game Over!', `Final Score: ${gameState?.score}\nCoins: ${gameState?.coins}`, [
      {
        text: 'Save & Exit',
        onPress: async () => {
          try {
            await updateStats(
              user.uid,
              gameState?.xp || 0,
              gameState?.coins || 0
            );
            await refreshUserData();
          } catch (error) {
            console.error('Error saving game stats:', error);
          }
        },
      },
      {
        text: 'Play Again',
        onPress: () => {
          gameEngineRef.current?.resetGame();
          setGameState(gameEngineRef.current!.getGameState());
          setIsPlaying(true);
          lastTimeRef.current = Date.now();
        },
      },
    ]);
  };

  // Handle touch input for joystick
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, { dx, dy }) => {
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        const maxMagnitude = 100;
        const normalizedX = Math.min(1, magnitude > 0 ? dx / maxMagnitude : 0);
        const normalizedY = Math.min(1, magnitude > 0 ? dy / maxMagnitude : 0);
        setPlayerInput({ x: normalizedX, y: normalizedY });
      },
      onPanResponderRelease: () => {
        setPlayerInput({ x: 0, y: 0 });
      },
    })
  ).current;

  if (!gameState) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-white text-lg font-bold">Loading Game...</Text>
      </ScreenContainer>
    );
  }

  // Calculate camera position (follow player)
  const cameraX = Math.max(0, Math.min(8000 - CANVAS_WIDTH, gameState.player.x - CANVAS_WIDTH / 2));
  const cameraY = Math.max(0, Math.min(8000 - CANVAS_HEIGHT, gameState.player.y - CANVAS_HEIGHT / 2));

  return (
    <ScreenContainer safeAreaClassName="flex-1" edges={[]}>
      <View style={styles.container} {...panResponder.panHandlers}>
        <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={styles.canvas}>
          {/* Background */}
          <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#020617" />

          {/* Render food */}
          {gameState.foods.map((food) => {
            const screenX = food.x - cameraX;
            const screenY = food.y - cameraY;

            if (screenX < -20 || screenX > CANVAS_WIDTH + 20 || screenY < -20 || screenY > CANVAS_HEIGHT + 20) {
              return null;
            }

            return (
              <Circle
                key={food.id}
                cx={screenX}
                cy={screenY}
                r={food.radius}
                fill={food.color || '#00ff88'}
                opacity="0.8"
              />
            );
          })}

          {/* Render enemies */}
          {gameState.enemies.map((enemy) => {
            const screenX = enemy.x - cameraX;
            const screenY = enemy.y - cameraY;

            if (screenX < -30 || screenX > CANVAS_WIDTH + 30 || screenY < -30 || screenY > CANVAS_HEIGHT + 30) {
              return null;
            }

            return (
              <Circle
                key={enemy.id}
                cx={screenX}
                cy={screenY}
                r={enemy.radius}
                fill={enemy.color || '#ff00ff'}
                opacity="0.7"
              />
            );
          })}

          {/* Render player */}
          <Circle
            cx={CANVAS_WIDTH / 2}
            cy={CANVAS_HEIGHT / 2}
            r={gameState.player.radius}
            fill={gameState.player.color}
            opacity="0.9"
          />
        </Svg>

        {/* UI Overlay */}
        <View style={styles.uiOverlay}>
          <View style={styles.statsContainer}>
            <Text style={styles.statText}>Score: {gameState.score}</Text>
            <Text style={styles.statText}>Level: {gameState.level}</Text>
            <Text style={styles.statText}>Coins: {gameState.coins}</Text>
          </View>

          <View style={styles.xpContainer}>
            <Text style={styles.xpText}>{gameState.xp.toFixed(0)} / 200 XP</Text>
            <View style={styles.xpBar}>
              <View
                style={[
                  styles.xpFill,
                  { width: `${Math.min((gameState.xp / 200) * 100, 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    position: 'relative',
  },
  canvas: {
    flex: 1,
  },
  uiOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 100,
  },
  statsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  statText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  xpContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
  },
  xpText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  xpBar: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#a855f7',
  },
});
