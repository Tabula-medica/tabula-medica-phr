/**
 * Voice-selectable provider pick list.
 *
 * Lets a user choose a provider by speaking instead of clicking. The hard part
 * is not speech recognition — that happens upstream — it is designing a list
 * that can be *unambiguously selected by voice*, and rejecting an utterance
 * when it is ambiguous rather than guessing.
 *
 * ── Why ordinals, not names ──
 * Clinician surnames are exactly the words speech recognition handles worst:
 * uncommon, frequently non-Anglophone, and often homophonous with each other
 * ("Shah"/"Shaw", "Cohen"/"Cohan"). So the list is spoken with a short ordinal
 * label — "number one", "number two" — and selection matches on the ordinal.
 * Name matching is offered as a fallback but demands a clear winner.
 *
 * ── Why it refuses ──
 * Selecting the wrong provider sends a patient's referral, with their clinical
 * summary, to a stranger. A mis-select is a privacy incident, not a UX
 * annoyance. Every ambiguous or low-confidence utterance therefore returns a
 * re-prompt instead of a best guess.
 */

import type { ProviderResult } from "./nppes-client";

/** How many entries to read aloud at once. */
export const VOICE_PAGE_SIZE = 5;

export interface VoicePickListItem {
  /** 1-based position, the number the user says. */
  ordinal: number;
  provider: ProviderResult;
  /** What the assistant reads for this entry. */
  spoken: string;
}

export interface VoicePickList {
  items: VoicePickListItem[];
  /** Full prompt, including the preamble and the closing instruction. */
  prompt: string;
  /** True when more providers exist beyond this page. */
  hasMore: boolean;
  totalCount: number;
}

/**
 * Number vocabularies, split by how much they can be trusted.
 *
 * English makes this necessary. "One" is both a number and a pronoun, so
 * "the tall one near the park" is not a selection of entry 1 — but "two" in
 * answer to "say the number" plainly is. Ordinals and digits carry selection
 * intent on their own; bare cardinals do not, and are trusted only in a
 * context that makes them a selection.
 */
const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

const CARDINAL_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * Misrecognitions accepted ONLY when they are the entire utterance.
 *
 * "for", "to" and "ate" are among the commonest words in English. Accepting
 * them mid-sentence would turn "I want to pick one" into a selection of entry
 * 2. Alone, in answer to "say the number", they are almost certainly digits.
 */
const SOLE_WORD_HOMOPHONES: Record<string, number> = {
  won: 1, to: 2, too: 2, for: 4, fore: 4, ate: 8,
};

/** Tokens that mark the following word as a chosen number. */
const SELECTORS = new Set([
  "number", "option", "choice", "choose", "pick", "take", "want", "select",
  "provider", "doctor", "entry",
]);

/** Words that carry no meaning for selection. */
const FILLERS = new Set([
  "the", "a", "an", "and", "or", "please", "um", "uh", "ill", "i", "id",
  "lets", "let", "me", "my", "that", "this", "is", "it",
  "would", "like", "go", "with", "have",
]);

/**
 * Build the spoken description of one provider.
 *
 * Deliberately short. A voice list is held in working memory, and reading a
 * full address for five providers guarantees the user forgets entry one before
 * hearing entry five. City and proximity are enough to choose; the detail is
 * on screen and repeated on confirmation.
 */
function describeProvider(provider: ProviderResult, ordinal: number): string {
  const credential = provider.credential ? `, ${provider.credential}` : "";
  const where = provider.address.city
    ? ` in ${provider.address.city}`
    : "";
  return `Number ${ordinal}. ${provider.name}${credential}${where}. ${provider.proximityLabel}.`;
}

/**
 * Build a voice-readable pick list for one page of results.
 *
 * `page` is 0-based.
 */
export function buildVoicePickList(
  providers: ProviderResult[],
  specialtyName: string,
  page = 0,
): VoicePickList {
  const start = Math.max(0, page) * VOICE_PAGE_SIZE;
  const slice = providers.slice(start, start + VOICE_PAGE_SIZE);

  const items = slice.map((provider, i) => {
    const ordinal = i + 1;
    return { ordinal, provider, spoken: describeProvider(provider, ordinal) };
  });

  const hasMore = providers.length > start + slice.length;

  let prompt: string;
  if (items.length === 0) {
    prompt = `I could not find any ${specialtyName} providers in nearby ZIP codes. You can widen the search area or try a different specialty.`;
  } else {
    const preamble = `I found ${providers.length} ${specialtyName} ${
      providers.length === 1 ? "provider" : "providers"
    } nearby. Here ${items.length === 1 ? "is" : "are"} the ${
      items.length === 1 ? "first one" : `first ${items.length}`
    }.`;
    const closing = hasMore
      ? "Say the number to choose, or say 'more' to hear the next set."
      : "Say the number to choose, or say 'repeat' to hear them again.";
    prompt = [preamble, ...items.map((i) => i.spoken), closing].join(" ");
  }

  return { items, prompt, hasMore, totalCount: providers.length };
}

export type VoiceSelection =
  | { status: "selected"; item: VoicePickListItem }
  | { status: "more" }
  | { status: "repeat" }
  | { status: "cancel" }
  | { status: "unrecognized"; reprompt: string }
  | { status: "ambiguous"; reprompt: string; candidates: string[] }
  | { status: "out-of-range"; reprompt: string };

