using UnityEngine;
using System.Collections.Generic;
using Firebase;
using Firebase.Auth;
using Firebase.Firestore;
using System.Threading.Tasks;

public class FirebaseManager : MonoBehaviour
{
    public static FirebaseManager Instance { get; private set; }

    FirebaseAuth auth;
    FirebaseFirestore db;
    FirebaseApp app;

    public string userId { get; private set; }
    public UserData currentUserData { get; private set; }

    // Structure to hold user data, similar to the web app
    [System.Serializable]
    public class UserData
    {
        public string uid;
        public string name;
        public string email;
        public int level;
        public float xp;
        public int coins;
        public string provider;
        public Dictionary<string, int> inventory; // Example: {"magnet": 0, "speed": 0}

        public UserData()
        {
            uid = "";
            name = "Player";
            email = "";
            level = 1;
            xp = 0;
            coins = 50;
            provider = "anonymous";
            inventory = new Dictionary<string, int>();
            inventory.Add("magnet", 0);
            inventory.Add("speed", 0);
            inventory.Add("double", 0);
        }
    }

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
        }
        else
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
    }

    void Start()
    {
        InitializeFirebase();
    }

    void InitializeFirebase()
    {
        FirebaseApp.CheckAndFixDependenciesAsync().ContinueWith(task => {
            var dependencyStatus = task.Result;
            if (dependencyStatus == DependencyStatus.Available)
            {
                app = FirebaseApp.DefaultInstance;
                auth = FirebaseAuth.DefaultInstance;
                db = FirebaseFirestore.DefaultInstance;
                Debug.Log("Firebase initialized successfully!");
                // Optionally sign in anonymously or check for existing user
                SignInAnonymously();
            }
            else
            {
                Debug.LogError($"Could not resolve all Firebase dependencies: {dependencyStatus}");
            }
        });
    }

    public async void SignInAnonymously()
    {
        try
        {
            AuthResult result = await auth.SignInAnonymouslyAsync();
            FirebaseUser user = result.User;
            userId = user.UserId;
            Debug.Log($"Signed in anonymously: {userId}");
            await LoadUserData(userId);
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"Anonymous sign-in failed: {ex.Message}");
        }
    }

    public async Task LoadUserData(string uid)
    {
        DocumentReference docRef = db.Collection("absorbio_users").Document(uid);
        DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

        if (snapshot.Exists)
        {
            currentUserData = snapshot.ConvertTo<UserData>();
            Debug.Log($"User data loaded for {uid}: Level {currentUserData.level}, Coins {currentUserData.coins}");
        }
        else
        {
            Debug.Log($"No user data found for {uid}. Initializing new data.");
            currentUserData = new UserData { uid = uid };
            await SaveUserData(currentUserData);
        }
    }

    public async Task SaveUserData(UserData data)
    {
        DocumentReference docRef = db.Collection("absorbio_users").Document(data.uid);
        await docRef.SetAsync(data);
        Debug.Log($"User data saved for {data.uid}");
    }

    public async Task UpdatePlayerStats(int newScore, int newCoins, int newLevel, float newXP)
    {
        if (currentUserData == null) return;

        currentUserData.coins = newCoins;
        currentUserData.level = newLevel;
        currentUserData.xp = newXP;

        DocumentReference docRef = db.Collection("absorbio_users").Document(currentUserData.uid);
        Dictionary<string, object> updates = new Dictionary<string, object>
        {
            { "coins", newCoins },
            { "level", newLevel },
            { "xp", newXP }
        };
        await docRef.UpdateAsync(updates);
        Debug.Log("Player stats updated in Firestore.");
    }

    public async Task UpdateInventory(string itemId, string category, int quantityChange)
    {
        if (currentUserData == null) return;

        if (currentUserData.inventory.ContainsKey(category))
        {
            currentUserData.inventory[category] += quantityChange;
        }
        else
        {
            currentUserData.inventory.Add(category, quantityChange);
        }

        DocumentReference docRef = db.Collection("absorbio_users").Document(currentUserData.uid);
        Dictionary<string, object> updates = new Dictionary<string, object>
        {
            { $"inventory.{category}", currentUserData.inventory[category] }
        };
        await docRef.UpdateAsync(updates);
        Debug.Log($"Inventory updated for {category}: {itemId}");
    }
}
