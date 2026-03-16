using UnityEngine;
using System.Collections.Generic;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    public GameObject playerPrefab;
    public GameObject foodPrefab;
    public GameObject enemyPrefab;

    public int initialFoodCount = 50;
    public int initialEnemyCount = 10;
    public float spawnRadius = 10f;
    public float foodSpawnInterval = 2f;
    public float enemySpawnInterval = 5f;

    private PlayerController player;
    private float foodSpawnTimer;
    private float enemySpawnTimer;

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
        }
        else
        {
            Instance = this;
        }
    }

    void Start()
    {
        SpawnPlayer();
        SpawnInitialObjects();

        foodSpawnTimer = foodSpawnInterval;
        enemySpawnTimer = enemySpawnInterval;
    }

    void Update()
    {
        foodSpawnTimer -= Time.deltaTime;
        if (foodSpawnTimer <= 0)
        {
            SpawnFood();
            foodSpawnTimer = foodSpawnInterval;
        }

        enemySpawnTimer -= Time.deltaTime;
        if (enemySpawnTimer <= 0)
        {
            SpawnEnemy();
            enemySpawnTimer = enemySpawnInterval;
        }
    }

    void SpawnPlayer()
    {
        GameObject playerObj = Instantiate(playerPrefab, Vector3.zero, Quaternion.identity);
        player = playerObj.GetComponent<PlayerController>();
    }

    void SpawnInitialObjects()
    {
        for (int i = 0; i < initialFoodCount; i++)
        {
            SpawnFood();
        }
        for (int i = 0; i < initialEnemyCount; i++)
        {
            SpawnEnemy();
        }
    }

    void SpawnFood()
    {
        Vector3 randomPos = GetRandomSpawnPosition();
        Instantiate(foodPrefab, randomPos, Quaternion.identity);
    }

    void SpawnEnemy()
    {
        Vector3 randomPos = GetRandomSpawnPosition();
        Instantiate(enemyPrefab, randomPos, Quaternion.identity);
    }

    Vector3 GetRandomSpawnPosition()
    {
        Vector2 randomCircle = Random.insideUnitCircle * spawnRadius;
        return new Vector3(randomCircle.x, randomCircle.y, 0);
    }

    public PlayerController GetPlayer()
    {
        return player;
    }
}
