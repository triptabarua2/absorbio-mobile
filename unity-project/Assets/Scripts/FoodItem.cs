using UnityEngine;

public class FoodItem : MonoBehaviour
{
    public int scoreValue = 10;
    public int coinValue = 1;
    public float xpValue = 5f;
    public float growthValue = 0.1f;
    public float minScale = 0.5f;
    public float maxScale = 1.5f;

    void Start()
    {
        // Randomize scale for visual variety
        float scale = Random.Range(minScale, maxScale);
        transform.localScale = new Vector3(scale, scale, 1f);
    }
}
