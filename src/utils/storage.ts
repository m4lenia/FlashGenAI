import { Deck, Flashcard, UserStudyStats } from '../types';
import { SAMPLE_DECKS } from './initialDecks';

const THEME_KEY = 'flashgen_theme_v1';

export function getDeckStorageKey(userId?: string | null): string {
  return userId ? `flashgen_decks_${userId}` : 'flashgen_decks_guest';
}

export function getStatsStorageKey(userId?: string | null): string {
  return userId ? `flashgen_stats_${userId}` : 'flashgen_stats_guest';
}

export function getTestsStorageKey(userId?: string | null): string {
  return userId ? `flashgen_tests_${userId}` : 'flashgen_tests_guest';
}

export function loadDecks(userId?: string | null): Deck[] {
  try {
    const key = getDeckStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // If guest and no legacy decks, migrate or use SAMPLE_DECKS
      if (!userId) {
        const legacy = localStorage.getItem('flashgen_decks_v1');
        if (legacy) return JSON.parse(legacy);
      }
      return SAMPLE_DECKS.map((d) => ({ ...d, userId: userId || undefined }));
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return SAMPLE_DECKS.map((d) => ({ ...d, userId: userId || undefined }));
  } catch (err) {
    console.error('Error loading decks from storage:', err);
    return SAMPLE_DECKS.map((d) => ({ ...d, userId: userId || undefined }));
  }
}

export function saveDecks(decks: Deck[], userId?: string | null): void {
  try {
    const key = getDeckStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(decks));
  } catch (err) {
    console.error('Error saving decks to storage:', err);
  }
}

export function loadStats(userId?: string | null): UserStudyStats {
  try {
    const key = getStatsStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
  return {
    streak: 1,
    lastStudyDate: new Date().toISOString(),
    totalReviewsCompleted: 0,
    studyTimeMinutes: 0,
    testsCompleted: 0,
    averageTestScore: 0,
  };
}

export function saveStats(stats: UserStudyStats, userId?: string | null): void {
  try {
    const key = getStatsStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(stats));
  } catch (e) {
    console.error('Error saving stats:', e);
  }
}

export function recordStudySession(reviewsCount: number, userId?: string | null): UserStudyStats {
  const current = loadStats(userId);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  let newStreak = current.streak;
  if (!current.lastStudyDate) {
    newStreak = 1;
  } else {
    const lastDateStr = current.lastStudyDate.slice(0, 10);
    if (lastDateStr === todayStr) {
      // Already studied today
      newStreak = current.streak;
    } else {
      const lastDate = new Date(lastDateStr);
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        newStreak = current.streak + 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    }
  }

  const updated: UserStudyStats = {
    ...current,
    streak: Math.max(1, newStreak),
    lastStudyDate: now.toISOString(),
    totalReviewsCompleted: current.totalReviewsCompleted + reviewsCount,
    studyTimeMinutes: (current.studyTimeMinutes || 0) + Math.max(1, Math.round(reviewsCount * 0.75)),
  };

  saveStats(updated, userId);
  return updated;
}

export function getStoredTheme(): 'dark' | 'light' {
  try {
    const val = localStorage.getItem(THEME_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch (e) {
    // fallback
  }
  return 'dark'; // Sleek dark mode by default
}

export function setStoredTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    // ignore
  }
}

/**
 * Export deck as CSV (compatible with Anki, Quizlet, Excel)
 */
