import { prisma } from "../src/lib/db";
import { suggestCategory } from "../src/lib/categorize";

async function main() {
  const categories = await prisma.category.findMany();
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  const txs = await prisma.transaction.findMany({
    where: { categoryId: null },
  });

  console.log(`Found ${txs.length} uncategorized transactions.`);

  let updated = 0;
  for (const t of txs) {
    if (t.type === "transfer") {
      // Transfers don't have categories
      continue;
    }

    let suggestedCatName = suggestCategory(t.description);

    // Contextual heuristics for common descriptions
    const desc = t.description.toLowerCase();
    if (!suggestedCatName) {
      if (desc.includes("dhaba") || desc.includes("tiffin") || desc.includes("juice") || desc.includes("pani puri") || desc.includes("pista house") || desc.includes("cafeteria") || desc.includes("shawarma") || desc.includes("wrap") || desc.includes("tea") || desc.includes("biscuit") || desc.includes("drunken monkey") || desc.includes("noodles") || desc.includes("breakfast") || desc.includes("dinner") || desc.includes("lunch") || desc.includes("kochin spices") || desc.includes("chicken")) {
        suggestedCatName = "Food";
      } else if (desc.includes("pg") || desc.includes("rent") || desc.includes("advance")) {
        suggestedCatName = "Housing";
      } else if (desc.includes("auto") || desc.includes("fuel") || desc.includes("cng") || desc.includes("rapido") || desc.includes("bus") || desc.includes("train")) {
        suggestedCatName = "Transportation";
      } else if (desc.includes("movie") || desc.includes("ticket") || desc.includes("cinema")) {
        suggestedCatName = "Entertainment";
      } else if (desc.includes("pharmacy") || desc.includes("apollo") || desc.includes("bandaid")) {
        suggestedCatName = "Healthcare";
      } else if (desc.includes("fruit") || desc.includes("vegetable") || desc.includes("grocer")) {
        suggestedCatName = "Groceries";
      } else if (desc.includes("mom transferred") || desc.includes("aunt transferred") || desc.includes("bro") || desc.includes("friend")) {
        suggestedCatName = t.type === "income" ? "Other Income" : "Personal";
      } else if (desc.includes("deposited money") || desc.includes("cash")) {
        suggestedCatName = t.type === "income" ? "Other Income" : "Personal";
      }
    }

    if (suggestedCatName) {
      const catId = catByName.get(suggestedCatName.toLowerCase());
      if (catId) {
        await prisma.transaction.update({
          where: { id: t.id },
          data: { categoryId: catId },
        });
        console.log(`Categorized [${t.description}] -> ${suggestedCatName}`);
        updated++;
      }
    }
  }

  console.log(`\nSuccessfully categorized ${updated} transactions.`);
}

main().finally(() => prisma.$disconnect());
