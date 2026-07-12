// ─── PRNG (mulberry32) ──────────────────────────────────────────────────────

let state = 42;

/**
 * Returns a deterministic pseudo-random number between 0 and 1.
 * Uses the mulberry32 algorithm seeded at module load.
 * @returns A number in [0, 1).
 */
function random(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Picks a random element from an array.
 * @param arr - The array to pick from.
 * @returns A random element.
 */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(random() * arr.length)]!;
}

// ─── UUID Generator ─────────────────────────────────────────────────────────

/** Entity type codes for UUID generation. */
export const Entity = {
  User: 1,
} as const;

/**
 * Generates a deterministic UUID for a given entity type and index.
 * @param entity - The entity type code.
 * @param index - The index within that entity type.
 * @returns A valid UUID string.
 */
export function makeId(entity: number, index: number): string {
  const entityHex = entity.toString(16).padStart(4, "0");
  const indexHex = index.toString(16).padStart(12, "0");
  return `d0000000-${entityHex}-4000-a000-${indexHex}`;
}

// ─── Phone & Email Generators ───────────────────────────────────────────────

/**
 * Generates a valid E.164 phone number.
 * @param index - Unique index to ensure no duplicates.
 * @returns A phone string in +15555XXXXXX format.
 */
export function makePhone(index: number): string {
  const suffix = index.toString().padStart(6, "0");
  return `+15555${suffix}`;
}

/**
 * Generates a unique email address.
 * @param firstName - First name.
 * @param lastName - Last name.
 * @param index - Unique index to ensure no duplicates.
 * @returns An email string.
 */
export function makeEmail(
  firstName: string,
  lastName: string,
  index: number,
): string {
  const first = firstName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const last = lastName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return `${first}.${last}${index}@example.com`;
}

// ─── Name Pools ─────────────────────────────────────────────────────────────

/** First names. */
export const FIRST_NAMES = [
  "Alice",
  "Bruno",
  "Carla",
  "Daniel",
  "Elena",
  "Felipe",
  "Gabriela",
  "Hugo",
  "Isabela",
  "Julia",
  "Lucas",
  "Maria",
  "Nathan",
  "Olivia",
  "Pedro",
  "Rafaela",
  "Samuel",
  "Tatiana",
  "Victor",
  "Yasmin",
];

/** Last names. */
export const LAST_NAMES = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Rodrigues",
  "Ferreira",
  "Alves",
  "Pereira",
  "Lima",
  "Gomes",
  "Costa",
  "Ribeiro",
  "Martins",
  "Carvalho",
  "Almeida",
  "Lopes",
  "Soares",
  "Fernandes",
  "Vieira",
  "Barbosa",
];
