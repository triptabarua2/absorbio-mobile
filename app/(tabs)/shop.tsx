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
import { updateInventory, saveUserData } from '@/lib/firebase-db';
import { ShoppingBag, Coins, CheckCircle2, X, ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ShopScreen() {
  const router = useRouter();
  const { user, userData, refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState<'skins' | 'trails' | 'powerups'>(
    'skins'
  );
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const shopItems = {
    skins: [
      { id: 'shadow_knight', name: 'Shadow Knight', price: 500, emoji: '🖤' },
      { id: 'neon_phantom', name: 'Neon Phantom', price: 1200, emoji: '💜' },
      { id: 'void_collector', name: 'Void Collector', price: 2500, emoji: '⚫' },
      { id: 'cyber_reaper', name: 'Cyber Reaper', price: 800, emoji: '💀' },
      { id: 'crystal_guardian', name: 'Crystal Guardian', price: 1500, emoji: '💎' },
      { id: 'galactic_hunter', name: 'Galactic Hunter', price: 3000, emoji: '🌌' },
    ],
    trails: [
      { id: 'purple_trail', name: 'Purple Nebula', price: 300, emoji: '✨' },
      { id: 'cyan_trail', name: 'Cyan Wave', price: 400, emoji: '🌊' },
      { id: 'golden_trail', name: 'Golden Path', price: 600, emoji: '✨' },
      { id: 'electric_trail', name: 'Electric Storm', price: 700, emoji: '⚡' },
      { id: 'fire_trail', name: 'Inferno Trail', price: 800, emoji: '🔥' },
      { id: 'ice_trail', name: 'Frost Trail', price: 750, emoji: '❄️' },
    ],
    powerups: [
      { id: 'magnet_boost', name: 'Magnet Boost', price: 250, emoji: '🧲' },
      { id: 'speed_burst', name: 'Speed Burst', price: 350, emoji: '⚡' },
      { id: 'shield_dome', name: 'Shield Dome', price: 500, emoji: '🛡️' },
      { id: 'double_points', name: 'Double Points', price: 400, emoji: '2️⃣' },
      { id: 'size_boost', name: 'Size Boost', price: 450, emoji: '📈' },
      { id: 'time_freeze', name: 'Time Freeze', price: 600, emoji: '⏱️' },
    ],
  };

  const isOwned = (id: string, tab: string) => {
    // @ts-ignore
    return userData?.inventory?.[tab]?.includes(id);
  };

  const handlePurchase = async (item: any) => {
    if (!user || !userData) return;

    if (isOwned(item.id, activeTab)) {
      setPurchaseMessage(`${item.name} is already owned!`);
      setTimeout(() => setPurchaseMessage(''), 2000);
      return;
    }

    if (userData.coins >= item.price) {
      setLoading(true);
      try {
        await updateInventory(user.uid, activeTab, item.id);
        await saveUserData(user.uid, {
          coins: userData.coins - item.price,
        });
        await refreshUserData();
        setPurchaseMessage(`🎉 ${item.name} purchased!`);
        setTimeout(() => setPurchaseMessage(''), 2000);
      } catch (error) {
        console.error('Purchase error:', error);
        Alert.alert('Error', 'Failed to complete purchase. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      setPurchaseMessage(
        `❌ Not enough coins! Need ${item.price - userData.coins} more.`
      );
      setTimeout(() => setPurchaseMessage(''), 2000);
    }
  };

  const currentItems = shopItems[activeTab];

  return (
    <ScreenContainer containerClassName="bg-slate-950">
      {/* Back Button */}
      <TouchableOpacity 
        style={{ position: 'absolute', top: 50, left: 20, zIndex: 100, padding: 10 }} 
        onPress={() => router.back()}
      >
        <ChevronLeft color="#fff" size={30} />
      </TouchableOpacity>

      <View className="p-6 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center gap-3">
            <ShoppingBag color="#a855f7" size={32} />
            <Text className="text-3xl font-black text-white italic tracking-tight">
              SHOP
            </Text>
          </View>

          <View className="flex-row items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-purple-500/30">
            <Coins color="#EAB308" size={20} />
            <Text className="text-white font-bold text-lg">
              {userData?.coins?.toLocaleString() || 0}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row gap-2 mb-8 border-b border-white/10 pb-4">
          {(['skins', 'trails', 'powerups'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl ${
                activeTab === tab
                  ? 'bg-purple-600 shadow-lg'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <Text
                className={`font-bold text-xs uppercase tracking-widest ${
                  activeTab === tab ? 'text-white' : 'text-purple-300/60'
                }`}
              >
                {tab === 'skins' && '👤 Skins'}
                {tab === 'trails' && '✨ Trails'}
                {tab === 'powerups' && '⚡ Power-ups'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Purchase Message */}
        {purchaseMessage && (
          <View className="mb-4 p-3 bg-purple-500/20 border border-purple-500/40 rounded-xl items-center">
            <Text className="text-purple-300 font-bold text-sm">
              {purchaseMessage}
            </Text>
          </View>
        )}

        {/* Items Grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View className="flex-row flex-wrap gap-4">
            {currentItems.map((item) => {
              const owned = isOwned(item.id, activeTab);
              return (
                <View
                  key={item.id}
                  className="w-[47%] bg-white/5 border border-purple-500/30 rounded-2xl p-4"
                >
                  <View className="w-full h-24 bg-purple-600/20 rounded-xl items-center justify-center mb-3">
                    <Text className="text-4xl">{item.emoji}</Text>
                  </View>

                  <Text className="text-white font-bold text-sm mb-2 text-center">
                    {item.name}
                  </Text>

                  <View className="items-center justify-center">
                    {owned ? (
                      <View className="w-full py-2 rounded-xl bg-green-500/20 border border-green-500/30 items-center">
                        <Text className="text-green-400 font-bold text-[10px] uppercase tracking-widest">
                          ✓ Owned
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handlePurchase(item)}
                        disabled={loading || (userData?.coins || 0) < item.price}
                        className={`w-full py-2 rounded-xl items-center ${
                          (userData?.coins || 0) >= item.price
                            ? 'bg-purple-600'
                            : 'bg-gray-600 opacity-50'
                        }`}
                      >
                        <View className="flex-row items-center gap-1">
                          <Text className="text-white font-bold text-[10px] uppercase tracking-widest">
                            Buy {item.price}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View className="mt-4 pt-4 border-t border-white/5 items-center">
          <Text className="text-purple-400/40 text-[10px] font-bold uppercase tracking-widest">
            Earn coins by playing games
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
