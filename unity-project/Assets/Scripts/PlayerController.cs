using UnityEngine;
using System.Collections;

public class PlayerController : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float growthRate = 0.1f;
    public float maxScale = 10f;
    public float absorptionRadiusMultiplier = 1.5f;
    public int score = 0;
    public int coins = 0;
    public int level = 1;
    public float xp = 0;
    public float xpToNextLevel = 200f;

    private Rigidbody2D rb;
    private Vector2 movement;
    private CircleCollider2D absorptionCollider;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        absorptionCollider = GetComponent<CircleCollider2D>();
        UpdateAbsorptionRadius();
    }

    void Update()
    {
        // Input for movement (can be adapted for joystick/touch input)
        movement.x = Input.GetAxisRaw("Horizontal");
        movement.y = Input.GetAxisRaw("Vertical");
    }

    void FixedUpdate()
    {
        rb.MovePosition(rb.position + movement * moveSpeed * Time.fixedDeltaTime);
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Food"))
        {
            FoodItem food = other.GetComponent<FoodItem>();
            if (food != null)
            {
                AbsorbFood(food);
            }
        }
        else if (other.CompareTag("Enemy") && other.transform.localScale.x < transform.localScale.x)
        {
            // Absorb smaller enemies
            EnemyController enemy = other.GetComponent<EnemyController>();
            if (enemy != null)
            {
                AbsorbEnemy(enemy);
            }
        }
    }

    void AbsorbFood(FoodItem food)
    {
        score += food.scoreValue;
        coins += food.coinValue;
        GainXP(food.xpValue);
        Grow(food.growthValue);
        Destroy(food.gameObject);
        Debug.Log($"Absorbed Food! Score: {score}, Coins: {coins}, XP: {xp}");
    }

    void AbsorbEnemy(EnemyController enemy)
    {
        score += enemy.scoreValue;
        coins += enemy.coinValue;
        GainXP(enemy.xpValue);
        Grow(enemy.growthValue);
        Destroy(enemy.gameObject);
        Debug.Log($"Absorbed Enemy! Score: {score}, Coins: {coins}, XP: {xp}");
    }

    void Grow(float amount)
    {
        Vector3 newScale = transform.localScale + Vector3.one * amount * growthRate;
        if (newScale.x < maxScale)
        {
            transform.localScale = newScale;
            UpdateAbsorptionRadius();
        }
    }

    void GainXP(float amount)
    {
        xp += amount;
        if (xp >= xpToNextLevel)
        {
            LevelUp();
        }
    }

    void LevelUp()
    {
        level++;
        xp -= xpToNextLevel;
        xpToNextLevel *= 1.2f; // Increase XP needed for next level
        moveSpeed *= 0.95f; // Slightly reduce speed as blackhole gets bigger
        Debug.Log($"Level Up! New Level: {level}");
    }

    void UpdateAbsorptionRadius()
    {
        if (absorptionCollider != null)
        {
            absorptionCollider.radius = transform.localScale.x * absorptionRadiusMultiplier;
        }
    }

    // Placeholder for external input (e.g., from UI joystick)
    public void SetMovement(Vector2 inputMovement)
    {
        movement = inputMovement;
    }
}