/**
 * Interpret a spoken utterance against a pick list.
 *
 * Resolution order:
 *   1. Control words — cancel, more, repeat.
 *   2. An ordinal anywhere in the utterance ("number two", "I'll take 2").
 *   3. A provider surname, only when exactly one provider matches.
 *
 * Anything else returns a re-prompt. There is deliberately no fuzzy or
 * phonetic name matching: on a list of similar surnames it would produce
 * confident wrong answers, and the cost of a wrong answer here is a referral
 * containing clinical detail sent to the wrong practice.
 */
export function interpretVoiceSelection(
  utterance: string,
  list: VoicePickList,
): VoiceSelection {
  const raw = (utterance ?? "").toLowerCase().trim();
  if (!raw) {
    return {
      status: "unrecognized",
      reprompt: "I did not catch that. Say the number of the provider you want.",
    };
  }

  const words = raw.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  // 1. Control words.
  if (words.some((w) => ["cancel", "stop", "quit", "nevermind", "exit"].includes(w))) {
    return { status: "cancel" };
  }
  if (words.some((w) => ["more", "next", "others"].includes(w))) {
    return { status: "more" };
  }
  if (words.some((w) => ["repeat", "again", "back"].includes(w))) {
    return { status: "repeat" };
  }

  // 2. Numbers, in decreasing order of how much intent they carry.
  //
  // Ordinals win outright when present: "the second one" means entry 2, and
  // letting the trailing pronoun "one" also register would make every such
  // phrase ambiguous.
  const spoken = new Set<number>();

  for (const word of words) {
    const n = ORDINAL_WORDS[word];
    if (n !== undefined) spoken.add(n);
  }

  if (spoken.size === 0) {
    // Digits are unambiguous — nobody says "2" by accident.
    for (const word of words) {
      if (/^\d{1,2}$/.test(word)) spoken.add(Number(word));
    }
  }

  if (spoken.size === 0 && words.length === 1) {
    const solo = SOLE_WORD_HOMOPHONES[words[0]] ?? CARDINAL_WORDS[words[0]];
    if (solo !== undefined) spoken.add(solo);
  }

  if (spoken.size === 0) {
    // Bare cardinals: trusted only when the utterance is made entirely of
    // numbers, selectors and filler ("number two", "two or three"), so that a
    // sentence merely containing "one" is not read as a selection.
    const isSelectionShaped = words.every(
      (w) =>
        CARDINAL_WORDS[w] !== undefined ||
        SELECTORS.has(w) ||
        FILLERS.has(w) ||
        /^\d{1,2}$/.test(w),
    );
    if (isSelectionShaped) {
      for (const word of words) {
        const n = CARDINAL_WORDS[word];
        if (n !== undefined) spoken.add(n);
      }
    }
  }

  if (spoken.size > 1) {
    return {
      status: "ambiguous",
      reprompt: `I heard more than one number. Say just the number you want, between 1 and ${list.items.length}.`,
      candidates: Array.from(spoken).sort((a, b) => a - b).map(String),
    };
  }

  if (spoken.size === 1) {
    const ordinal = Array.from(spoken)[0];
    const item = list.items.find((i) => i.ordinal === ordinal);
    if (item) return { status: "selected", item };
    return {
      status: "out-of-range",
      reprompt:
        list.items.length === 0
          ? "There are no providers to choose from."
          : `I only have ${list.items.length} to choose from. Say a number between 1 and ${list.items.length}.`,
    };
  }

  // 3. Surname, and only on an unambiguous single match.
  const nameMatches = list.items.filter((item) => {
    const surname = item.provider.name.split(/\s+/).pop()?.toLowerCase();
    return surname ? words.includes(surname) : false;
  });

  if (nameMatches.length === 1) {
    return { status: "selected", item: nameMatches[0] };
  }
  if (nameMatches.length > 1) {
    return {
      status: "ambiguous",
      reprompt:
        "More than one provider matches that name. Say the number instead.",
      candidates: nameMatches.map((m) => m.provider.name),
    };
  }

  return {
    status: "unrecognized",
    reprompt: `I did not recognise that. Say a number between 1 and ${
      list.items.length || 1
    }, or say 'more' or 'cancel'.`,
  };
}

/**
 * The confirmation read back before anything irreversible happens.
 *
 * Referral generation sends clinical information to a third party, so the
 * chosen provider is always confirmed by voice first. The address is included
 * here — unlike in the list — because this is the point where getting it wrong
 * matters and the user is only holding one option in mind.
 */
export function buildConfirmationPrompt(item: VoicePickListItem): string {
  const p = item.provider;
  const where = [p.address.line1, p.address.city, p.address.state]
    .filter(Boolean)
    .join(", ");
  return `You chose ${p.name}${p.credential ? `, ${p.credential}` : ""}, ${
    p.specialty
  }${where ? `, at ${where}` : ""}. Say 'yes' to prepare the referral, or 'no' to choose again.`;
}

/** Interpret a yes/no confirmation. Returns null when it is neither. */
export function interpretConfirmation(utterance: string): boolean | null {
  const raw = (utterance ?? "").toLowerCase().replace(/[^a-z\s]/g, " ");
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.some((w) => ["yes", "yeah", "yep", "correct", "confirm", "right", "ok", "okay"].includes(w))) {
    return true;
  }
  if (words.some((w) => ["no", "nope", "wrong", "cancel", "back", "change"].includes(w))) {
    return false;
  }
  return null;
}
