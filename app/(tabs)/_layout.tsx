import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },  // ← Tab bar সম্পূর্ণ লুকানো
      }}
    >
      <Tabs.Screen name="index"       options={{ tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="game"        options={{ tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="rewards"     options={{ tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="leaderboard" options={{ tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="shop"        options={{ tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="settings"    options={{ tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
