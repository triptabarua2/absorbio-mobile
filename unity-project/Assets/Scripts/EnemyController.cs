using UnityEngine;

public class EnemyController : MonoBehaviour
{
    public float moveSpeed = 2f;
    public int scoreValue = 20;
    public int coinValue = 2;
    public float xpValue = 10f;
    public float growthValue = 0.2f;
    public float minScale = 0.8f;
    public float maxScale = 2.0f;

    private Transform playerTransform;
    private Rigidbody2D rb;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        playerTransform = GameObject.FindGameObjectWithTag("Player").transform;

        // Randomize scale for visual variety
        float scale = Random.Range(minScale, maxScale);
        transform.localScale = new Vector3(scale, scale, 1f);
    }

    void FixedUpdate()
    {
        if (playerTransform != null)
        {
            Vector2 direction = (playerTransform.position - transform.position).normalized;
            rb.MovePosition(rb.position + direction * moveSpeed * Time.fixedDeltaTime);
        }
    }
}
