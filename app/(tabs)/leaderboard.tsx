import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Trophy, Crown, Medal, RefreshCw } from 'lucide-react-native';

interface Player {
  rank:  number;
  name:  string;
  level: number;
  score: number;
  uid:   string;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [data,    setData]    = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listener (matches web onSnapshot)
  useEffect(() => {
    const q = query(
      collection(db, 'absorbio_users'),
      orderBy('coins', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      setData(snap.docs.map((doc, i) => ({
        rank:  i + 1,
        name:  doc.data().name  || 'Unknown',
        level: doc.data().level || 1,
        score: doc.data().coins || 0,
        uid:   doc.id,
      })));
      setLoading(false);
    }, err => {
      console.error('Leaderboard:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Crown size={22} color="#eab308" />;
    if (rank === 2) return <Medal size={22} color="#94a3b8" />;
    if (rank === 3) return <Medal size={22} color="#f97316" />;
    return <Text style={S.rankNum}>#{rank}</Text>;
  };

  const rowStyle = (rank: number) => {
    if (rank === 1) return S.row1;
    if (rank === 2) return S.row2;
    if (rank === 3) return S.row3;
    return S.rowDefault;
  };

  return (
    <View style={S.root}>
      {/* Decorative glows */}
      <View style={[S.glow, { top: -60, left: -60, backgroundColor: 'rgba(234,179,8,0.15)' }]} />
      <View style={[S.glow, { bottom: -60, right: -60, backgroundColor: 'rgba(168,85,247,0.15)' }]} />

      {/* Header */}
      <View style={S.header}>
        <Trophy size={30} color="#eab308" />
        <Text style={S.title}>HALL OF FAME</Text>
      </View>
      <Text style={S.subtitle}>TOP COSMIC PLAYERS</Text>

      {/* Live indicator */}
      <View style={S.liveRow}>
        <View style={S.liveDot} />
        <Text style={S.liveTxt}>LIVE</Text>
      </View>

      {loading ? (
        <View style={S.loadingBox}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={S.loadingTxt}>LOADING RANKS...</Text>
        </View>
      ) : (
        <ScrollView style={S.list} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {data.length === 0 ? (
            <View style={S.emptyBox}>
              <Text style={S.emptyTxt}>No cosmic explorers yet</Text>
            </View>
          ) : data.map(player => {
            const isMe = player.uid === user?.uid;
            return (
              <View key={player.uid} style={[S.row, rowStyle(player.rank), isMe && S.rowMe]}>
                {/* Rank */}
                <View style={S.rankBox}>
                  <RankIcon rank={player.rank} />
                </View>

                {/* Avatar */}
                <View style={[S.avatar, player.rank === 1 && S.avatar1]}>
                  <Text style={S.avatarTxt}>👤</Text>
                </View>

                {/* Info */}
                <View style={S.info}>
                  <Text style={[S.name, isMe && S.nameMe]} numberOfLines={1}>
                    {player.name}{isMe ? ' (You)' : ''}
                  </Text>
                  <View style={S.metaRow}>
                    <Text style={S.meta}>Level {player.level}</Text>
                    <Text style={S.metaDot}>·</Text>
                    <Text style={S.meta}>Coins: {player.score.toLocaleString()}</Text>
                  </View>
                </View>

                {/* Score */}
                <View style={S.scoreBox}>
                  <Text style={[S.score, player.rank === 1 && S.score1]}>
                    {player.score.toLocaleString()}
                  </Text>
                  <Text style={S.scoreLabel}>WEALTH</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Footer */}
      <View style={S.footer}>
        <View style={S.liveDot} />
        <Text style={S.footerTxt}>Updates in real-time</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060010', overflow: 'hidden' },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingTop: 24, paddingHorizontal: 24, marginBottom: 6,
  },
  title: {
    fontSize: 28, fontWeight: '900', color: '#fff',
    fontStyle: 'italic', letterSpacing: 2,
    textShadowColor: 'rgba(234,179,8,0.4)', textShadowRadius: 12,
  },
  subtitle: {
    textAlign: 'center', color: 'rgba(168,85,247,0.5)',
    fontSize: 10, fontWeight: '700', letterSpacing: 4, marginBottom: 8,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  liveTxt: { color: '#4ade80', fontSize: 9, fontWeight: '900', letterSpacing: 3 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingTxt: { color: '#a855f7', fontSize: 11, fontWeight: '700', letterSpacing: 3 },

  list: { flex: 1, paddingHorizontal: 16 },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyTxt: { color: 'rgba(168,85,247,0.3)', fontWeight: '700', letterSpacing: 2 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 20, borderWidth: 1, marginBottom: 8,
  },
  row1:       { backgroundColor: 'rgba(234,179,8,0.08)',  borderColor: 'rgba(234,179,8,0.3)',  shadowColor: '#eab308', shadowOffset:{width:0,height:0}, shadowRadius:12, shadowOpacity:0.2, elevation:5 },
  row2:       { backgroundColor: 'rgba(148,163,184,0.06)', borderColor: 'rgba(148,163,184,0.2)' },
  row3:       { backgroundColor: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.2)' },
  rowDefault: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' },
  rowMe:      { borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)' },

  rankBox: { width: 36, alignItems: 'center', justifyContent: 'center' },
  rankNum: { color: 'rgba(168,85,247,0.5)', fontWeight: '900', fontSize: 15, fontStyle: 'italic' },

  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(168,85,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar1: { borderColor: 'rgba(234,179,8,0.4)', backgroundColor: 'rgba(234,179,8,0.1)' },
  avatarTxt: { fontSize: 20 },

  info: { flex: 1 },
  name:   { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5, marginBottom: 3 },
  nameMe: { color: '#a855f7' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta:    { color: 'rgba(168,85,247,0.5)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  metaDot: { color: 'rgba(168,85,247,0.3)', fontSize: 9 },

  scoreBox:   { alignItems: 'flex-end' },
  score:      { color: '#c4b5fd', fontWeight: '900', fontSize: 14, fontStyle: 'italic' },
  score1:     { color: '#eab308' },
  scoreLabel: { color: 'rgba(168,85,247,0.4)', fontSize: 7, fontWeight: '900', letterSpacing: 2 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  footerTxt: { color: 'rgba(168,85,247,0.35)', fontSize: 9, fontWeight: '700', letterSpacing: 2 },
});
