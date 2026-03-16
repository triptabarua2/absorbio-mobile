# Absorbio Unity Project

Welcome to the Unity version of **Absorbio**! This project is a complete conversion of the original web-based blackhole game into the Unity engine, providing a more performant and scalable gaming experience.

## Project Overview

This Unity project includes all the core mechanics of the original game, implemented in C# for high performance and flexibility.

### Key Features
- **Player Controller:** Smooth blackhole movement with growth mechanics and absorption logic.
- **Dynamic Spawning:** Automatic spawning of food items and AI-controlled enemies.
- **Growth System:** The blackhole grows in size as it absorbs objects, with corresponding adjustments to movement speed and absorption radius.
- **UI System:** Real-time display of score, coins, level, and XP progress.
- **Firebase Integration:** Built-in support for Firebase Authentication and Firestore to save player progress, coins, and inventory.

## Getting Started

To get started with the Absorbio Unity project, follow these steps:

### 1. Prerequisites
- **Unity Hub:** Download and install from [unity.com](https://unity.com/download).
- **Unity Editor:** Recommended version **2022.3 LTS** or later.
- **Firebase SDK for Unity:** Download the Firebase Unity SDK from the [Firebase Console](https://console.firebase.google.com/).

### 2. Opening the Project
1. Clone this repository or download the `absorbio-unity` folder.
2. Open **Unity Hub**.
3. Click **Add** and select the `absorbio-unity` folder.
4. Open the project in the Unity Editor.

### 3. Setting Up Firebase
1. Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2. Add an **Android** or **iOS** app to your Firebase project.
3. Download the `google-services.json` (for Android) or `GoogleService-Info.plist` (for iOS) and place it in the `Assets` folder of your Unity project.
4. Import the following Firebase Unity packages:
   - `FirebaseAnalytics.unitypackage`
   - `FirebaseAuth.unitypackage`
   - `FirebaseFirestore.unitypackage`
5. Ensure **Firestore** rules are set up to allow read/write access for authenticated users.

### 4. Running the Game
1. Open the `Assets/Scenes/MainScene` (you may need to create this scene and add the `GameManager`, `UIManager`, and `FirebaseManager` prefabs).
2. Press the **Play** button in the Unity Editor to start the game.

## Project Structure

- **Assets/Scripts:** Contains all C# scripts for game logic, UI, and Firebase.
- **Assets/Prefabs:** Placeholder for your game object prefabs (Player, Food, Enemy).
- **Assets/Scenes:** Contains the main game scene.
- **Assets/Materials:** Contains materials for visual effects.

## Core Scripts

| Script | Description |
| :--- | :--- |
| `PlayerController.cs` | Handles player movement, growth, and absorption. |
| `FoodItem.cs` | Defines properties for collectible food objects. |
| `EnemyController.cs` | Basic AI for enemies that the player can absorb. |
| `GameManager.cs` | Manages game state, spawning, and overall flow. |
| `UIManager.cs` | Updates the on-screen display with player stats. |
| `FirebaseManager.cs` | Handles authentication and data persistence with Firebase. |

## Future Enhancements
- **3D Graphics:** Easily upgrade the 2D sprites to 3D models for a more immersive experience.
- **Multiplayer:** Implement Unity's Netcode for GameObjects for real-time multiplayer.
- **Advanced AI:** Enhance enemy behavior with more complex pathfinding and states.

---
Developed by **Manus AI** for the Absorbio community.
