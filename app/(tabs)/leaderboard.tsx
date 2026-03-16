import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { getLeaderboard, UserData } from '@/lib/firebase-db';
import { useColors } from '@/hooks/use-colors';
import { Trophy, Crown, Medal, User as UserIcon } from 'lucide-react-native';

export default function LeaderboardScreen() {
  const [leaderboardData, setLeaderboardData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = useColors();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await getLeaderboard(20);
        setLeaderboardData(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown size={24} color="#EAB308" />;
      case 2:
        return <Medal size={24} color="#94A3B8" />;
      case 3:
        return <Medal size={24} color="#F97316" />;
      default:
        return (
          <Text className="text-purple-300/60 font-black text-lg italic">
            #{rank}
          </Text>
        );
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/10 border-yellow-500/30 shadow-lg';
      case 2:
        return 'bg-slate-400/10 border-slate-400/30';
      case 3:
        return 'bg-orange-500/10 border-orange-500/30';
      default:
        return 'bg-white/5 border-white/10';
    }
  };

  return (
    <ScreenContainer containerClassName="bg-slate-950">
      <View className="p-6 flex-1">
        <View className="items-center mb-8">
          <View className="flex-row items-center gap-3">
            <Trophy color="#EAB308" size={32} />
            <Text className="text-3xl font-black text-white italic tracking-tight">
              HALL OF FAME
            </Text>
          </View>
          <Text className="text-purple-300/60 text-xs mt-1 uppercase tracking-widest font-bold">
            Top cosmic players
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#a855f7" />
            <Text className="text-purple-300 mt-4 font-bold uppercase tracking-widest animate-pulse">
              Loading Ranks...
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {leaderboardData.length > 0 ? (
              leaderboardData.map((player, index) => {
                const rank = index + 1;
                return (
                  <View
                    key={player.uid}
                    className={`flex-row items-center gap-4 p-4 rounded-2xl border mb-3 ${getRankStyle(
                      rank
                    )}`}
                  >
                    <View className="w-10 items-center justify-center">
                      {getRankIcon(rank)}
                    </View>

                    <View className="w-12 h-12 rounded-full bg-purple-600/20 items-center justify-center border border-white/5">
                      <Text className="text-2xl">👤</Text>
                    </View>

                    <View className="flex-1">
                      <Text className="text-white font-black text-base uppercase tracking-tight">
                        {player.name || 'Unknown Player'}
                      </Text>
                      <View className="flex-row gap-4">
                        <Text className="text-[10px] font-bold text-purple-400/60 uppercase tracking-widest">
                          Level {player.level}
                        </Text>
                        <Text className="text-[10px] font-bold text-purple-400/60 uppercase tracking-widest">
                          Coins: {player.coins.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-purple-300 font-black text-sm italic">
                        {player.coins.toLocaleString()}
                      </Text>
                      <Text className="text-[8px] text-purple-500/60 font-black uppercase">
                        Wealth
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View className="items-center py-20">
                <Text className="text-purple-300/40 font-bold uppercase tracking-widest">
                  No cosmic explorers yet
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <View className="mt-4 pt-4 border-t border-white/5 items-center">
          <Text className="text-purple-400/40 text-[10px] font-bold uppercase tracking-widest">
            Updates in real-time
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
