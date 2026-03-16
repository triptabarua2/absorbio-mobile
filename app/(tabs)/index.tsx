import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, Link } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

export default function HomeScreen() {
  const router = useRouter();
  const { user, userData, loading, logout } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!user && !userData) {
    return (
      <ScreenContainer className="items-center justify-center">
        <TouchableOpacity
          onPress={() => router.push("/login")}
          className="bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-background font-semibold">Sign In</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="gap-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-3xl font-bold text-foreground">ABSORBIO</Text>
            <Text className="text-muted text-sm">
              Welcome back, {userData?.name || "Player"}
            </Text>
          </View>
          <Link href="/(tabs)/settings" asChild>
            <TouchableOpacity className="bg-surface p-3 rounded-full">
              <Text className="text-foreground text-lg">⚙️</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Stats Cards */}
        <View className="gap-3">
          <View className="flex-row gap-3">
            {/* Level Card */}
            <View className="flex-1 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-4">
              <Text className="text-white/70 text-xs font-semibold uppercase">
                Level
              </Text>
              <Text className="text-white text-3xl font-bold">
                {userData?.level || 1}
              </Text>
            </View>

            {/* Coins Card */}
            <View className="flex-1 bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-2xl p-4">
              <Text className="text-white/70 text-xs font-semibold uppercase">
                Coins
              </Text>
              <Text className="text-white text-3xl font-bold">
                {userData?.coins || 0}
              </Text>
            </View>
          </View>

          {/* XP Bar */}
          <View className="bg-surface rounded-2xl p-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-foreground text-sm font-semibold">
                Experience
              </Text>
              <Text className="text-muted text-xs">{userData?.xp || 0} XP</Text>
            </View>
            <View className="h-2 bg-border rounded-full overflow-hidden">
              <View
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                style={{
                  width: `${Math.min(((userData?.xp || 0) / 200) * 100, 100)}%`,
                }}
              />
            </View>
          </View>
        </View>

        {/* Game Modes */}
        <View className="gap-3 mt-4">
          <Text className="text-foreground text-lg font-bold">Game Modes</Text>

          <Link href="/(tabs)/game" asChild>
            <TouchableOpacity className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 items-center">
              <Text className="text-white text-2xl font-bold">▶ Play Blackhole</Text>
              <Text className="text-white/70 text-xs mt-1">Infinity Mode</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Quick Actions */}
        <View className="gap-3 mt-4">
          <Text className="text-foreground text-lg font-bold">Quick Actions</Text>

          <View className="flex-row gap-3">
            <Link href="/(tabs)/rewards" asChild>
              <TouchableOpacity className="flex-1 bg-surface rounded-2xl p-4 items-center">
                <Text className="text-2xl mb-2">🎁</Text>
                <Text className="text-foreground text-xs font-semibold">Rewards</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(tabs)/leaderboard" asChild>
              <TouchableOpacity className="flex-1 bg-surface rounded-2xl p-4 items-center">
                <Text className="text-2xl mb-2">🏆</Text>
                <Text className="text-foreground text-xs font-semibold">
                  Leaderboard
                </Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(tabs)/shop" asChild>
              <TouchableOpacity className="flex-1 bg-surface rounded-2xl p-4 items-center">
                <Text className="text-2xl mb-2">🛍️</Text>
                <Text className="text-foreground text-xs font-semibold">Shop</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={logout}
          className="bg-error/20 border border-error rounded-2xl p-4 items-center mt-4"
        >
          <Text className="text-error font-semibold">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
