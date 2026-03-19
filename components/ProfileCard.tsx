/**
 * ProfileCard.tsx
 * - Home screen-এ profile pill tap করলে খোলে
 * - Full player stats দেখায়
 * - Share button দিয়ে profile image social media-তে share করা যায়
 * - Game result card share করা যায়
 */

import React, { useEffect, useRef, useState, forwardRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ScrollView, Animated, Easing, Share, Alert, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  X, Trophy, Star, Coins, Zap, Shield, Target,
  Clock, Swords, Share2, Download, Crown,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerStats {
  totalScore:      number;
  totalKills:      number;
  totalMass:       number;
  bestMass:        number;
  highestTime:     number;  // seconds
  totalPlayedTime: number;  // seconds
  totalGames:      number;
  totalWins:       number;
}

export interface GameResult {
  score:     number;
  kills:     number;
  mass:      number;
  coins:     number;
  mode:      string;
  isWin:     boolean;
  duration:  number;  // seconds
  xpEarned:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatTime = (s: number): string => {
  if (!s) return '0s';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h)   parts.push(`${h}h`);
  if (m)   parts.push(`${m}m`);
  if (sec || !parts.length) parts.push(`${sec}s`);
  return parts.join(' ');
};

export const loadStats = async (): Promise<PlayerStats> => {
  try {
    const v = await AsyncStorage.getItem('bh_stats');
    if (v) return { ...DEFAULT_STATS, ...JSON.parse(v) };
  } catch {}
  return { ...DEFAULT_STATS };
};

export const saveStats = async (stats: Partial<PlayerStats>): Promise<void> => {
  try {
    const current = await loadStats();
    const merged: PlayerStats = {
      totalScore:      (current.totalScore      || 0) + (stats.totalScore      || 0),
      totalKills:      (current.totalKills      || 0) + (stats.totalKills      || 0),
      totalMass:       (current.totalMass       || 0) + (stats.totalMass       || 0),
      bestMass:        Math.max(current.bestMass || 0,   stats.bestMass        || 0),
      highestTime:     Math.max(current.highestTime || 0, stats.highestTime    || 0),
      totalPlayedTime: (current.totalPlayedTime || 0) + (stats.totalPlayedTime || 0),
      totalGames:      (current.totalGames      || 0) + 1,
      totalWins:       (current.totalWins       || 0) + (stats.totalWins       || 0),
    };
    await AsyncStorage.setItem('bh_stats', JSON.stringify(merged));
  } catch {}
};

const DEFAULT_STATS: PlayerStats = {
  totalScore: 0, totalKills: 0, totalMass: 0,
  bestMass: 0, highestTime: 0, totalPlayedTime: 0,
  totalGames: 0, totalWins: 0,
};

// ─── Share helpers ─────────────────────────────────────────────────────────────

const shareText = async (text: string) => {
  try {
    await Share.share({ message: text });
  } catch (e: any) {
    if (e.message !== 'User did not share') {
      Alert.alert('Share failed', 'Could not share at this time.');
    }
  }
};

const buildProfileShareText = (
  name: string, level: number, stats: PlayerStats, coins: number
): string => {
  const wr = stats.totalGames > 0
    ? Math.round((stats.totalWins / stats.totalGames) * 100)
    : 0;
  return [
    `🌌 ABSORBIO — My Profile`,
    ``,
    `👤 ${name}  |  ⚡ Level ${level}`,
    `🪙 ${coins.toLocaleString()} Coins`,
    ``,
    `📊 STATS`,
    `⭐ Total Score:   ${stats.totalScore.toLocaleString()}`,
    `⚔️  Total Kills:   ${stats.totalKills}`,
    `🔵 Best Mass:     ${stats.bestMass.toLocaleString()}`,
    `🏆 Games Played: ${stats.totalGames}`,
    `🎯 Win Rate:      ${wr}%`,
    `⏱  Play Time:     ${formatTime(stats.totalPlayedTime)}`,
    ``,
    `🚀 Play Absorbio — Enter the Void!`,
    `#Absorbio #SpaceGame #MobileGaming`,
  ].join('\n');
};

const buildResultShareText = (result: GameResult, playerName: string): string => {
  const modeEmoji = result.mode === 'survival' ? '🛡️' : result.mode === 'time' ? '⏱️' : '♾️';
  return [
    `${result.isWin ? '🏆 VICTORY' : '💫 GAME OVER'} — ABSORBIO`,
    ``,
    `👤 ${playerName}`,
    `${modeEmoji} Mode: ${result.mode.toUpperCase()}`,
    ``,
    `⭐ Score:   ${result.score.toLocaleString()}`,
    `⚔️  Kills:   ${result.kills}`,
    `🔵 Mass:    ${result.mass.toLocaleString()}`,
    `🪙 Coins:   +${result.coins}`,
    `⚡ XP:      +${result.xpEarned}`,
    `⏱  Time:    ${formatTime(result.duration)}`,
    ``,
    `🚀 Play Absorbio — Enter the Void!`,
    `#Absorbio #SpaceGame #${result.isWin ? 'Winner' : 'GoodGame'}`,
  ].join('\n');
};

// ─── Stat Row component ───────────────────────────────────────────────────────

function StatRow({ icon: Icon, label, value, color = '#c4b5fd' }: {
  icon: any; label: string; value: string; color?: string;
}) {
  return (
    <View style={P.statRow}>
      <View style={P.statIcon}><Icon size={14} color={color} /></View>
      <Text style={P.statLabel}>{label}</Text>
      <Text style={[P.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

interface ProfileModalProps {
  visible:   boolean;
  onClose:   () => void;
  name:      string;
  level:     number;
  xp:        number;
  xpNeeded:  number;
  coins:     number;
  gems?:     number;
}

export function ProfileModal({
  visible, onClose, name, level, xp, xpNeeded, coins, gems = 0,
}: ProfileModalProps) {
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadStats().then(setStats);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const xpPct  = Math.min((xp / xpNeeded) * 100, 100);
  const wr     = stats.totalGames > 0
    ? Math.round((stats.totalWins / stats.totalGames) * 100) : 0;

  const handleShare = () => {
    const text = buildProfileShareText(name, level, stats, coins);
    shareText(text);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[P.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View style={[P.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Glow decorations */}
          <View style={[P.glow, { top: -40, left: -40, backgroundColor: 'rgba(168,85,247,0.2)' }]} />
          <View style={[P.glow, { bottom: -40, right: -40, backgroundColor: 'rgba(59,130,246,0.15)' }]} />

          {/* Header */}
          <View style={P.header}>
            <Text style={P.headerTitle}>PROFILE</Text>
            <TouchableOpacity style={P.closeBtn} onPress={onClose}>
              <X size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Avatar + Name */}
            <View style={P.avatarSection}>
              <View style={P.avatarOuter}>
                <View style={P.avatarInner}>
                  <Text style={{ fontSize: 36 }}>👤</Text>
                </View>
                <View style={P.levelBadge}>
                  <Text style={P.levelBadgeTxt}>{level}</Text>
                </View>
              </View>
              <Text style={P.playerName}>{name || 'Cosmic Explorer'}</Text>
              <Text style={P.playerTitle}>
                {level >= 50 ? '🌌 Void Master' :
                 level >= 25 ? '⚡ Galaxy Hunter' :
                 level >= 10 ? '🚀 Space Explorer' :
                               '🌟 Newcomer'}
              </Text>
            </View>

            {/* XP Bar */}
            <View style={P.xpSection}>
              <View style={P.xpRow}>
                <Text style={P.xpLabel}>XP</Text>
                <Text style={P.xpValue}>{xp.toLocaleString()} / {xpNeeded.toLocaleString()}</Text>
              </View>
              <View style={P.xpTrack}>
                <View style={[P.xpFill, { width: `${xpPct}%` as any }]} />
                <View style={[P.xpGlow, { width: `${xpPct}%` as any }]} />
              </View>
            </View>

            {/* Currency */}
            <View style={P.currencyRow}>
              <View style={P.currencyCard}>
                <Text style={{ fontSize: 22 }}>🪙</Text>
                <Text style={P.currencyVal}>{coins.toLocaleString()}</Text>
                <Text style={P.currencyLbl}>COINS</Text>
              </View>
              <View style={P.currencyCard}>
                <Text style={{ fontSize: 22 }}>💎</Text>
                <Text style={[P.currencyVal, { color: '#60a5fa' }]}>{gems}</Text>
                <Text style={P.currencyLbl}>GEMS</Text>
              </View>
              <View style={P.currencyCard}>
                <Text style={{ fontSize: 22 }}>🏆</Text>
                <Text style={[P.currencyVal, { color: '#eab308' }]}>{stats.totalWins}</Text>
                <Text style={P.currencyLbl}>WINS</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={P.statsBox}>
              <Text style={P.statsTitle}>PLAYER STATS</Text>
              <StatRow icon={Star}   label="Total Score"   value={stats.totalScore.toLocaleString()} color="#a78bfa" />
              <StatRow icon={Swords} label="Total Kills"   value={stats.totalKills.toString()}       color="#f87171" />
              <StatRow icon={Target} label="Best Mass"     value={stats.bestMass.toLocaleString()}   color="#4ade80" />
              <StatRow icon={Trophy} label="Games Played"  value={stats.totalGames.toString()}       color="#eab308" />
              <StatRow icon={Crown}  label="Win Rate"      value={`${wr}%`}                          color="#eab308" />
              <StatRow icon={Clock}  label="Highest Time"  value={formatTime(stats.highestTime)}     color="#facc15" />
              <StatRow icon={Clock}  label="Total Playtime" value={formatTime(stats.totalPlayedTime)} color="#22d3ee" />
              <StatRow icon={Zap}    label="Total XP"      value={xp.toLocaleString()}               color="#c4b5fd" />
            </View>

            {/* Share button */}
            <TouchableOpacity style={P.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Share2 size={18} color="#fff" />
              <Text style={P.shareBtnTxt}>SHARE PROFILE</Text>
            </TouchableOpacity>

            <Text style={P.shareSub}>Share your stats to social media</Text>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Game Result Share Card ────────────────────────────────────────────────────

interface GameResultShareProps {
  visible:    boolean;
  onClose:    () => void;
  onRestart:  () => void;
  onHome:     () => void;
  result:     GameResult;
  playerName: string;
}

export function GameResultShare({
  visible, onClose, onRestart, onHome, result, playerName,
}: GameResultShareProps) {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleShare = () => {
    const text = buildResultShareText(result, playerName);
    shareText(text);
  };

  if (!visible) return null;

  const modeEmoji = result.mode === 'survival' ? '🛡️' : result.mode === 'time' ? '⏱️' : '♾️';

  return (
    <Animated.View style={[R.overlay, { opacity: fadeAnim }]}>
      <Animated.View style={[R.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Glows */}
        <View style={[R.glow, { top: -30, left: -30, backgroundColor: result.isWin ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)' }]} />
        <View style={[R.glow, { bottom: -30, right: -30, backgroundColor: 'rgba(59,130,246,0.15)' }]} />

        {/* Title */}
        <Text style={[R.title, { color: result.isWin ? '#4ade80' : '#ef4444' }]}>
          {result.isWin ? '🏆 VICTORY!' : '💫 GAME OVER'}
        </Text>
        <Text style={R.modeTag}>{modeEmoji} {result.mode.toUpperCase()} MODE</Text>

        {/* Score grid */}
        <View style={R.grid}>
          <View style={R.gridItem}>
            <Text style={R.gridIcon}>⭐</Text>
            <Text style={R.gridVal}>{result.score.toLocaleString()}</Text>
            <Text style={R.gridLbl}>SCORE</Text>
          </View>
          <View style={R.gridItem}>
            <Text style={R.gridIcon}>⚔️</Text>
            <Text style={[R.gridVal, { color: '#f87171' }]}>{result.kills}</Text>
            <Text style={R.gridLbl}>KILLS</Text>
          </View>
          <View style={R.gridItem}>
            <Text style={R.gridIcon}>🔵</Text>
            <Text style={[R.gridVal, { color: '#4ade80' }]}>{result.mass.toLocaleString()}</Text>
            <Text style={R.gridLbl}>MASS</Text>
          </View>
          <View style={R.gridItem}>
            <Text style={R.gridIcon}>🪙</Text>
            <Text style={[R.gridVal, { color: '#eab308' }]}>+{result.coins}</Text>
            <Text style={R.gridLbl}>COINS</Text>
          </View>
          <View style={R.gridItem}>
            <Text style={R.gridIcon}>⚡</Text>
            <Text style={[R.gridVal, { color: '#c4b5fd' }]}>+{result.xpEarned}</Text>
            <Text style={R.gridLbl}>XP</Text>
          </View>
          <View style={R.gridItem}>
            <Text style={R.gridIcon}>⏱️</Text>
            <Text style={[R.gridVal, { color: '#22d3ee' }]}>{formatTime(result.duration)}</Text>
            <Text style={R.gridLbl}>TIME</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={R.btnRow}>
          <TouchableOpacity style={R.restartBtn} onPress={onRestart} activeOpacity={0.85}>
            <Text style={R.restartTxt}>▶ PLAY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={R.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Share2 size={16} color="#fff" />
            <Text style={R.shareTxt}>SHARE</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={R.homeBtn} onPress={onHome} activeOpacity={0.85}>
          <Text style={R.homeTxt}>← BACK HOME</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Profile Pill (home screen top-left) ─────────────────────────────────────

interface ProfilePillProps {
  level: number;
  xpPct: number;
  onPress: () => void;
}

export function ProfilePill({ level, xpPct, onPress }: ProfilePillProps) {
  return (
    <TouchableOpacity style={PP.pill} onPress={onPress} activeOpacity={0.85}>
      <View style={PP.avatar}>
        <Text style={{ fontSize: 18 }}>👤</Text>
        <View style={PP.dot} />
      </View>
      <View style={{ width: 72 }}>
        <Text style={PP.level}>Lv. {level}</Text>
        <View style={PP.xpTrack}>
          <View style={[PP.xpFill, { width: `${xpPct}%` as any }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const P = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0a0018', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, maxHeight: '90%',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
    overflow: 'hidden',
  },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarOuter: { width: 88, height: 88, marginBottom: 12, position: 'relative' },
  avatarInner: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 2, borderColor: 'rgba(168,85,247,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  levelBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0a0018',
  },
  levelBadgeTxt: { color: '#fff', fontWeight: '900', fontSize: 10 },
  playerName: { color: '#fff', fontWeight: '900', fontSize: 20, letterSpacing: 1, marginBottom: 4 },
  playerTitle: { color: 'rgba(168,85,247,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  xpSection: { marginBottom: 16 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpLabel: { color: 'rgba(168,85,247,0.6)', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  xpValue: { color: '#c4b5fd', fontSize: 9, fontWeight: '700' },
  xpTrack: { height: 8, backgroundColor: '#1e1b4b', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  xpFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 4 },
  xpGlow: { position: 'absolute', top: 0, height: '100%', backgroundColor: 'rgba(168,85,247,0.4)', borderRadius: 4 },

  currencyRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  currencyCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 4,
  },
  currencyVal: { color: '#fff', fontWeight: '900', fontSize: 16 },
  currencyLbl: { color: 'rgba(168,85,247,0.4)', fontSize: 8, fontWeight: '700', letterSpacing: 2 },

  statsBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16,
  },
  statsTitle: {
    color: 'rgba(168,85,247,0.5)', fontSize: 9, fontWeight: '900',
    letterSpacing: 3, textAlign: 'center', marginBottom: 12,
    borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 8,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  statIcon: { width: 28, alignItems: 'center' },
  statLabel: { color: '#9ca3af', fontSize: 12, flex: 1, fontWeight: '600' },
  statValue: { fontWeight: '900', fontSize: 13, fontFamily: 'monospace' },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 18, marginBottom: 8,
    backgroundColor: '#7c3aed',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, shadowOpacity: 0.5, elevation: 8,
  },
  shareBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 3 },
  shareSub: { textAlign: 'center', color: 'rgba(168,85,247,0.3)', fontSize: 9, fontWeight: '700', letterSpacing: 2 },
});

const R = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center', zIndex: 300,
  },
  card: {
    width: Math.min(W - 32, 360),
    backgroundColor: '#0a0018', borderRadius: 28, padding: 24,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)', overflow: 'hidden',
  },
  glow: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 4, letterSpacing: 2 },
  modeTag: { color: 'rgba(168,85,247,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 3, textAlign: 'center', marginBottom: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  gridItem: {
    width: '30%', alignItems: 'center', paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  gridIcon: { fontSize: 20, marginBottom: 4 },
  gridVal:  { color: '#fff', fontWeight: '900', fontSize: 15, fontFamily: 'monospace' },
  gridLbl:  { color: 'rgba(168,85,247,0.4)', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 2 },

  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  restartBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: 'center',
    backgroundColor: '#16a34a',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.4, elevation: 6,
  },
  restartTxt: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16,
    backgroundColor: '#7c3aed',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.4, elevation: 6,
  },
  shareTxt: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  homeBtn: {
    paddingVertical: 12, borderRadius: 16, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  homeTxt: { color: '#9ca3af', fontWeight: '700', fontSize: 13 },
});

const PP = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingLeft: 6, paddingRight: 14, paddingVertical: 6,
    borderRadius: 40, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1f2937', borderWidth: 2, borderColor: '#a855f7',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  dot: {
    position: 'absolute', top: 2, right: 2, width: 10, height: 10,
    borderRadius: 5, backgroundColor: '#4ade80', borderWidth: 1.5, borderColor: '#1f2937',
  },
  level: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  xpTrack: { height: 6, backgroundColor: '#1f2937', borderRadius: 3, overflow: 'hidden', marginTop: 3, borderWidth: 1, borderColor: '#374151' },
  xpFill: { height: '100%', backgroundColor: '#a855f7', borderRadius: 3 },
});
