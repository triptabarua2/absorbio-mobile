import { Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function GameScreen() {
  return (
    <ScreenContainer className="items-center justify-center">
      <Text className="text-foreground text-2xl font-bold">Game Screen</Text>
      <Text className="text-muted text-sm mt-2">Blackhole game coming soon</Text>
    </ScreenContainer>
  );
}
