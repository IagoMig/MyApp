import type { CustomFood } from "./db";

export interface FoodReference {
  name: string;
  kcalPer100g: number;
  defaultGrams: number;
  unitGrams?: number;
  aliases?: string[];
}

export const TACO_FOODS: FoodReference[] = [
  // Grãos, massas e carboidratos
  { name: "Arroz branco cozido", kcalPer100g: 128, defaultGrams: 150, aliases: ["arroz", "arroz branco"] },
  { name: "Arroz integral cozido", kcalPer100g: 124, defaultGrams: 150, aliases: ["arroz integral"] },
  { name: "Feijão carioca cozido", kcalPer100g: 76, defaultGrams: 100, unitGrams: 85, aliases: ["feijao", "feijao carioca"] },
  { name: "Feijão preto cozido", kcalPer100g: 77, defaultGrams: 100, unitGrams: 85, aliases: ["feijao preto"] },
  { name: "Lentilha cozida", kcalPer100g: 93, defaultGrams: 100, aliases: ["lentilha"] },
  { name: "Grão-de-bico cozido", kcalPer100g: 164, defaultGrams: 100, aliases: ["grao de bico"] },
  { name: "Macarrão cozido", kcalPer100g: 158, defaultGrams: 150, aliases: ["macarrao", "massa", "espaguete"] },
  { name: "Batata inglesa cozida", kcalPer100g: 52, defaultGrams: 150, aliases: ["batata", "batata cozida"] },
  { name: "Batata doce cozida", kcalPer100g: 77, defaultGrams: 150, aliases: ["batata doce"] },
  { name: "Purê de batata", kcalPer100g: 98, defaultGrams: 150, aliases: ["pure", "pure de batata"] },
  { name: "Mandioca cozida", kcalPer100g: 125, defaultGrams: 120, aliases: ["mandioca", "aipim", "macaxeira"] },
  { name: "Cuscuz de milho", kcalPer100g: 113, defaultGrams: 150, aliases: ["cuscuz"] },
  { name: "Tapioca (goma hidratada)", kcalPer100g: 240, defaultGrams: 70, unitGrams: 70, aliases: ["tapioca"] },
  { name: "Pão francês", kcalPer100g: 300, defaultGrams: 50, unitGrams: 50, aliases: ["pao frances", "pao", "paozinho"] },
  { name: "Pão de forma integral", kcalPer100g: 253, defaultGrams: 50, unitGrams: 25, aliases: ["pao integral", "pao de forma"] },
  { name: "Pão de queijo", kcalPer100g: 363, defaultGrams: 60, unitGrams: 30, aliases: ["pao de queijo"] },
  { name: "Aveia em flocos", kcalPer100g: 394, defaultGrams: 40, unitGrams: 15, aliases: ["aveia"] },
  { name: "Granola", kcalPer100g: 421, defaultGrams: 40, aliases: ["granola"] },
  { name: "Farofa pronta", kcalPer100g: 406, defaultGrams: 30, unitGrams: 15, aliases: ["farofa"] },
  { name: "Biscoito de arroz", kcalPer100g: 385, defaultGrams: 20, unitGrams: 7, aliases: ["biscoito arroz", "bolacha arroz"] },

  // Proteínas
  { name: "Peito de frango grelhado", kcalPer100g: 159, defaultGrams: 150, aliases: ["frango", "peito de frango", "frango grelhado"] },
  { name: "Frango desfiado cozido", kcalPer100g: 163, defaultGrams: 120, aliases: ["frango desfiado"] },
  { name: "Coxa / sobrecoxa assada", kcalPer100g: 215, defaultGrams: 150, aliases: ["sobrecoxa", "coxa de frango"] },
  { name: "Patinho moído refogado", kcalPer100g: 219, defaultGrams: 150, aliases: ["patinho", "carne moida", "carne"] },
  { name: "Alcatra grelhada", kcalPer100g: 241, defaultGrams: 150, aliases: ["alcatra", "bife"] },
  { name: "Contrafilé grelhado", kcalPer100g: 278, defaultGrams: 150, aliases: ["contrafile", "contra file"] },
  { name: "Filé mignon grelhado", kcalPer100g: 220, defaultGrams: 150, aliases: ["file mignon", "mignon"] },
  { name: "Lombo suíno assado", kcalPer100g: 210, defaultGrams: 150, aliases: ["lombo", "porco", "carne de porco"] },
  { name: "Ovo cozido", kcalPer100g: 146, defaultGrams: 100, unitGrams: 50, aliases: ["ovo", "ovos", "ovo cozido"] },
  { name: "Ovo mexido", kcalPer100g: 168, defaultGrams: 100, unitGrams: 55, aliases: ["ovo mexido", "ovos mexidos", "omelete"] },
  { name: "Clara de ovo cozida", kcalPer100g: 52, defaultGrams: 100, unitGrams: 35, aliases: ["clara", "clara de ovo"] },
  { name: "Filé de tilápia grelhado", kcalPer100g: 128, defaultGrams: 150, aliases: ["tilapia", "peixe"] },
  { name: "Salmão grelhado", kcalPer100g: 229, defaultGrams: 150, aliases: ["salmao"] },
  { name: "Atum em água (escorrido)", kcalPer100g: 116, defaultGrams: 120, unitGrams: 120, aliases: ["atum"] },
  { name: "Sardinha em óleo", kcalPer100g: 285, defaultGrams: 84, aliases: ["sardinha"] },
  { name: "Camarão cozido", kcalPer100g: 99, defaultGrams: 120, aliases: ["camarao"] },
  { name: "Tofu firme", kcalPer100g: 76, defaultGrams: 120, aliases: ["tofu"] },
  { name: "Whey protein", kcalPer100g: 400, defaultGrams: 30, unitGrams: 30, aliases: ["whey", "proteina", "scoop"] },
  { name: "Peito de peru fatiado", kcalPer100g: 104, defaultGrams: 40, unitGrams: 20, aliases: ["peito de peru"] },
  { name: "Presunto magro", kcalPer100g: 110, defaultGrams: 40, unitGrams: 20, aliases: ["presunto"] },

  // Laticínios
  { name: "Leite integral", kcalPer100g: 61, defaultGrams: 200, unitGrams: 200, aliases: ["leite", "leite integral"] },
  { name: "Leite desnatado", kcalPer100g: 35, defaultGrams: 200, unitGrams: 200, aliases: ["leite desnatado"] },
  { name: "Iogurte natural integral", kcalPer100g: 61, defaultGrams: 170, unitGrams: 170, aliases: ["iogurte", "iogurte natural"] },
  { name: "Iogurte natural desnatado", kcalPer100g: 41, defaultGrams: 170, unitGrams: 170, aliases: ["iogurte desnatado"] },
  { name: "Queijo minas frescal", kcalPer100g: 264, defaultGrams: 40, unitGrams: 30, aliases: ["queijo minas", "queijo branco"] },
  { name: "Queijo mussarela", kcalPer100g: 330, defaultGrams: 30, unitGrams: 20, aliases: ["mussarela", "queijo", "mucarela"] },
  { name: "Queijo cottage", kcalPer100g: 98, defaultGrams: 50, aliases: ["cottage"] },
  { name: "Requeijão cremoso", kcalPer100g: 257, defaultGrams: 30, unitGrams: 20, aliases: ["requeijao"] },
  { name: "Requeijão light", kcalPer100g: 170, defaultGrams: 30, unitGrams: 20, aliases: ["requeijao light"] },
  { name: "Manteiga", kcalPer100g: 726, defaultGrams: 10, unitGrams: 10, aliases: ["manteiga"] },

  // Frutas
  { name: "Banana prata", kcalPer100g: 98, defaultGrams: 90, unitGrams: 90, aliases: ["banana"] },
  { name: "Maçã", kcalPer100g: 56, defaultGrams: 130, unitGrams: 130, aliases: ["maca"] },
  { name: "Mamão papaia", kcalPer100g: 40, defaultGrams: 150, unitGrams: 150, aliases: ["mamao"] },
  { name: "Melancia", kcalPer100g: 33, defaultGrams: 200, aliases: ["melancia"] },
  { name: "Melão", kcalPer100g: 29, defaultGrams: 150, aliases: ["melao"] },
  { name: "Morango", kcalPer100g: 30, defaultGrams: 100, aliases: ["morango"] },
  { name: "Uva", kcalPer100g: 53, defaultGrams: 100, aliases: ["uva"] },
  { name: "Laranja", kcalPer100g: 45, defaultGrams: 150, unitGrams: 150, aliases: ["laranja"] },
  { name: "Abacaxi", kcalPer100g: 48, defaultGrams: 120, aliases: ["abacaxi"] },
  { name: "Manga", kcalPer100g: 64, defaultGrams: 140, aliases: ["manga"] },
  { name: "Abacate", kcalPer100g: 96, defaultGrams: 100, aliases: ["abacate"] },
  { name: "Açaí (polpa sem açúcar)", kcalPer100g: 58, defaultGrams: 150, aliases: ["acai puro"] },
  { name: "Açaí com xarope", kcalPer100g: 110, defaultGrams: 250, aliases: ["acai"] },

  // Legumes e verduras
  { name: "Salada verde (alface, rúcula)", kcalPer100g: 15, defaultGrams: 80, aliases: ["salada", "alface", "rucula", "folhas"] },
  { name: "Tomate", kcalPer100g: 15, defaultGrams: 100, unitGrams: 100, aliases: ["tomate"] },
  { name: "Brócolis cozido", kcalPer100g: 25, defaultGrams: 100, aliases: ["brocolis"] },
  { name: "Cenoura cozida", kcalPer100g: 30, defaultGrams: 80, aliases: ["cenoura"] },
  { name: "Abobrinha refogada", kcalPer100g: 32, defaultGrams: 100, aliases: ["abobrinha"] },
  { name: "Couve refogada", kcalPer100g: 90, defaultGrams: 60, aliases: ["couve"] },
  { name: "Legumes cozidos no vapor", kcalPer100g: 42, defaultGrams: 120, aliases: ["legumes"] },

  // Gorduras boas e oleaginosas
  { name: "Azeite de oliva", kcalPer100g: 884, defaultGrams: 10, unitGrams: 10, aliases: ["azeite"] },
  { name: "Pasta de amendoim", kcalPer100g: 588, defaultGrams: 20, unitGrams: 15, aliases: ["pasta de amendoim", "amendoim pasta"] },
  { name: "Amendoim torrado", kcalPer100g: 585, defaultGrams: 30, aliases: ["amendoim"] },
  { name: "Castanha-do-pará", kcalPer100g: 643, defaultGrams: 20, unitGrams: 5, aliases: ["castanha", "castanha do para"] },
  { name: "Castanha de caju", kcalPer100g: 570, defaultGrams: 25, aliases: ["castanha de caju"] },
  { name: "Chia / linhaça", kcalPer100g: 486, defaultGrams: 15, unitGrams: 10, aliases: ["chia", "linhaca"] },

  // Bebidas e extras comuns
  { name: "Café preto sem açúcar", kcalPer100g: 2, defaultGrams: 100, unitGrams: 100, aliases: ["cafe", "cafe preto"] },
  { name: "Café com leite", kcalPer100g: 42, defaultGrams: 200, unitGrams: 200, aliases: ["cafe com leite"] },
  { name: "Suco de laranja natural", kcalPer100g: 45, defaultGrams: 250, unitGrams: 250, aliases: ["suco", "suco de laranja"] },
  { name: "Água de coco", kcalPer100g: 22, defaultGrams: 250, unitGrams: 250, aliases: ["agua de coco"] },
  { name: "Mel", kcalPer100g: 309, defaultGrams: 15, unitGrams: 15, aliases: ["mel"] },
  { name: "Chocolate 70%", kcalPer100g: 550, defaultGrams: 25, aliases: ["chocolate", "chocolate amargo"] },
  { name: "Hambúrguer artesanal", kcalPer100g: 250, defaultGrams: 220, unitGrams: 220, aliases: ["hamburguer", "burger", "lanche"] },
  { name: "Pizza (fatia)", kcalPer100g: 266, defaultGrams: 110, unitGrams: 110, aliases: ["pizza"] },
  { name: "Batata frita", kcalPer100g: 267, defaultGrams: 100, aliases: ["batata frita", "fritas"] },
  { name: "Strogonoff de frango", kcalPer100g: 158, defaultGrams: 180, aliases: ["strogonoff", "estrogonofe"] },
  { name: "Feijoada", kcalPer100g: 145, defaultGrams: 250, aliases: ["feijoada"] },
  { name: "Lasanha à bolonhesa", kcalPer100g: 165, defaultGrams: 250, aliases: ["lasanha"] },
  { name: "Tapioca com ovo e queijo", kcalPer100g: 215, defaultGrams: 160, unitGrams: 160, aliases: ["tapioca com ovo", "crepioca"] },
  { name: "Pão com ovo", kcalPer100g: 225, defaultGrams: 110, unitGrams: 110, aliases: ["pao com ovo"] },
];

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function computeKcal(kcalPer100g: number, grams: number): number {
  return Math.round((kcalPer100g * Math.max(0, grams)) / 100);
}

