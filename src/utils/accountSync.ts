import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Deck, UserStudyStats, TopicTestResult } from '../types';
import { SAMPLE_DECKS } from './initialDecks';

const GUEST_DECKS_KEY = 'flashgen_decks_guest';
const GUEST_STATS_KEY = 'flashgen_stats_guest';
const GUEST_TESTS_KEY = 'flashgen_tests_guest';

function getStorageDeckKey(userId?: string | null): string {
  return userId ? `flashgen_decks_${userId}` : GUEST_DECKS_KEY;
}

function getStorageStatsKey(userId?: string | null): string {
  return userId ? `flashgen_stats_${userId}` : GUEST_STATS_KEY;
}

function getStorageTestsKey(userId?: string | null): string {
  return userId ? `flashgen_tests_${userId}` : GUEST_TESTS_KEY;
}

/**
 * Fetch initial or cached decks for an account
 */
export async function loadAccountDecks(userId: string): Promise<Deck[]> {
  const cacheKey = getStorageDeckKey(userId);
  let cached: Deck[] = [];
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error reading local deck cache:', e);
  }

  try {
    const q = query(collection(db, 'decks'), where('userId', '==', userId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const remoteDecks = snap.docs.map((docSnap) => docSnap.data() as Deck);
      // Cache locally
      localStorage.setItem(cacheKey, JSON.stringify(remoteDecks));
      return remoteDecks;
    } else {
      // If user has no decks in Firestore yet, initialize with sample decks customized for them
      const initialDecks: Deck[] = (cached.length > 0 ? cached : SAMPLE_DECKS).map((d) => ({
        ...d,
        id: d.id.includes('-') ? d.id : `${d.id}-${Date.now()}`,
        userId,
        updatedAt: new Date().toISOString(),
      }));

      // Seed to Firestore in background
      for (const deck of initialDecks) {
        await setDoc(doc(db, 'decks', deck.id), { ...deck, userId });
      }
      localStorage.setItem(cacheKey, JSON.stringify(initialDecks));
      return initialDecks;
    }
  } catch (error) {
    console.warn('Firestore load decks notice (fallback to cache):', error);
    if (cached.length > 0) return cached;
    return SAMPLE_DECKS.map((d) => ({ ...d, userId }));
  }
}

/**
 * Persist or update a deck for an account
 */
export async function saveAccountDeck(userId: string, deck: Deck): Promise<void> {
  const deckWithUser: Deck = {
    ...deck,
    userId,
    updatedAt: new Date().toISOString(),
  };

  // Update local cache first for instant UI response
  const cacheKey = getStorageDeckKey(userId);
  try {
    const raw = localStorage.getItem(cacheKey);
    const existing: Deck[] = raw ? JSON.parse(raw) : [];
    const index = existing.findIndex((d) => d.id === deck.id);
    let updated: Deck[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = deckWithUser;
    } else {
      updated = [deckWithUser, ...existing];
    }
    localStorage.setItem(cacheKey, JSON.stringify(updated));
  } catch (e) {
    console.error('Local cache save error:', e);
  }

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'decks', deck.id), deckWithUser);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `decks/${deck.id}`);
  }
}

/**
 * Delete a deck for an account
 */
export async function deleteAccountDeck(userId: string, deckId: string): Promise<void> {
  // Update local cache
  const cacheKey = getStorageDeckKey(userId);
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const existing: Deck[] = JSON.parse(raw);
      const filtered = existing.filter((d) => d.id !== deckId);
      localStorage.setItem(cacheKey, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Local cache delete error:', e);
  }

  // Delete from Firestore
  try {
    await deleteDoc(doc(db, 'decks', deckId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `decks/${deckId}`);
  }
}

/**
 * Load user study progress and statistics for account
 */
export async function loadAccountStats(userId: string): Promise<UserStudyStats> {
  const cacheKey = getStorageStatsKey(userId);
  const fallbackStats: UserStudyStats = {
    streak: 1,
    lastStudyDate: new Date().toISOString(),
    totalReviewsCompleted: 0,
    studyTimeMinutes: 0,
    testsCompleted: 0,
    averageTestScore: 0,
  };

  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.streak === 'number') {
        Object.assign(fallbackStats, parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading local stats cache:', e);
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists() && snap.data()?.stats) {
      const remoteStats = snap.data().stats as UserStudyStats;
      localStorage.setItem(cacheKey, JSON.stringify(remoteStats));
      return remoteStats;
    } else {
      // Initialize stats on the user document
      await setDoc(userDocRef, { stats: fallbackStats }, { merge: true });
      localStorage.setItem(cacheKey, JSON.stringify(fallbackStats));
      return fallbackStats;
    }
  } catch (error) {
    console.warn('Firestore load stats notice:', error);
    return fallbackStats;
  }
}

