export const DW_STATUS_EFFECTS = [
  {
    id: "blinded",
    name: "Blinded",
    img: "icons/svg/blind.svg",
    description: "Auto-fail vision and BS tests. -30 to WS tests. -30 to tests relying on sight.",
    modifiers: [
      { name: "Blinded Penalty", modifier: -30, effectType: "characteristic", valueAffected: "ws" }
    ]
  },
  {
    id: "blood-loss",
    name: "Blood Loss",
    img: "icons/svg/blood.svg",
    description: "10% chance of death each Round. Requires Difficult (-10) Medicae test to staunch."
  },
  {
    id: "compelled",
    name: "Compelled",
    img: "icons/svg/daze.svg",
    description: "Following a psychic command. Must obey a simple order this round."
  },
  {
    id: "dead",
    name: "Dead",
    img: "icons/svg/skull.svg",
    description: "Character has died. May only be restored through extraordinary means.",
    special: "DEFEATED"
  },
  {
    id: "deafened",
    name: "Deafened",
    img: "icons/svg/deaf.svg",
    description: "Auto-fail hearing tests. Difficulty communicating."
  },
  {
    id: "dominated",
    name: "Dominated",
    img: "icons/svg/mystery-man.svg",
    description: "Mind controlled by psyker. -10 to all Characteristics due to crude control.",
    modifiers: [
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "ws" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "bs" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "str" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "tg" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "ag" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "int" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "per" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "wil" },
      { name: "Dominated", modifier: -10, effectType: "characteristic", valueAffected: "fs" }
    ]
  },
  {
    id: "grappled",
    name: "Grappled",
    img: "icons/svg/net.svg",
    description: "Held by opponent. Cannot move. -20 to WS and BS tests.",
    modifiers: [
      { name: "Grappled Penalty", modifier: -20, effectType: "characteristic", valueAffected: "ws" },
      { name: "Grappled Penalty", modifier: -20, effectType: "characteristic", valueAffected: "bs" }
    ]
  },
  {
    id: "immobilized",
    name: "Immobilized",
    img: "icons/svg/paralysis.svg",
    description: "Held by psychic power. Cannot move or take actions."
  },
  {
    id: "lost-arm",
    name: "Lost Arm",
    img: "icons/svg/bones.svg",
    description: "As Lost Hand, but cannot strap shield. Requires replacement or new character."
  },
  {
    id: "lost-eye",
    name: "Lost Eye",
    img: "icons/svg/eye.svg",
    description: "-10 BS permanently. -20 to sight-based tests. Losing both eyes causes Blinded.",
    modifiers: [
      { name: "Lost Eye Penalty", modifier: -10, effectType: "characteristic", valueAffected: "bs" }
    ]
  },
  {
    id: "lost-foot",
    name: "Lost Foot",
    img: "icons/svg/bones.svg",
    description: "Movement halved. -20 to movement Actions and mobility tests."
  },
  {
    id: "lost-hand",
    name: "Lost Hand",
    img: "icons/svg/bones.svg",
    description: "-20 to tests using two hands. Cannot wield two-handed weapons. Shield can be strapped."
  },
  {
    id: "lost-leg",
    name: "Lost Leg",
    img: "icons/svg/bones.svg",
    description: "As Lost Foot, but cannot use Dodge Skill."
  },
  {
    id: "on-fire",
    name: "On Fire",
    img: "icons/svg/fire.svg",
    description: "1d10 Energy Damage and 1 Fatigue per Round. Challenging (+0) WP or run/scream only."
  },
  {
    id: "paroxysm",
    name: "Paroxysm",
    img: "icons/svg/downgrade.svg",
    description: "WS and BS reduced to 10. -10 to INT, PER, WIL, FEL tests.",
    dynamicModifiers: true,
    staticModifiers: [
      { name: "Paroxysm", modifier: -10, effectType: "characteristic", valueAffected: "int" },
      { name: "Paroxysm", modifier: -10, effectType: "characteristic", valueAffected: "per" },
      { name: "Paroxysm", modifier: -10, effectType: "characteristic", valueAffected: "wil" },
      { name: "Paroxysm", modifier: -10, effectType: "characteristic", valueAffected: "fs" }
    ]
  },
  {
    id: "pinned",
    name: "Pinned",
    img: "icons/svg/paralysis.svg",
    description: "Completely immobilized. Cannot take actions except to attempt to break free."
  },
  {
    id: "prone",
    name: "Prone",
    img: "icons/svg/falling.svg",
    description: "Lying on the ground. -20 to WS tests. +20 to be hit by ranged attacks.",
    modifiers: [
      { name: "Prone Penalty", modifier: -20, effectType: "characteristic", valueAffected: "ws" }
    ]
  },
  {
    id: "stunned",
    name: "Stunned",
    img: "icons/svg/daze.svg",
    description: "Cannot take Actions or Reactions. +20 to be hit. Not helpless or unaware."
  },
  {
    id: "suffocating",
    name: "Suffocating",
    img: "icons/svg/poison.svg",
    description: "Challenging (+0) TG test each Round or gain 1 Fatigue. 1d10 Damage/Round if unconscious."
  },
  {
    id: "terrified",
    name: "Terrified",
    img: "icons/svg/terror.svg",
    description: "Fleeing in psychic terror. Must move away from psyker."
  },
  {
    id: "unconscious",
    name: "Unconscious",
    img: "icons/svg/unconscious.svg",
    description: "Completely unaware. Cannot take actions. Treated as helpless target."
  },
  {
    id: "useless-limb",
    name: "Useless Limb",
    img: "icons/svg/paralysis.svg",
    description: "Limb in sling for 1d5+1 weeks. Risk of amputation if Challenging (+0) TG test fails."
  },
  {
    id: "vacuum",
    name: "Vacuum Exposure",
    img: "icons/svg/hazard.svg",
    description: "1d10+3 Explosive Damage/Round from depressurization. 1d10 Energy from cold."
  },
  {
    id: "crippled",
    name: "Crippled",
    img: "icons/svg/blood.svg",
    description: "If takes more than a Half Action, must manually apply Rending Damage (not reduced by armor/TB). Check effect flags for damage amount."
  },
  {
    id: "snared",
    name: "Snared",
    img: "icons/svg/net.svg",
    description: "Movement restricted. Check effect flags for penalty amount (in metres)."
  },
  {
    id: "broken",
    name: "Broken (Horde)",
    img: "icons/svg/unconscious.svg",
    description: "Horde has broken and scattered. Individual creatures flee, lurk, or stalk according to their nature."
  }
];
