import { Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function LeaderboardScreen() {
  return (
    <ScreenContainer className="items-center justify-center">
      <Text className="text-foreground text-2xl font-bold">Leaderboard</Text>
      <Text className="text-muted text-sm mt-2">Leaderboard screen coming soon</Text>
    </ScreenContainer>
  );
}
