import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithGoogle, signInWithFacebook, signInAsGuest, loading } = useAuth();
  const [activeLoading, setActiveLoading] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setActiveLoading('google');
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
      console.error(error);
    } finally {
      setActiveLoading(null);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      setActiveLoading('facebook');
      await signInWithFacebook();
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Facebook sign-in failed. Please try again.');
      console.error(error);
    } finally {
      setActiveLoading(null);
    }
  };

  const handleGuestSignIn = async () => {
    try {
      setActiveLoading('guest');
      await signInAsGuest();
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Guest sign-in failed. Please try again.');
      console.error(error);
    } finally {
      setActiveLoading(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#a855f7" />
        <Text className="mt-4 text-foreground text-base font-semibold">
          Loading...
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-gradient-to-br from-slate-950 via-purple-950 to-black">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="flex-1"
      >
        <View className="flex-1 items-center justify-center px-4 gap-8">
          {/* Logo Section */}
          <View className="items-center gap-4 mb-8">
            <View className="w-32 h-32 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 items-center justify-center shadow-2xl">
              <View className="w-28 h-28 rounded-full bg-black shadow-inner" />
            </View>
            <Text className="text-5xl font-black text-white tracking-wider">
              ABSORBIO
            </Text>
            <Text className="text-purple-300 text-sm font-bold tracking-widest uppercase">
              Enter The Void
            </Text>
          </View>

          {/* Login Card */}
          <View className="w-full max-w-sm bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 gap-4">
            <Text className="text-white text-lg font-bold text-center mb-2 uppercase tracking-widest">
              Welcome Back
            </Text>

            {/* Google Button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={activeLoading !== null}
              className={cn(
                'w-full py-3 px-4 rounded-2xl bg-white flex-row items-center justify-center gap-3',
                activeLoading !== null && 'opacity-50'
              )}
            >
              <Text className="text-black font-bold text-sm">
                Continue with Google
              </Text>
              {activeLoading === 'google' && (
                <ActivityIndicator size="small" color="#000" />
              )}
            </TouchableOpacity>

            {/* Facebook Button */}
            <TouchableOpacity
              onPress={handleFacebookSignIn}
              disabled={activeLoading !== null}
              className={cn(
                'w-full py-3 px-4 rounded-2xl bg-[#1877F2] flex-row items-center justify-center gap-3',
                activeLoading !== null && 'opacity-50'
              )}
            >
              <Text className="text-white font-black text-lg">f</Text>
              <Text className="text-white font-bold text-sm">
                Continue with Facebook
              </Text>
              {activeLoading === 'facebook' && (
                <ActivityIndicator size="small" color="#fff" />
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center gap-3 my-2">
              <View className="flex-1 h-px bg-white/20" />
              <Text className="text-purple-300/70 text-xs font-bold">OR</Text>
              <View className="flex-1 h-px bg-white/20" />
            </View>

            {/* Guest Button */}
            <TouchableOpacity
              onPress={handleGuestSignIn}
              disabled={activeLoading !== null}
              className={cn(
                'w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-800 flex-row items-center justify-center gap-3 border border-purple-400/30',
                activeLoading !== null && 'opacity-50'
              )}
            >
              <Text className="text-white font-bold text-sm">Play as Guest</Text>
              {activeLoading === 'guest' && (
                <ActivityIndicator size="small" color="#fff" />
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View className="mt-4 pt-4 border-t border-white/10">
              <Text className="text-purple-300/60 text-xs text-center leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy
                Policy.{'\n'}Guest data saves locally on this device.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
