/**
 * Deterministic transaction categorization.
 *
 * Given a free-text description, suggest a category NAME by matching known
 * merchants and keywords. This is 100% rule-based — no AI or network calls —
 * so basic functionality never depends on an external service.
 *
 * The caller maps the returned category name to the user's actual category row
 * (falling back to "Other" when the user has no matching category).
 */

export interface CategoryRule {
  /** Category name this rule resolves to (must match a default category). */
  category: string;
  /** Lowercased keywords/merchants. Word-boundary matched against description. */
  keywords: string[];
}

/** Ordered rules — earlier, more specific rules win ties by keyword length. */
export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Food",
    keywords: [
      "swiggy", "zomato", "dominos", "domino", "pizza", "mcdonald", "kfc", "burger",
      "restaurant", "cafe", "coffee", "starbucks", "chai", "tea", "biscuit", "dinner", "lunch",
      "breakfast", "tiffin", "dhaba", "juice", "pani puri", "pista house", "cafeteria",
      "shawarma", "noodles", "drunken monkey", "milkshake", "shake", "wrap", "spices",
      "kochin spices", "chicken", "biryani", "eatfit", "faasos", "dunzo food", "food",
      "bakery", "cake", "sweets", "chaat", "momos", "dosa", "idli", "curry", "thali",
      "ice cream", "kulfi", "snack", "snacks",
    ],
  },
  {
    category: "Groceries",
    keywords: [
      "bigbasket", "big basket", "blinkit", "zepto", "grofers", "dmart", "d-mart",
      "reliance fresh", "more supermarket", "grocery", "groceries", "supermarket",
      "kirana", "vegetables", "vegetable", "fruit", "fruits", "milk", "dairy", "instamart",
    ],
  },
  {
    category: "Transportation",
    keywords: [
      "uber", "ola", "rapido", "auto", "cab", "taxi", "metro", "bus", "irctc",
      "train", "petrol", "diesel", "fuel", "cng", "fastag", "parking", "namma yatri",
      "redbus", "toll", "bus ticket", "train ticket", "koyambedu",
    ],
  },
  {
    category: "Subscriptions",
    keywords: [
      "netflix", "spotify", "prime video", "amazon prime", "hotstar", "disney",
      "youtube premium", "sony liv", "zee5", "apple music", "icloud", "google one",
      "subscription", "gaana", "audible", "canva", "notion", "chatgpt", "openai",
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "tatacliq",
      "snapdeal", "shopping", "decathlon", "ikea", "lifestyle", "shoppers stop",
      "croma", "reliance digital",
    ],
  },
  {
    category: "Bills & Utilities",
    keywords: [
      "jio", "airtel", "vi ", "vodafone", "bsnl", "recharge", "electricity",
      "water bill", "gas bill", "broadband", "wifi", "internet", "bescom", "tneb",
      "adani electricity", "tata power", "bill payment", "postpaid", "dth",
      "act fibernet", "hathway",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "bookmyshow", "pvr", "inox", "cinema", "movie", "movie ticket", "game", "steam",
      "playstation", "xbox", "concert", "event", "brand new day", "atrium mall",
    ],
  },
  {
    category: "Healthcare",
    keywords: [
      "pharmacy", "apollo", "pharmeasy", "1mg", "netmeds", "hospital", "clinic",
      "doctor", "medical", "medicine", "practo", "diagnostic", "lab test",
      "bandaid", "cult.fit", "cultfit", "gym",
    ],
  },
  {
    category: "Education",
    keywords: [
      "udemy", "coursera", "byju", "unacademy", "vedantu", "college fee",
      "school fee", "tuition", "course", "exam fee", "books", "upgrad", "great learning",
    ],
  },
  {
    category: "Travel",
    keywords: [
      "makemytrip", "goibibo", "cleartrip", "yatra", "ixigo", "oyo", "airbnb",
      "hotel", "flight", "indigo", "vistara", "air india", "spicejet", "ola outstation",
      "booking.com", "trip",
    ],
  },
  {
    category: "Housing",
    keywords: ["rent", "maintenance", "society", "landlord", "housing", "brokerage", "pg", "hostel", "advance", "deposit"],
  },
  {
    category: "Bank Charges",
    keywords: [
      "bank charge", "atm fee", "annual fee", "processing fee", "convenience fee",
      "gst", "sms charges", "penalty", "late fee",
    ],
  },
  {
    category: "Family",
    keywords: ["school", "daycare", "toys", "baby", "kids", "family", "mom transferred", "aunt transferred", "dad transferred", "brother", "sister"],
  },
  {
    category: "Salary",
    keywords: ["salary", "payroll", "stipend", "wages"],
  },
  {
    category: "Business",
    keywords: ["invoice", "client payment", "freelance", "consulting", "business income"],
  },
  {
    category: "Investments",
    keywords: ["dividend", "interest credit", "mutual fund redemption", "capital gain", "sip return"],
  },
  {
    category: "Other Income",
    keywords: ["deposited money", "cash deposit", "refund received", "cash back", "cashback", "reward"],
  },
];

/**
 * Suggest a category name for a description. Returns null when nothing matches
 * confidently, so the caller can leave the field for the user to fill.
 */
export function suggestCategory(description: string): string | null {
  const text = ` ${description.toLowerCase().trim()} `;
  if (text.trim() === "") return null;

  let best: { category: string; score: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (matchesKeyword(text, kw)) {
        const score = kw.length; // longer, more specific keyword wins
        if (!best || score > best.score) best = { category: rule.category, score };
      }
    }
  }
  return best?.category ?? null;
}

function matchesKeyword(haystack: string, keyword: string): boolean {
  // Word-ish boundary match: keyword surrounded by non-alphanumerics.
  const idx = haystack.indexOf(keyword);
  if (idx === -1) return false;
  const before = haystack[idx - 1];
  const after = haystack[idx + keyword.length];
  const boundary = (c: string | undefined) => c === undefined || !/[a-z0-9]/.test(c);
  return boundary(before) && boundary(after);
}

/** Extract a likely merchant name from a description (first meaningful token). */
export function guessMerchant(description: string): string | null {
  const cleaned = description.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const stop = new Set(["to", "for", "at", "the", "a", "an", "my", "on", "from", "paid", "payment"]);
  const first = cleaned.split(" ").find((w) => !stop.has(w.toLowerCase()));
  return first ? first.replace(/[^a-zA-Z0-9.&' -]/g, "") || null : null;
}
