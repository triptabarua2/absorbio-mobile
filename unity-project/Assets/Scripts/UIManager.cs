using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class UIManager : MonoBehaviour
{
    public static UIManager Instance { get; private set; }

    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI coinText;
    public TextMeshProUGUI levelText;
    public Slider xpSlider;
    public TextMeshProUGUI xpText;

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

    public void UpdateUI(int score, int coins, int level, float currentXP, float xpToNextLevel)
    {
        scoreText.text = $"Score: {score}";
        coinText.text = $"Coins: {coins}";
        levelText.text = $"Level: {level}";
        xpSlider.maxValue = xpToNextLevel;
        xpSlider.value = currentXP;
        xpText.text = $"{currentXP}/{xpToNextLevel} XP";
    }
}
