import React from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { useColors } from '@/hooks/use-colors';
import {
  Trophy,
  ShoppingBag,
  Gift,
  Settings as SettingsIcon,
  Play,
  Coins,
  Zap,
} from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { user, userData, loading, logout } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#a855f7" />
      </ScreenContainer>
    );
  }

  if (!user && !userData) {
    return (
      <ScreenContainer className="items-center justify-center bg-slate-950">
        <TouchableOpacity
          onPress={() => router.push('/login')}
          className="bg-purple-600 px-8 py-4 rounded-2xl shadow-lg"
        >
          <Text className="text-white font-black text-lg uppercase tracking-widest">
            Sign In to Void
          </Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-slate-950">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="p-6 gap-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-4xl font-black text-white italic tracking-tighter">
              ABSORBIO
            </Text>
            <Text className="text-purple-400 font-bold text-xs uppercase tracking-widest">
              Welcome, {userData?.name || 'Cosmic Explorer'}
            </Text>
          </View>
          <Link href="/(tabs)/settings" asChild>
            <TouchableOpacity className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <SettingsIcon color="#a855f7" size={24} />
            </TouchableOpacity>
          </Link>
        </View>

        {/* Stats Cards */}
        <View className="gap-4">
          <View className="flex-row gap-4">
            {/* Level Card */}
            <View className="flex-1 bg-purple-600/20 border border-purple-500/30 rounded-3xl p-5 shadow-lg">
              <View className="flex-row items-center gap-2 mb-2">
                <Zap color="#a855f7" size={16} />
                <Text className="text-purple-300/60 text-[10px] font-black uppercase tracking-widest">
                  Level
                </Text>
              </View>
              <Text className="text-white text-4xl font-black italic">
                {userData?.level || 1}
              </Text>
            </View>

            {/* Coins Card */}
            <View className="flex-1 bg-yellow-500/10 border border-yellow-500/30 rounded-3xl p-5 shadow-lg">
              <View className="flex-row items-center gap-2 mb-2">
                <Coins color="#EAB308" size={16} />
                <Text className="text-yellow-500/60 text-[10px] font-black uppercase tracking-widest">
                  Coins
                </Text>
              </View>
              <Text className="text-white text-4xl font-black italic">
                {userData?.coins?.toLocaleString() || 0}
              </Text>
            </View>
          </View>

          {/* XP Bar */}
          <View className="bg-white/5 border border-white/10 rounded-3xl p-5">
            <View className="flex-row justify-between mb-3">
              <Text className="text-purple-300 font-black text-[10px] uppercase tracking-widest">
                Experience Progress
              </Text>
              <Text className="text-purple-400/60 text-[10px] font-bold">
                {userData?.xp || 0} / 200 XP
              </Text>
            </View>
            <View className="h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <View
                className="h-full bg-purple-600"
                style={{
                  width: `${Math.min(((userData?.xp || 0) / 200) * 100, 100)}%`,
                }}
              />
            </View>
          </View>
        </View>

        {/* Play Button */}
        <View className="mt-4">
          <Link href="/(tabs)/game" asChild>
            <TouchableOpacity className="bg-purple-600 rounded-[2.5rem] p-8 items-center shadow-2xl border-b-4 border-purple-800 active:border-b-0 active:translate-y-1">
              <View className="flex-row items-center gap-4">
                <Play color="white" size={32} fill="white" />
                <Text className="text-white text-3xl font-black italic tracking-tighter uppercase">
                  Enter Void
                </Text>
              </View>
              <Text className="text-purple-200/60 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                Infinity Mode • Blackhole
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Quick Actions */}
        <View className="gap-4 mt-4">
          <Text className="text-purple-300/40 text-[10px] font-black uppercase tracking-[0.2em] ml-2">
            Quick Access
          </Text>

          <View className="flex-row gap-4">
            <Link href="/(tabs)/rewards" asChild>
              <TouchableOpacity className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-5 items-center">
                <View className="w-12 h-12 rounded-full bg-purple-600/20 items-center justify-center mb-3">
                  <Gift color="#a855f7" size={24} />
                </View>
                <Text className="text-white text-[10px] font-black uppercase tracking-widest">
                  Rewards
                </Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(tabs)/leaderboard" asChild>
              <TouchableOpacity className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-5 items-center">
                <View className="w-12 h-12 rounded-full bg-yellow-500/20 items-center justify-center mb-3">
                  <Trophy color="#EAB308" size={24} />
                </View>
                <Text className="text-white text-[10px] font-black uppercase tracking-widest">
                  Ranks
                </Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(tabs)/shop" asChild>
              <TouchableOpacity className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-5 items-center">
                <View className="w-12 h-12 rounded-full bg-blue-500/20 items-center justify-center mb-3">
                  <ShoppingBag color="#3b82f6" size={24} />
                </View>
                <Text className="text-white text-[10px] font-black uppercase tracking-widest">
                  Shop
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Footer Info */}
        <View className="items-center mt-6 mb-10">
          <Text className="text-purple-400/20 text-[10px] font-bold uppercase tracking-widest">
            Absorbio Mobile • Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
