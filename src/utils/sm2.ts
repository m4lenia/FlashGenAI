import { CardRating, Flashcard } from '../types';

/**
 * SuperMemo 2 (SM-2) Spaced Repetition Algorithm
 */
export function calculateSM2(
  card: Flashcard,
  rating: CardRating
): {
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReviewDate: string;
} {
  // Map rating to grade (0-5 scale)
  // again: 1, hard: 3, good: 4, easy: 5
  let grade = 4;
  switch (rating) {
    case 'again':
      grade = 1;
      break;
    case 'hard':
      grade = 3;
      break;
    case 'good':
      grade = 4;
      break;
    case 'easy':
      grade = 5;
      break;
  }

  let { interval, repetitions, easeFactor } = card;

  // Calculate new Ease Factor (EF)
  // EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  let newEaseFactor = Math.max(1.3, easeFactor + delta);
  // Round to 2 decimals
  newEaseFactor = Math.round(newEaseFactor * 100) / 100;

  let newRepetitions = repetitions;
  let newInterval = interval;

  if (grade < 3) {
    // Failed recall: reset repetitions, review tomorrow or in next batch
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Successful recall
    newRepetitions = repetitions + 1;

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = rating === 'easy' ? 7 : 4;
    } else {
      const bonus = rating === 'easy' ? 1.3 : rating === 'hard' ? 0.8 : 1.0;
      newInterval = Math.max(1, Math.round(interval * newEaseFactor * bonus));
    }
  }

  // Calculate next review timestamp
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    nextReviewDate: nextDate.toISOString(),
  };
}

/**
 * Returns a human-friendly string previewing the next review interval
 * for the rating button (e.g. "1d", "6d", "14d")
 */
export function getRatingIntervalPreview(card: Flashcard, rating: CardRating): string {
  const result = calculateSM2(card, rating);
  if (rating === 'again') {
    return '1d';
  }
  if (result.interval === 1) return '1d';
  if (result.interval < 30) return `${result.interval}d`;
  const months = Math.round(result.interval / 30);
  return `${months}mo`;
}

/**
 * Checks if a card is currently due for review
 */
export function isCardDue(card: Flashcard): boolean {
  if (!card.nextReviewDate) return true;
  return new Date(card.nextReviewDate).getTime() <= Date.now();
}

/**
 * Card status helper
 */
export function getCardStatus(card: Flashcard): 'new' | 'learning' | 'mastered' {
  if (card.reviewCount === 0) return 'new';
  if (card.interval >= 21 || (card.repetitions >= 3 && card.easeFactor >= 2.4)) {
    return 'mastered';
  }
  return 'learning';
}