export function exportDeckToCSV(deck: Deck): void {
  const headers = ['Front', 'Back', 'Difficulty', 'Explanation', 'Tags'];
  const rows = deck.cards.map((card) => {
    const escapeCsv = (str: string = '') => `"${str.replace(/"/g, '""')}"`;
    return [
      escapeCsv(card.question),
      escapeCsv(card.answer),
      escapeCsv(card.difficulty),
      escapeCsv(card.explanation || ''),
      escapeCsv((card.tags || []).join(', ')),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = deck.title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  link.setAttribute('download', `${safeTitle}_flashcards.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function loadTestResults(userId?: string | null): import('../types').TopicTestResult[] {
  try {
    const key = getTestsStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading test results:', err);
  }
  return [];
}

export function saveTestResult(
  result: import('../types').TopicTestResult,
  userId?: string | null
): import('../types').TopicTestResult[] {
  try {
    const key = getTestsStorageKey(userId);
    const existing = loadTestResults(userId);
    const updated = [result, ...existing];
    localStorage.setItem(key, JSON.stringify(updated));

    // Update user test stats
    const stats = loadStats(userId);
    const totalTests = (stats.testsCompleted || 0) + 1;
    const allPercentages = updated.map((t) => t.percentage);
    const avgScore = Math.round(allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length);

    const updatedStats: UserStudyStats = {
      ...stats,
      testsCompleted: totalTests,
      averageTestScore: avgScore,
    };
    saveStats(updatedStats, userId);

    return updated;
  } catch (err) {
    console.error('Error saving test result:', err);
    return [];
  }
}

/**
 * Export deck as JSON
 */
export function exportDeckToJSON(deck: Deck): void {
  const jsonContent = JSON.stringify(deck, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = deck.title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  link.setAttribute('download', `${safeTitle}_deck.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ----------------------------------------------------
// Remembered Accounts & Switcher Storage
// ----------------------------------------------------
const REMEMBERED_ACCOUNTS_KEY = 'flashgen_remembered_accounts_v2';

export function getRememberedAccounts(): import('../types').RememberedAccount[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading remembered accounts:', err);
  }
  return [];
}

export function saveRememberedAccount(account: import('../types').RememberedAccount): void {
  try {
    const existing = getRememberedAccounts();
    // Match by email or uid
    const filtered = existing.filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase() && a.uid !== account.uid
    );
    const updated = [
      {
        ...account,
        lastUsed: new Date().toISOString(),
      },
      ...filtered,
    ];
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving remembered account:', err);
  }
}

export function removeRememberedAccount(identifier: string): import('../types').RememberedAccount[] {
  try {
    const existing = getRememberedAccounts();
    const updated = existing.filter(
      (a) => a.email.toLowerCase() !== identifier.toLowerCase() && a.uid !== identifier
    );
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error removing remembered account:', err);
    return [];
  }
}

// ----------------------------------------------------
// Turbo AI style Study Pages Storage
// ----------------------------------------------------
export function getStudyPageStorageKey(userId?: string | null): string {
  return userId ? `flashgen_studypages_${userId}` : 'flashgen_studypages_guest';
}

export const SAMPLE_STUDY_PAGES: import('../types').StudyPage[] = [
  {
    id: 'sp-bioenergetics',
    title: 'Cellular Respiration & ATP Synthase Mechanics',
    topic: 'Cellular Respiration',
    subject: 'Biochemistry',
    summary:
      'A complete breakdown of aerobic glucose catabolism across glycolysis, pyruvate decarboxylation, the Krebs cycle, and oxidative phosphorylation driven by the proton motive force.',
    keyTakeaways: [
      'Glycolysis generates a net of 2 ATP and 2 NADH in the cytoplasm without requiring oxygen.',
      'The Krebs cycle takes place in the mitochondrial matrix, producing 6 NADH, 2 FADH2, and 2 GTP/ATP per glucose molecule.',
      'The proton gradient across the inner mitochondrial membrane drives rotary catalysis in ATP Synthase (Chemiosmosis).',
      'Cyanide and Carbon Monoxide inhibit Complex IV (Cytochrome c oxidase), halting the entire electron transport chain.',
    ],
    sections: [
      {
        id: 'sec-1',
        title: '1. Glycolysis & Substrate-Level Phosphorylation',
        content: `Glycolysis converts one 6-carbon glucose molecule into two 3-carbon pyruvate molecules inside the cytoplasm.

### Key Phases:
1. **Energy Investment Phase**: 2 ATP molecules are consumed by Hexokinase and Phosphofructokinase-1 (PFK-1).
2. **Cleavage Phase**: Fructose 1,6-bisphosphate is cleaved into G3P and DHAP.
3. **Energy Payoff Phase**: Produces 4 ATP (via substrate-level phosphorylation) and 2 NADH.

**Net Yield**: \`2 Pyruvate + 2 ATP + 2 NADH\`. PFK-1 is the primary allosteric rate-limiting enzyme, inhibited by high ATP and citrate, and stimulated by AMP and Fructose 2,6-bisphosphate.`,
        callouts: [
          {
            type: 'formula',
            title: 'Net Glycolysis Reaction',
            content: 'Glucose + 2 NAD⁺ + 2 ADP + 2 Pᵢ ➔ 2 Pyruvate + 2 NADH + 2 H⁺ + 2 ATP + 2 H₂O',
          },
          {
            type: 'warning',
            title: 'High-Yield Exam Trap',
            content: 'Arsenate uncouples glycolysis at GAPDH by substituting for inorganic phosphate, causing 0 net ATP production!',
          },
        ],
        isCompleted: true,
      },
      {
        id: 'sec-2',
        title: '2. The Citric Acid Cycle (Krebs Cycle)',
        content: `Pyruvate enters mitochondria and is converted by Pyruvate Dehydrogenase (PDH Complex) into Acetyl-CoA.

In the mitochondrial matrix, Acetyl-CoA (2C) condenses with Oxaloacetate (4C) to form Citrate (6C).

### Energy Capture per Turn:
- **3 NADH** (Isocitrate DH, α-Ketoglutarate DH, Malate DH)
- **1 FADH₂** (Succinate DH - also known as Complex II of ETC)
- **1 GTP** (Succinyl-CoA Synthetase)
- **2 CO₂ released**`,
        callouts: [
          {
            type: 'mnemonic',
            title: 'Krebs Cycle Substrates Mnemonic',
            content: '"Can I Keep Selling Substances For Money, Officer?"\n(Citrate, Isocitrate, α-Ketoglutarate, Succinyl-CoA, Succinate, Fumarate, Malate, Oxaloacetate)',
          },
        ],
        isCompleted: false,
      },
      {
        id: 'sec-3',
        title: '3. Oxidative Phosphorylation & Chemiosmotic Coupling',
        content: `Electrons from NADH and FADH₂ are transferred through Complexes I-IV, pumping protons ($H^+$) into the intermembrane space to create an electrochemical proton-motive force.

- **Complex I**: NADH Dehydrogenase (pumps 4 H⁺)
- **Complex II**: Succinate Dehydrogenase (accepts FADH₂, pumps 0 H⁺)
- **Complex III**: Cytochrome bc1 complex (pumps 4 H⁺ via Q-cycle)
- **Complex IV**: Cytochrome c oxidase (transfers electrons to O₂ to form water, pumps 2 H⁺)
- **ATP Synthase (Complex V)**: Harnesses proton back-flow through $F_0$ rotor to synthesize ATP in $F_1$ catalytic domain.`,
        callouts: [
          {
            type: 'concept',
            title: 'Uncouplers vs Inhibitors',
            content: 'Inhibitors (e.g. Oligomycin) block ATP synthase and stop respiration. Uncouplers (e.g. 2,4-DNP, Thermogenin) dissipate the proton gradient directly, generating heat while increasing oxygen consumption!',
          },
        ],
        isCompleted: false,
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    color: 'emerald',
    tags: ['Biology', 'Biochemistry', 'Metabolism'],
  },
  {
    id: 'sp-transformer-attention',
    title: 'Transformer Architecture & Self-Attention Mechanics',
    topic: 'Transformer Neural Networks',
    subject: 'Computer Science',
    summary:
      'Detailed study notes on the multi-head attention mechanism, scaled dot-product formulation, positional encodings, and the decoding process used across state-of-the-art LLMs.',
    keyTakeaways: [
      'Self-attention computes pairwise relationship weights between every token in O(N²) time complexity.',
      'Scaling by 1/√d_k prevents dot products from growing excessively large where softmax gradients vanish.',
      'Multi-Head Attention enables the model to jointly attend to information from different representation subspaces at different positions.',
      'Positional encodings inject essential word order information because attention operations are inherently permutation-invariant.',
    ],
    sections: [
      {
        id: 'sec-attn-1',
        title: '1. Scaled Dot-Product Attention Formulation',
        content: `In self-attention, input vectors are projected into three distinct spaces:
- **Queries ($Q$)**: What the current token is looking for.
- **Keys ($K$)**: What properties the candidate tokens offer.
- **Values ($V$)**: The actual semantic information transferred if a match is found.

Attention weights are computed via scaled dot products between $Q$ and $K^T$, normalized with softmax, and used to calculate a weighted sum over $V$.`,
        callouts: [
          {
            type: 'formula',
            title: 'Scaled Dot-Product Formula',
            content: 'Attention(Q, K, V) = softmax((Q Kᵀ) / √dₖ) V',
          },
          {
            type: 'concept',
            title: 'Why Scale by √dₖ?',
            content: 'For large vector dimensions dₖ, dot products grow large in magnitude, pushing the softmax function into regions with extremely small gradients. Dividing by √dₖ maintains unit variance.',
          },
        ],
        isCompleted: true,
      },
      {
        id: 'sec-attn-2',
        title: '2. Multi-Head Attention (MHA) & KV Caching',
        content: `Instead of performing a single attention function with d-dimensional queries, keys, and values, Multi-Head Attention linearly projects the queries, keys, and values h times with different learned linear projections to d_k, d_k, and d_v dimensions respectively.

During auto-regressive text generation, previous tokens don't change. **KV Caching** stores previously computed Key and Value matrices in GPU VRAM to avoid redundant $O(N^2)$ recalculations for each new generated token.`,
        callouts: [
          {
            type: 'mnemonic',
            title: 'Q-K-V Analogy',
            content: 'Think of YouTube Search:\nQuery = Your search bar text\nKey = Video titles & tags matching your search\nValue = The actual video content you watch!',
          },
        ],
        isCompleted: false,
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    color: 'indigo',
    tags: ['Machine Learning', 'Deep Learning', 'Transformers'],
  },
];

export function loadStudyPages(userId?: string | null): import('../types').StudyPage[] {
  try {
    const key = getStudyPageStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading study pages from storage:', err);
  }
  return SAMPLE_STUDY_PAGES.map((p) => ({ ...p, userId: userId || undefined }));
}

export function saveStudyPages(pages: import('../types').StudyPage[], userId?: string | null): void {
  try {
    const key = getStudyPageStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(pages));
  } catch (err) {
    console.error('Error saving study pages to storage:', err);
  }
}


