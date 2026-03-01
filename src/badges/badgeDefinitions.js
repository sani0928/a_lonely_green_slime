/** 뱃지 메타데이터 (BADGES, getBadgeById). rarity: normal|epic|unique, category: attack|difficulty|meta|survival|utility|mobility */
export const BADGES = [
  // --- Unique ---
  {
    id: "chain_attack",
    name: "Chain Attack",
    description:
      "When a cell hits an enemy, it **chains** to another nearby enemy then returns to orbit.",
    rarity: "unique",
    category: "attack",
    maxStacks: 1,
  },
  {
    id: "i_am_legend",
    name: "I Am Legend",
    description: "Spawn **1.5×** more monsters on the field.",
    rarity: "unique",
    category: "difficulty",
    maxStacks: 1,
  },
  {
    id: "fragment_collector",
    name: "Fragment Collector",
    description: "Fragment chest spawn rate increases by about **30%**.",
    rarity: "unique",
    category: "meta",
    maxStacks: 1,
  },
  {
    id: "give_me_more_plus",
    name: "Give Me More+",
    description: "Score gained is increased by **2×**. (Stacks with badges of the same effect.)",
    rarity: "unique",
    category: "meta",
    maxStacks: 1,
  },
  {
    id: "give_me_more",
    name: "Give Me More",
    description: "Score gained is increased by **1.5×**. (Stacks with badges of the same effect.)",
    rarity: "normal",
    category: "meta",
    maxStacks: 1,
  },
  {
    id: "regen",
    name: "Regen",
    description:
      "Heal **+1** HP every 60 seconds, but taking damage adds **+1** damage.",
    rarity: "unique",
    category: "survival",
    maxStacks: 1,
  },
  {
    id: "one_more",
    name: "One More",
    description: "You can **spin the badge draw one more time**.",
    rarity: "unique",
    category: "meta",
    maxStacks: 1,
  },

  // --- Epic ---
  {
    id: "cell_limit_plus",
    name: "Extra Cells+",
    description: "Max cell limit **+2**. (Stacks with badges of the same effect.)",
    rarity: "epic",
    category: "attack",
    maxStacks: 1,
  },
  {
    id: "blood_hungry",
    name: "Blood Hungry",
    description:
      "Restore **+1** HP every 300 kills; taking damage adds **+1** damage.",
    rarity: "epic",
    category: "survival",
    maxStacks: 1,
  },
  {
    id: "shooter_hunter",
    name: "Shooter Hunter",
    description: "Cells **prioritize Shooter** enemies.",
    rarity: "epic",
    category: "utility",
    maxStacks: 1,
  },
  {
    id: "runner",
    name: "Runner",
    description: "Increases your **movement speed**.",
    rarity: "epic",
    category: "mobility",
    maxStacks: 1,
  },
  {
    id: "extra_heart_limit_plus",
    name: "Extra Heart Limit+",
    description: "Max HP limit **+4**. (Stacks with badges of the same effect.)",
    rarity: "epic",
    category: "survival",
    maxStacks: 1,
  },
  {
    id: "critical",
    name: "Critical",
    description: "**20%** chance to deal double damage.",
    rarity: "epic",
    category: "attack",
    maxStacks: 1,
  },
  {
    id: "smaller_plus",
    name: "Smaller+",
    description: "Character becomes **even** smaller. (Stacks with badges of the same effect.)",
    rarity: "epic",
    category: "mobility",
    maxStacks: 1,
  },
  // --- Normal ---
  {
    id: "cell_limit",
    name: "Extra Cells",
    description: "Max cell limit **+1**. (Stacks with badges of the same effect.)",
    rarity: "normal",
    category: "attack",
    maxStacks: 1,
  },
  {
    id: "additional_heart_limit",
    name: "Extra Heart Limit",
    description: "Max HP limit **+2**.",
    rarity: "normal",
    category: "survival",
    maxStacks: 1,
  },
  {
    id: "extra_fragments",
    name: "Extra Fragments",
    description: "Max fragment chests on field **+1**.",
    rarity: "normal",
    category: "meta",
    maxStacks: 1,
  },
  {
    id: "smaller",
    name: "Smaller",
    description:
      "Character becomes **slightly** smaller.",
    rarity: "normal",
    category: "mobility",
    maxStacks: 1,
  },
  {
    id: "magnetic",
    name: "Magnetic",
    description: "**Coins** are pulled toward you.",
    rarity: "normal",
    category: "utility",
    maxStacks: 1,
  },
  {
    id: "compass",
    name: "Compass",
    description: "Arrow points to a fragment chest **location**.",
    rarity: "normal",
    category: "utility",
    maxStacks: 1,
  },
];

export function getBadgeById(id) {
  return BADGES.find((b) => b.id === id) || null;
}
