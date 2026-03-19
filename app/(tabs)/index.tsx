/**
 * index.tsx — Absorbio Home Screen
 * Redesigned to match the Blackhole Space Collector game UI.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Easing,
  StyleSheet, Dimensions, Modal, Platform, ScrollView,
  ActivityIndicator, ImageBackground,
} from 'react-native';
import {
  Canvas, Circle, Path, Skia,
  RadialGradient, vec,
} from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { saveUserData } from '@/lib/firebase-db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileModal } from '@/components/ProfileCard';
import {
  User, Gem, Coins, CalendarDays, Settings as SettingsIcon,
  Palette, ChevronLeft, ChevronRight, Infinity as InfinityIcon,
  Swords, Timer, Lock, X, Trophy, Gift, ShoppingBag, Play,
} from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = ['Infinity', 'Survival', 'Time'] as const;
type Mode = typeof MODES[number];

// ─── Animated Space Background ────────────────────────────────────────────────

function SpaceBackground() {
  const [, setTick] = useState(0);
  const stars = useRef(
    Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random(),
    }))
  );

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      stars.current.forEach(s => {
        s.x -= s.speed;
        if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
        s.alpha = Math.max(0.1, Math.min(0.8, s.alpha + (Math.random() - 0.5) * 0.03));
      });
      setTick(t => t + 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { alive = false; };
  }, []);

  const bgPath = Skia?.Path ? Skia.Path.Make() : null;
  if (bgPath) {
    bgPath.addRect({ x: 0, y: 0, width: W, height: H });
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        {bgPath && (
          <Path path={bgPath}>
            <RadialGradient c={vec(W / 2, H / 2)} r={W * 0.8} colors={['#1a0b2e', '#050015']} />
          </Path>
        )}
        {stars.current.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r}
            color={`rgba(255,255,255,${s.alpha.toFixed(2)})`} />
        ))}
      </Canvas>
    </View>
  );
}

// ─── Spinning Ring ─────────────────────────────────────────────────────────────

function SpinRing({ size, duration, reverse = false, color = 'rgba(255,255,255,0.8)', dashed = false, style: extraStyle }: {
  size: number; duration: number; reverse?: boolean; color?: string; dashed?: boolean; style?: object;
}) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
  const r = size / 2;
  return (
    <Animated.View style={[{
      position: 'absolute',
      width: size, height: size, borderRadius: r,
      borderWidth: dashed ? 1 : 1.5,
      borderColor: color,
      borderStyle: dashed ? 'dashed' : 'solid',
      transform: [{ rotate }],
    }, extraStyle]} />
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [balance, setBalance] = useState(0);
  const [xpNeeded, setXpNeeded] = useState(200);
  const [modeIndex, setModeIndex] = useState(0);
  const [appLoaded, setAppLoaded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const loaderOpacity = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(breathAnim, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();
  }, [breathAnim]);

  const breathScale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.05] });
  const glowOpacity = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.7] });

  const mode = MODES[modeIndex];

  // Load Data
  useEffect(() => {
    (async () => {
      const [sl, sx] = await Promise.all([
        AsyncStorage.getItem('collector_level'),
        AsyncStorage.getItem('collector_xp'),
      ]);
      const lvl = parseInt(sl || '1') || 1;
      const xpV = parseInt(sx || '0') || 0;
      setLevel(lvl);
      setXp(xpV);
      setXpNeeded(200 + 40 * lvl * lvl * lvl);
      
      setTimeout(() => {
        Animated.timing(loaderOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => setAppLoaded(true));
      }, 1000);
    })();
  }, []);

  useEffect(() => {
    if (userData) {
      setLevel(userData.level || 1);
      setXp(userData.xp || 0);
      setBalance(userData.coins || 0);
    }
  }, [userData]);

  const handlePlay = () => {
    setIsStarting(true);
    setTimeout(() => {
      setIsStarting(false);
      router.push({ pathname: '/(tabs)/game', params: { mode: mode.toLowerCase() } });
    }, 1500);
  };

  const xpPct = Math.min((xp / xpNeeded) * 100, 100);

  if (loading) return (
    <View style={[S.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#a855f7" />
    </View>
  );

  if (!user && !userData) return (
    <View style={[S.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <TouchableOpacity style={S.signInBtn} onPress={() => router.push('/login')}>
        <Text style={S.signInText}>SIGN IN TO VOID</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={S.root}>
      <SpaceBackground />

      {/* ── TOP BAR ── */}
      <View style={S.topBar}>
        <TouchableOpacity style={S.profilePill} onPress={() => setProfileOpen(true)}>
          <View style={S.avatarCircle}>
            <User size={18} color="#9ca3af" />
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={S.levelText}>Lv. {level}</Text>
            <View style={S.xpTrack}>
              <View style={[S.xpFill, { width: `${xpPct}%` }]} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={S.topRight}>
          <View style={S.currencyPill}>
            <Gem size={14} color="#60a5fa" />
            <Text style={S.currencyText}>0</Text>
          </View>
          <View style={S.currencyPill}>
            <Coins size={14} color="#eab308" />
            <Text style={S.currencyText}>{balance}</Text>
            <View style={S.redDot} />
          </View>
        </View>
      </View>

      {/* ── CENTER CONTENT ── */}
      <View style={S.centerContainer}>
        {/* Title */}
        <View style={S.titleWrap}>
          <View style={S.titleRow}>
            <Text style={S.titleTxt}>BLACKH</Text>
            <View style={S.titleHole}>
              <View style={S.titleHoleCore} />
              <SpinRing size={48} duration={3000} color="rgba(125, 211, 252, 0.8)" style={{ top: -4, left: -4 }} />
            </View>
            <Text style={S.titleTxt}>LE</Text>
          </View>
          <Text style={S.titleSub}>S P A C E   C O L L E C T O R</Text>
        </View>

        {/* Main Blackhole */}
        <View style={S.mainHoleContainer}>
          <Animated.View style={[S.glowRing, { opacity: glowOpacity, transform: [{ scale: breathScale }] }]} />
          <Animated.View style={[S.mainHole, { transform: [{ scale: breathScale }] }]}>
            <View style={S.mainHoleCore} />
            <SpinRing size={110} duration={15000} color="rgba(255,255,255,0.4)" dashed style={{ top: -15, left: -15 }} />
            <SpinRing size={130} duration={20000} reverse color="rgba(255,255,255,0.2)" dashed style={{ top: -25, left: -25 }} />
            <Text style={S.youText}>YOU</Text>
          </Animated.View>
        </View>

        {/* Side Buttons */}
        <View style={S.leftSide}>
          <TouchableOpacity style={S.eventBtn}>
            <View style={S.eventIconBox}>
              <CalendarDays size={24} color="#fff" />
              <View style={S.redDotBadge}><Text style={S.redDotText}>!</Text></View>
            </View>
            <Text style={S.sideBtnLabel}>Event</Text>
          </TouchableOpacity>
        </View>

        <View style={S.rightSide}>
          <TouchableOpacity style={S.iconBtn} onPress={() => router.push('/(tabs)/settings')}>
            <SettingsIcon size={20} color="#fff" />
            <Text style={S.sideBtnLabel}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.iconBtn, { marginTop: 20 }]}>
            <Palette size={20} color="#fff" />
            <Text style={S.sideBtnLabel}>Space</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── BOTTOM BAR ── */}
      <View style={S.bottomBar}>
        <View style={S.navRow}>
          <TouchableOpacity style={S.navItem}>
            <View style={S.navIcon}><View style={S.shapeIcon} /></View>
            <Text style={S.navText}>Shape</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.navItem} onPress={() => router.push('/(tabs)/leaderboard')}>
            <Trophy size={18} color="#fff" />
            <Text style={S.navText}>Ranks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.navItem} onPress={() => router.push('/(tabs)/rewards')}>
            <Gift size={18} color="#fff" />
            <Text style={S.navText}>Loot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.navItem} onPress={() => router.push('/(tabs)/shop')}>
            <ShoppingBag size={18} color="#fff" />
            <Text style={S.navText}>Shop</Text>
          </TouchableOpacity>
        </View>

        <View style={S.playSection}>
          <View style={S.modeSelector}>
            <TouchableOpacity onPress={() => setModeIndex((modeIndex - 1 + MODES.length) % MODES.length)}>
              <ChevronLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View style={S.modeDisplay}>
              <Text style={S.modeLabel}>MODE</Text>
              <Text style={S.modeValue}>{mode}</Text>
            </View>
            <TouchableOpacity onPress={() => setModeIndex((modeIndex + 1) % MODES.length)}>
              <ChevronRight size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={S.playBtn} onPress={handlePlay} activeOpacity={0.8}>
            <View style={S.playIconCircle}>
              <View style={S.playTriangle} />
              <SpinRing size={32} duration={2000} color="rgba(255,255,255,0.6)" dashed style={{ top: -4, left: -4 }} />
            </View>
            <Text style={S.playBtnText}>PLAY</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── TRANSITION OVERLAY ── */}
      {isStarting && (
        <View style={S.transitionOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={S.transitionText}>LOADING VOID...</Text>
        </View>
      )}

      {/* ── INITIAL LOADER ── */}
      {!appLoaded && (
        <Animated.View style={[S.appLoader, { opacity: loaderOpacity }]}>
          <ActivityIndicator size="large" color="#a855f7" />
        </Animated.View>
      )}

      {/* ── PROFILE MODAL ── */}
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        name={userData?.name || 'Cosmic Explorer'}
        level={level}
        xp={xp}
        xpNeeded={xpNeeded}
        coins={balance}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050015' },
  topBar: {
    position: 'absolute', top: 40, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
  },
  profilePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 30,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#a855f7',
  },
  levelText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  xpTrack: { width: 60, height: 4, backgroundColor: '#374151', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#a855f7' },
  topRight: { flexDirection: 'row', gap: 10 },
  currencyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  currencyText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  redDot: { position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', top: '12%', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleTxt: { fontSize: 48, fontWeight: '900', color: '#7dd3fc', letterSpacing: -2 },
  titleHole: { width: 40, height: 40, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  titleHoleCore: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#000', borderWidth: 1, borderColor: '#7dd3fc' },
  titleSub: { fontSize: 10, color: '#7dd3fc', letterSpacing: 4, marginTop: -5, opacity: 0.8 },

  mainHoleContainer: { alignItems: 'center', justifyContent: 'center' },
  glowRing: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 }, shadowRadius: 40, shadowOpacity: 0.8,
  },
  mainHole: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  mainHoleCore: { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: '#000' },
  youText: { color: '#fff', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },

  leftSide: { position: 'absolute', left: 20, top: '45%' },
  eventBtn: { alignItems: 'center' },
  eventIconBox: {
    width: 50, height: 50, borderRadius: 12,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, shadowOpacity: 0.5,
  },
  redDotBadge: {
    position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#050015',
  },
  redDotText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  rightSide: { position: 'absolute', right: 20, top: '40%', alignItems: 'center' },
  iconBtn: { alignItems: 'center' },
  sideBtnLabel: { color: '#fff', fontSize: 10, marginTop: 4, fontWeight: '600' },

  bottomBar: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  navRow: { flexDirection: 'row', gap: 8 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  navIcon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  shapeIcon: { width: 10, height: 10, borderWidth: 1.5, borderColor: '#fff', transform: [{ rotate: '45deg' }] },
  navText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  playSection: { alignItems: 'flex-end', gap: 12 },
  modeSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  modeDisplay: { alignItems: 'center', width: 70 },
  modeLabel: { color: '#a855f7', fontSize: 8, fontWeight: 'bold', letterSpacing: 1 },
  modeValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 30, paddingVertical: 12, borderRadius: 15,
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 }, shadowRadius: 15, shadowOpacity: 0.6,
    backgroundColor: '#8b5cf6',
  },
  playIconCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  playTriangle: {
    width: 0, height: 0, backgroundColor: 'transparent',
    borderStyle: 'solid', borderLeftWidth: 8, borderRightWidth: 0, borderTopWidth: 5, borderBottomWidth: 5,
    borderLeftColor: '#fff', borderRightColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  playBtnText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 2 },

  signInBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 20 },
  signInText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 3 },
  appLoader: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050015', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  transitionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  transitionText: { color: '#fff', marginTop: 20, fontWeight: 'bold', letterSpacing: 2 },
});
