import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { useColors } from '@/hooks/use-colors';
import {
  User,
  LogOut,
  Shield,
  Bell,
  CircleHelp,
  ChevronRight,
  Settings as SettingsIcon,
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, userData, logout } = useAuth();
  const colors = useColors();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            console.error('Logout error:', error);
          }
        },
      },
    ]);
  };

  const SettingItem = ({
    icon: Icon,
    title,
    subtitle,
    onPress,
    showSwitch = false,
    value = false,
    onValueChange = () => {},
  }: any) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={showSwitch}
      className="flex-row items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl mb-3"
    >
      <View className="w-10 h-10 rounded-full bg-purple-600/20 items-center justify-center">
        <Icon color="#a855f7" size={20} />
      </View>
      <View className="flex-1">
        <Text className="text-white font-bold text-sm">{title}</Text>
        {subtitle && (
          <Text className="text-purple-300/60 text-[10px] uppercase tracking-widest font-bold">
            {subtitle}
          </Text>
        )}
      </View>
      {showSwitch ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#1e293b', true: '#a855f7' }}
          thumbColor="#f8fafc"
        />
      ) : (
        <ChevronRight color="#94a3b8" size={20} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer containerClassName="bg-slate-950">
      <ScrollView className="p-6 flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center mb-8">
          <View className="flex-row items-center gap-3">
            <SettingsIcon color="#a855f7" size={32} />
            <Text className="text-3xl font-black text-white italic tracking-tight">
              SETTINGS
            </Text>
          </View>
          <Text className="text-purple-300/60 text-xs mt-1 uppercase tracking-widest font-bold">
            Configure your experience
          </Text>
        </View>

        {/* Profile Section */}
        <View className="items-center mb-8 p-6 bg-white/5 border border-white/10 rounded-3xl">
          <View className="w-20 h-20 rounded-full bg-purple-600/20 items-center justify-center border-2 border-purple-500/30 mb-4">
            <Text className="text-4xl">👤</Text>
          </View>
          <Text className="text-white font-black text-xl uppercase tracking-tight">
            {userData?.name || 'Cosmic Explorer'}
          </Text>
          <Text className="text-purple-400 font-bold text-xs uppercase tracking-widest">
            Level {userData?.level || 1} • {userData?.coins || 0} Coins
          </Text>
        </View>

        {/* Settings Groups */}
        <View className="mb-6">
          <Text className="text-purple-300/40 text-[10px] font-black uppercase tracking-[0.2em] mb-3 ml-2">
            Account
          </Text>
          <SettingItem
            icon={User}
            title="Profile Details"
            subtitle="Manage your identity"
            onPress={() => {}}
          />
          <SettingItem
            icon={Shield}
            title="Privacy & Security"
            subtitle="Secure your void"
            onPress={() => {}}
          />
        </View>

        <View className="mb-6">
          <Text className="text-purple-300/40 text-[10px] font-black uppercase tracking-[0.2em] mb-3 ml-2">
            Preferences
          </Text>
          <SettingItem
            icon={Bell}
            title="Notifications"
            subtitle="Stay updated"
            showSwitch={true}
            value={true}
          />
          <SettingItem
            icon={CircleHelp}
            title="Help & Support"
            subtitle="Contact the void"
            onPress={() => {}}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center justify-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl mt-4 mb-10"
        >
          <LogOut color="#ef4444" size={20} />
          <Text className="text-red-500 font-black text-sm uppercase tracking-widest">
            Logout from Void
          </Text>
        </TouchableOpacity>

        <View className="items-center mb-10">
          <Text className="text-purple-400/20 text-[10px] font-bold uppercase tracking-widest">
            Absorbio Mobile v1.0.0
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