export function getAllFoods(customFoods: CustomFood[] = []): FoodReference[] {
  const custom: FoodReference[] = customFoods.map((cf) => ({
    name: cf.name,
    kcalPer100g: cf.kcalPer100g,
    defaultGrams: cf.defaultGrams,
  }));
  return [...custom, ...TACO_FOODS];
}

export function searchFoods(
  query: string,
  customFoods: CustomFood[] = [],
  limit = 7
): FoodReference[] {
  const q = normalizeText(query);
  const all = getAllFoods(customFoods);
  if (!q) return all.slice(0, limit);

  const scored = all
    .map((food) => {
      const nameNorm = normalizeText(food.name);
      const aliasNorms = (food.aliases ?? []).map(normalizeText);
      let score = 0;

      if (nameNorm === q || aliasNorms.includes(q)) score = 100;
      else if (nameNorm.startsWith(q) || aliasNorms.some((a) => a.startsWith(q)))
        score = 80;
      else if (
        nameNorm.includes(q) ||
        aliasNorms.some((a) => a.includes(q))
      )
        score = 50;
      else {
        const tokens = q.split(/\s+/).filter(Boolean);
        if (
          tokens.length > 1 &&
          tokens.every(
            (t) => nameNorm.includes(t) || aliasNorms.some((a) => a.includes(t))
          )
        ) {
          score = 40;
        }
      }
      return { food, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.food);
}

export interface ParsedQuickItem {
  name: string;
  grams: number;
  kcal: number;
}

/**
 * Parses quick natural meal strings like "200g arroz, 150g frango, 2 ovos"
 * completely offline using the local TACO table + custom foods.
 */
export function parseQuickMealLine(
  input: string,
  customFoods: CustomFood[] = []
): ParsedQuickItem[] {
  const segments = input
    .split(/[,;\n+]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: ParsedQuickItem[] = [];

  for (const segment of segments) {
    // Match patterns like "200g arroz", "200 g de arroz", "150ml leite", "3 ovos", "arroz 200g"
    let grams: number | null = null;
    let unitCount: number | null = null;
    let foodQuery = segment;

    const leadingGrams = segment.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?|ml)\s+(?:de\s+)?(.+)$/i);
    const trailingGrams = segment.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?|ml)$/i);
    const leadingUnits = segment.match(
      /^(\d+(?:[.,]\d+)?)\s*(?:x|un|und|unidades?|fatias?|colheres?|conchas?|scoops?|copos?)?\s+(?:de\s+)?(.+)$/i
    );

    if (leadingGrams) {
      grams = Math.round(parseFloat(leadingGrams[1].replace(",", ".")));
      foodQuery = leadingGrams[3].trim();
    } else if (trailingGrams) {
      grams = Math.round(parseFloat(trailingGrams[2].replace(",", ".")));
      foodQuery = trailingGrams[1].trim();
    } else if (leadingUnits) {
      unitCount = parseFloat(leadingUnits[1].replace(",", "."));
      foodQuery = leadingUnits[2].trim();
    }

    const matches = searchFoods(foodQuery, customFoods, 1);
    if (matches.length > 0) {
      const food = matches[0];
      const finalGrams =
        grams !== null
          ? grams
          : unitCount !== null
            ? Math.round(unitCount * (food.unitGrams ?? food.defaultGrams))
            : food.defaultGrams;

      results.push({
        name: food.name,
        grams: finalGrams,
        kcal: computeKcal(food.kcalPer100g, finalGrams),
      });
    }
  }

  return results;
}
