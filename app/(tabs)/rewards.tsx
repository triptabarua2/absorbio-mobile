import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { saveUserData } from '@/lib/firebase-db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gift, Coins, CheckCircle2, X } from 'lucide-react-native';

export default function RewardsScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const [claimed, setClaimed] = useState(false);
  const [currentDay, setCurrentDay] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkClaimStatus = async () => {
      try {
        const lastClaim = await AsyncStorage.getItem('bh_lastClaimDate');
        const dayCountStr = await AsyncStorage.getItem('bh_claimDayCount');
        const dayCount = parseInt(dayCountStr || '1');
        const today = new Date().toDateString();

        if (lastClaim === today) {
          setClaimed(true);
        }
        setCurrentDay(dayCount > 7 ? 1 : dayCount);
      } catch (error) {
        console.error('Error checking claim status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkClaimStatus();
  }, []);

  const rewards = [
    { day: 1, amount: 50, icon: '🪙' },
    { day: 2, amount: 100, icon: '🪙' },
    { day: 3, amount: 200, icon: '💎' },
    { day: 4, amount: 300, icon: '🪙' },
    { day: 5, amount: 500, icon: '💎' },
    { day: 6, amount: 1000, icon: '🪙' },
    { day: 7, amount: 2500, icon: '👑' },
  ];

  const handleClaim = async () => {
    if (claimed || !user || !userData) return;

    const amount = rewards[currentDay - 1].amount;
    setLoading(true);

    try {
      await saveUserData(user.uid, {
        coins: (userData.coins || 0) + amount,
      });
      await refreshUserData();

      const today = new Date().toDateString();
      await AsyncStorage.setItem('bh_lastClaimDate', today);
      await AsyncStorage.setItem(
        'bh_claimDayCount',
        ((currentDay % 7) + 1).toString()
      );

      setClaimed(true);
      Alert.alert('Success', `You claimed ${amount} coins!`);
    } catch (error) {
      console.error('Claim error:', error);
      Alert.alert('Error', 'Failed to claim reward. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-slate-950">
      <View className="p-6 flex-1">
        <View className="items-center mb-8">
          <View className="flex-row items-center gap-3">
            <Gift color="#a855f7" size={32} />
            <Text className="text-3xl font-black text-white italic tracking-tight">
              DAILY REWARDS
            </Text>
          </View>
          <Text className="text-purple-300/60 text-xs mt-1 uppercase tracking-widest font-bold">
            Claim your cosmic loot
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#a855f7" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap gap-3 justify-center mb-8">
              {rewards.map((reward) => {
                const isCurrent = reward.day === currentDay;
                const isPast = reward.day < currentDay;

                return (
                  <View
                    key={reward.day}
                    className={`relative w-[22%] aspect-square items-center justify-center rounded-2xl border ${
                      isCurrent
                        ? 'bg-purple-600/20 border-purple-500 shadow-lg scale-105'
                        : isPast
                        ? 'bg-green-500/10 border-green-500/30 opacity-60'
                        : 'bg-white/5 border-white/10 opacity-40'
                    }`}
                  >
                    <Text className="text-[8px] font-black text-purple-300/60 uppercase mb-1">
                      Day {reward.day}
                    </Text>
                    <Text className="text-xl mb-1">{reward.icon}</Text>
                    <Text className="text-[10px] font-bold text-white">
                      {reward.amount}
                    </Text>

                    {isPast && (
                      <View className="absolute inset-0 items-center justify-center bg-black/40 rounded-2xl">
                        <CheckCircle2 color="#22C55E" size={16} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <View className="items-center">
              <TouchableOpacity
                onPress={handleClaim}
                disabled={claimed || loading}
                className={`w-full py-4 rounded-2xl items-center justify-center flex-row gap-3 ${
                  claimed
                    ? 'bg-green-500 shadow-lg'
                    : 'bg-purple-600 shadow-lg'
                }`}
              >
                {claimed ? (
                  <>
                    <CheckCircle2 color="white" size={24} />
                    <Text className="text-white font-black text-lg uppercase">
                      CLAIMED!
                    </Text>
                  </>
                ) : (
                  <>
                    <Coins color="white" size={24} />
                    <Text className="text-white font-black text-lg uppercase">
                      CLAIM REWARD
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text className="text-purple-400/40 text-[10px] mt-4 font-bold uppercase tracking-widest">
                {claimed ? 'Come back tomorrow!' : 'Next reward in 24 hours'}
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}
