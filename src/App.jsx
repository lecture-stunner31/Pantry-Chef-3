import React, { useState, useEffect } from 'react';

// Exclusion rules to prevent false matches (e.g., milk matching condensed milk)
const EXCLUSIONS = {
  milk: ['condensed', 'evaporated', 'coconut', 'almond', 'soy', 'oat', 'powdered', 'sweetened', 'butter'],
  apple: ['pineapple'],
  butter: ['peanut butter', 'apple butter', 'cocoa butter'],
  sugar: ['brown sugar', 'powdered sugar']
};

export default function App() {
  // Load initial pantry from browser localStorage
  const [pantry, setPantry] = useState(() => {
    const saved = localStorage.getItem('pantry_items');
    return saved ? JSON.parse(saved) : ['Milk', 'Eggs', 'Flour'];
  });

  const [input, setInput] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Persist pantry items to localStorage on change
  useEffect(() => {
    localStorage.setItem('pantry_items', JSON.stringify(pantry));
  }, [pantry]);

  const addIngredient = () => {
    if (input.trim() && !pantry.includes(input.trim())) {
      setPantry([...pantry, input.trim()]);
      setInput('');
    }
  };

  const removeIngredient = (item) => {
    setPantry(pantry.filter((i) => i !== item));
  };

  const matchesPantryItem = (pantryItem, recipeIng) => {
    const p = pantryItem.toLowerCase().trim();
    const r = recipeIng.toLowerCase().trim();

    if (!r.includes(p)) return false;

    // Check exclusion rules
    if (EXCLUSIONS[p]) {
      const forbidden = EXCLUSIONS[p];
      const hasForbidden = forbidden.some((mod) => r.includes(mod));
      if (hasForbidden && !p.includes(mod)) return false;
    }
    return true;
  };

  const searchRecipes = async () => {
    if (pantry.length === 0) return;
    setLoading(true);
    setError('');

    const appId = import.meta.env.VITE_EDAMAM_APP_ID;
    const appKey = import.meta.env.VITE_EDAMAM_APP_KEY;
    const query = encodeURIComponent(pantry.join(', '));
    const maxIngr = pantry.length + 2;

    try {
      const res = await fetch(
        `https://api.edamam.com/api/recipes/v2?type=public&q=${query}&app_id=${appId}&app_key=${appKey}&ingr=${maxIngr}`
      );
      const data = await res.json();

      if (!data.hits || data.hits.length === 0) {
        setRecipes([]);
        setLoading(false);
        return;
      }

      const results = data.hits
        .map((hit) => {
          const recipe = hit.recipe;
          const ingredientLines = recipe.ingredientLines || [];

          const matched = [];
          const missing = [];

          ingredientLines.forEach((ing) => {
            const isMatch = pantry.some((p) => matchesPantryItem(p, ing));
            if (isMatch) {
              matched.push(ing);
            } else {
              missing.push(ing);
            }
          });

          return {
            id: recipe.uri,
            title: recipe.label,
            time: recipe.totalTime ? `${recipe.totalTime} mins` : 'N/A',
            matched,
            missing,
          };
        })
        .filter((r) => r.missing.length <= 2); // Max 2 missing ingredients constraint

      setRecipes(results);
    } catch (err) {
      setError('Unable to fetch recipes. Ensure your Edamam API keys are set.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Pantry Recipe Finder</h1>

      <div className="card">
        <h3>Your Pantry Items</h3>
        <div className="input-group">
          <input
            type="text"
            placeholder="Add ingredient (e.g. Milk, Eggs)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
          />
          <button onClick={addIngredient}>Add</button>
        </div>

        <div>
          {pantry.map((item) => (
            <span key={item} className="tag">
              {item}
              <button onClick={() => removeIngredient(item)}>×</button>
            </span>
          ))}
        </div>

        <button onClick={searchRecipes} style={{ marginTop: '15px', width: '100%' }}>
          {loading ? 'Searching Recipes...' : 'Find Recipes'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {recipes.length > 0 &&
        recipes.map((r) => (
          <div key={r.id} className="recipe">
            <h2>{r.title}</h2>
            <p><strong>Prep Time:</strong> {r.time}</p>
            <div className="grid">
              <div>
                <h4 className="text-green">✓ From Your Pantry</h4>
                <ul>
                  {r.matched.map((ing, idx) => (
                    <li key={idx}>{ing}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-orange">⚠ Additional Needed</h4>
                <ul>
                  {r.missing.map((ing, idx) => (
                    <li key={idx}>{ing}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}

      {!loading && recipes.length === 0 && (
        <p>No recipes found matching your criteria. Try updating your pantry list.</p>
      )}
    </div>
  );
}