/**
 * Save user study statistics for account
 */
export async function saveAccountStats(userId: string, stats: UserStudyStats): Promise<void> {
  const cacheKey = getStorageStatsKey(userId);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(stats));
  } catch (e) {
    console.error('Local stats cache error:', e);
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, { stats, lastStudyAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
}

/**
 * Save completed topic test result
 */
export async function saveAccountTestResult(userId: string, result: TopicTestResult): Promise<void> {
  const cacheKey = getStorageTestsKey(userId);
  try {
    const raw = localStorage.getItem(cacheKey);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = [result, ...existing];
    localStorage.setItem(cacheKey, JSON.stringify(updated));
  } catch (e) {
    console.error('Local tests cache error:', e);
  }

  try {
    const resultWithUser = { ...result, userId };
    await setDoc(doc(db, 'testResults', result.id), resultWithUser);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `testResults/${result.id}`);
  }
}

/**
 * Load test results for account
 */
export async function loadAccountTestResults(userId: string): Promise<TopicTestResult[]> {
  const cacheKey = getStorageTestsKey(userId);
  let cached: TopicTestResult[] = [];
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local tests cache:', e);
  }

  try {
    const q = query(collection(db, 'testResults'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const results = snap.docs.map((d) => d.data() as TopicTestResult);
      localStorage.setItem(cacheKey, JSON.stringify(results));
      return results;
    }
  } catch (error) {
    console.warn('Firestore load test results notice:', error);
  }

  return cached;
}

/**
 * Load Study Pages for account
 */
export async function loadAccountStudyPages(userId: string): Promise<import('../types').StudyPage[]> {
  const cacheKey = `flashgen_studypages_${userId}`;
  let cached: import('../types').StudyPage[] = [];
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local study pages cache:', e);
  }

  try {
    const q = query(collection(db, 'studyPages'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const pages = snap.docs.map((d) => d.data() as import('../types').StudyPage);
      localStorage.setItem(cacheKey, JSON.stringify(pages));
      return pages;
    }
  } catch (error) {
    console.warn('Firestore load study pages notice:', error);
  }

  return cached;
}

/**
 * Save Study Page for account
 */
export async function saveAccountStudyPage(userId: string, page: import('../types').StudyPage): Promise<void> {
  const pageWithUser = {
    ...page,
    userId,
    updatedAt: new Date().toISOString(),
  };

  const cacheKey = `flashgen_studypages_${userId}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    const existing: import('../types').StudyPage[] = raw ? JSON.parse(raw) : [];
    const index = existing.findIndex((p) => p.id === page.id);
    let updated: import('../types').StudyPage[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = pageWithUser;
    } else {
      updated = [pageWithUser, ...existing];
    }
    localStorage.setItem(cacheKey, JSON.stringify(updated));
  } catch (e) {
    console.error('Local study page cache save error:', e);
  }

  try {
    await setDoc(doc(db, 'studyPages', page.id), pageWithUser);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `studyPages/${page.id}`);
  }
}

/**
 * Delete Study Page for account
 */
export async function deleteAccountStudyPage(userId: string, pageId: string): Promise<void> {
  const cacheKey = `flashgen_studypages_${userId}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const existing: import('../types').StudyPage[] = JSON.parse(raw);
      const filtered = existing.filter((p) => p.id !== pageId);
      localStorage.setItem(cacheKey, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Local study page cache delete error:', e);
  }

  try {
    await deleteDoc(doc(db, 'studyPages', pageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `studyPages/${pageId}`);
  }
}

