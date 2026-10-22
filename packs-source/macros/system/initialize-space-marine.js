/**
 * Initialize Space Marine - Complete Baseline Setup
 *
 * Populates a selected character actor with:
 * - 19 Gene-Seed Implants
 * - 12 Starting Talents
 * - 2 Starting Traits (Unnatural Strength ×2, Unnatural Toughness ×2)
 * - 19 Starting Skills (set to Trained)
 * - Chosen Specialty
 * - Standard gear loadout
 * - Optional: Auto-generated Characteristics (2d10 + 30)
 *
 * Usage:
 * 1. Create a new Character actor
 * 2. Select its token (or have it selected in Actors directory)
 * 3. Run this macro
 * 4. Choose specialty and options
 * 5. Confirm initialization
 *
 * After initialization:
 * - Add Chapter item from Chapters compendium
 * - Choose one Tactics specialty (user choice)
 * - If not auto-generated: Set Characteristics based on Chapter
 */

const actor = canvas.tokens.controlled[0]?.actor || game.user.character;

if (!actor) {
  ui.notifications.warn('Please select a character token or set your User Character');
  return;
}

if (actor.type !== 'character') {
  ui.notifications.error('This macro only works on Character actors');
  return;
}

// Step 1: Choose Specialty and Options
const specialtyNames = [
  'Apothecary',
  'Assault Marine',
  'Devastator Marine',
  'Librarian',
  'Tactical Marine',
  'Techmarine'
];

const specialtyOptions = specialtyNames.map(name => 
  `<option value="${name}">${name}</option>`
).join('');

const specialtyResult = await foundry.applications.api.DialogV2.wait({
  window: { title: 'Initialize Space Marine' },
  content: `
    <p>Choose specialty for <strong>${actor.name}</strong>:</p>
    <div class="form-group">
      <label>Specialty:</label>
      <select id="specialty-select" name="specialty" style="width: 100%;">
        ${specialtyOptions}
      </select>
    </div>
    <div class="form-group" style="margin-top: 15px;">
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="auto-generate-chars" name="autoGenerateChars" checked />
        <span>Auto-generate Characteristics (2d10 + 30)</span>
      </label>
    </div>
  `,
  buttons: [
    {
      label: 'Continue',
      action: 'continue',
      callback: (event, button, dialog) => {
        const form = dialog.element.querySelector('form');
        return {
          specialty: form.querySelector('#specialty-select').value,
          autoGenerate: form.querySelector('#auto-generate-chars').checked
        };
      }
    },
    { label: 'Cancel', action: 'cancel' }
  ]
});

if (!specialtyResult || specialtyResult === 'cancel') return;

const chosenSpecialty = specialtyResult.specialty;
const autoGenerateChars = specialtyResult.autoGenerate;

// Step 2: Confirm initialization
const confirmed = await foundry.applications.api.DialogV2.confirm({
  window: { title: 'Initialize Space Marine' },
  content: `
    <p>Initialize <strong>${actor.name}</strong> as <strong>${chosenSpecialty}</strong>?</p>
    <p style="font-size: 0.9em; color: #666;">
      This will add:
      <ul>
        <li>19 Gene-Seed Implants</li>
        <li>12 Starting Talents</li>
        <li>2 Starting Traits</li>
        <li>19 Starting Skills (Trained)</li>
        <li>${chosenSpecialty} specialty</li>
        <li>Standard gear + specialty gear</li>
        ${autoGenerateChars ? '<li>Auto-generated Characteristics</li>' : ''}
      </ul>
    </p>
    <p style="font-size: 0.85em; color: #999;">
      You will still need to manually:
      <ul>
        ${autoGenerateChars ? '' : '<li>Set Characteristics (based on Chapter)</li>'}
        <li>Add Chapter item</li>
        <li>Choose one Tactics specialty</li>
      </ul>
    </p>
    <p style="color: #c00; font-weight: bold;">This cannot be easily undone!</p>
  `,
  rejectClose: false
});

if (!confirmed) return;

ui.notifications.info(`Initializing ${chosenSpecialty}...`);

// Implant names (all 19 gene-seed implants)
const implantNames = [
  'Secondary Heart',
  'Ossmodula',
  'Biscopea',
  'Haemastamen',
  "Larraman's Organ",
  'Catalepsean Node',
  'Preomnor',
  'Omophagea',
  'Multi-lung',
  'Occulobe',
  "Lyman's Ear",
  'Sus-an Membrane',
  'Melanchromic Organ',
  'Mucranoid',
  'Oolitic Kidney',
  'Neuroglottis',
  "Betcher's Gland",
  'Progenoids',
  'Black Carapace'
];

// Talent IDs (12 starting talents)
const talentIds = [
  'tal00000000011',  // Ambidextrous
  'tal00000000015',  // Astartes Weapon Training
  'tal00000000032',  // Bulging Biceps
  'tal00000000129',  // Heightened Senses (Sound)
  'tal00000000127',  // Heightened Senses (Sight)
  'tal00000000141',  // Killing Strike
  'tal00000000170',  // Nerves of Steel
  'tal00000000206',  // Quick Draw
  'tal00000000213',  // Resistance (Psychic Powers)
  'tal00000000261',  // True Grit
  'tal00000000264',  // Unarmed Master
  'tal00000000047'   // Deathwatch Training
];

// Trait IDs (2 starting traits)
const traitIds = [
  'trt000000000051',  // Unnatural Characteristic (Strength)
  'trt000000000052'   // Unnatural Characteristic (Toughness)
];

// Starting Skills (set to Trained)
const skillKeys = [
  'awareness',
  'cipher_chapter_runes',
  'climb',
  'dodge',
  'lore_common_adeptus_astartes',
  'lore_common_imperium',
  'lore_common_war',
  'lore_common_deathwatch',
  'concealment',
  'drive_ground',
  'lore_forbidden_xenos',
  'intimidate',
  'literacy',
  'navigation_surface',
  'lore_scholastic_codex_astartes',
  'silent_move',
  'speak_language_high_gothic',
  'speak_language_low_gothic',
  'tracking'
];

try {
  // Load implants from compendium by NAME
  const implantPack = game.packs.get('deathwatch.implants');
  const allImplants = await implantPack.getDocuments();
  const implantDocs = allImplants.filter(i => implantNames.includes(i.name));
  
  if (implantDocs.length !== 19) {
    ui.notifications.warn(`Only found ${implantDocs.length}/19 implants`);
  }
  
  // Load talents from compendium
  const talentPack = game.packs.get('deathwatch.talents');
  const talentDocs = await talentPack.getDocuments({ _id__in: talentIds });
  
  // Load traits from compendium
  const traitPack = game.packs.get('deathwatch.traits');
  const traitDocs = await traitPack.getDocuments({ _id__in: traitIds });
  
  // Load chosen specialty from compendium
  const specialtyPack = game.packs.get('deathwatch.specialties');
  const allSpecialties = await specialtyPack.getDocuments();
  const specialtyDoc = allSpecialties.find(s => s.name === chosenSpecialty);
  
  if (!specialtyDoc) {
    throw new Error(`Specialty "${chosenSpecialty}" not found in compendium`);
  }
  
  // Load standard gear (all specialties)
  const armorPack = game.packs.get('deathwatch.armor');
  const weaponsPack = game.packs.get('deathwatch.weapons');
  const gearPack = game.packs.get('deathwatch.gear');
  const ammoPack = game.packs.get('deathwatch.ammunition');
  
  const allArmor = await armorPack.getDocuments();
  const allWeapons = await weaponsPack.getDocuments();
  const allGear = await gearPack.getDocuments();
  const allAmmo = await ammoPack.getDocuments();
  
  const standardGear = [
    allArmor.find(i => i.name === 'Mark VII Aquila Power Armour'),
    allWeapons.find(i => i.name === 'Astartes Bolt Pistol'),
    allWeapons.find(i => i.name === 'Astartes Combat Knife'),
    allWeapons.find(i => i.name === 'Astartes Frag Grenade'),
    allWeapons.find(i => i.name === 'Astartes Krak Grenade'),
    allAmmo.find(i => i.name === 'Grenades'),
    allAmmo.find(i => i.name === 'Grenades'),
    allAmmo.find(i => i.name === 'Bolter Rounds'),
    allAmmo.find(i => i.name === 'Bolter Rounds'),
    allAmmo.find(i => i.name === 'Bolter Rounds'),
    allGear.find(i => i.name === 'Repair Cement')
  ].filter(Boolean);
  
  // Load specialty-specific gear
  const specialtyGearMap = {
    'Apothecary': [
      allWeapons.find(i => i.name === 'Astartes Bolter (Godwyn)'),
      allGear.find(i => i.name === 'Narthecium'),
      allGear.find(i => i.name === 'Reductor')
    ],
    'Assault Marine': [
      allWeapons.find(i => i.name === 'Astartes Chainsword'),
      allGear.find(i => i.name === 'Jump Pack')
    ],
    'Devastator Marine': [
      allWeapons.find(i => i.name === 'Astartes Heavy Bolter')
    ],
    'Librarian': [
      allWeapons.find(i => i.name === 'Astartes Bolter (Godwyn)'),
      allWeapons.find(i => i.name === 'Astartes Force Sword')
    ],
    'Tactical Marine': [
      allWeapons.find(i => i.name === 'Astartes Bolter (Godwyn)')
    ],
    'Techmarine': [
      allWeapons.find(i => i.name === 'Astartes Bolter (Godwyn)')
    ]
  };
  
  const specialtyGear = (specialtyGearMap[chosenSpecialty] || []).filter(Boolean);
  
  // Load Servo-Arm for Techmarine (cybernetic, not weapon)
  if (chosenSpecialty === 'Techmarine') {
    const cyberneticsPack = game.packs.get('deathwatch.cybernetics');
    const allCybernetics = await cyberneticsPack.getDocuments();
    const servoArm = allCybernetics.find(i => i.name === 'Astartes Servo-Arm');
    if (servoArm) specialtyGear.push(servoArm);
  }
  
  // Combine all items
  const allItems = [...implantDocs, ...talentDocs, ...traitDocs, specialtyDoc, ...standardGear, ...specialtyGear];
  
  // Add items to actor
  const createdItems = await actor.createEmbeddedDocuments('Item', allItems.map(i => i.toObject()));
  
  // Find the created specialty item to set specialtyId
  const createdSpecialty = createdItems.find(i => i.type === 'specialty');
  
  // Update skills to Trained and set specialtyId
  const skillUpdates = {};
  for (const skillKey of skillKeys) {
    skillUpdates[`system.skills.${skillKey}.trained`] = true;
  }
  
  if (createdSpecialty) {
    skillUpdates['system.specialtyId'] = createdSpecialty.id;
  }
  
  await actor.update(skillUpdates);
  
  // Auto-generate characteristics if requested
  if (autoGenerateChars) {
    const roll2d10Plus30 = () => {
      const d1 = Math.floor(Math.random() * 10) + 1;
      const d2 = Math.floor(Math.random() * 10) + 1;
      return d1 + d2 + 30;
    };
    
    const charUpdates = {
      'system.characteristics.ws.base': roll2d10Plus30(),
      'system.characteristics.bs.base': roll2d10Plus30(),
      'system.characteristics.str.base': roll2d10Plus30(),
      'system.characteristics.tg.base': roll2d10Plus30(),
      'system.characteristics.ag.base': roll2d10Plus30(),
      'system.characteristics.int.base': roll2d10Plus30(),
      'system.characteristics.per.base': roll2d10Plus30(),
      'system.characteristics.wil.base': roll2d10Plus30(),
      'system.characteristics.fs.base': roll2d10Plus30()
    };
    
    await actor.update(charUpdates);
    
    const charMsg = `WS:${charUpdates['system.characteristics.ws.base']} ` +
      `BS:${charUpdates['system.characteristics.bs.base']} ` +
      `S:${charUpdates['system.characteristics.str.base']} ` +
      `T:${charUpdates['system.characteristics.tg.base']} ` +
      `Ag:${charUpdates['system.characteristics.ag.base']} ` +
      `Int:${charUpdates['system.characteristics.int.base']} ` +
      `Per:${charUpdates['system.characteristics.per.base']} ` +
      `WP:${charUpdates['system.characteristics.wil.base']} ` +
      `Fel:${charUpdates['system.characteristics.fs.base']}`;
    
    ui.notifications.info('Characteristics: ' + charMsg);
  }
  
  // Set Psy Rating for Librarian
  if (chosenSpecialty === 'Librarian') {
    await actor.update({ 'system.psyRating.base': 3 });
    ui.notifications.info('Psy Rating set to 3');
  }
  
  ui.notifications.info(`✅ ${actor.name} initialized as ${chosenSpecialty}`);
  ui.notifications.info(`Added: ${implantDocs.length} implants, ${talentDocs.length} talents, ${traitDocs.length} traits, ${skillKeys.length} skills, specialty, ${standardGear.length} standard gear, ${specialtyGear.length} specialty gear`);
  
  // Final guidance dialog
  await foundry.applications.api.DialogV2.prompt({
    window: { title: 'Initialization Complete - Next Steps' },
    content: `
      <h3 style="margin-top: 0;">✅ ${actor.name} is initialized!</h3>
      
      <h4>✓ What's Been Added:</h4>
      <ul style="font-size: 0.9em; color: #666;">
        <li>19 Gene-Seed Implants</li>
        <li>12 Starting Talents</li>
        <li>2 Starting Traits</li>
        <li>19 Starting Skills (Trained)</li>
        <li>${chosenSpecialty} specialty</li>
        <li>Standard gear + specialty gear</li>
        ${autoGenerateChars ? '<li>Auto-generated Characteristics</li>' : ''}
        ${chosenSpecialty === 'Librarian' ? '<li>Psy Rating: 3</li>' : ''}
      </ul>
      
      <h4 style="margin-top: 15px;">⚠️ Required Next Steps:</h4>
      <ol style="font-size: 0.95em;">
        ${autoGenerateChars ? '' : '<li><strong>Set Characteristics</strong> - Based on your Chapter</li>'}
        <li><strong>Add Chapter Item</strong> - From Chapters compendium</li>
        <li><strong>Choose Tactics Specialty</strong> - Pick one (e.g., Defensive Doctrine, Offensive Doctrine)</li>
        <li><strong>Add Chapter Trapping</strong> - One item of your choice from your Chapter</li>
      </ol>
      
      <h4 style="margin-top: 15px;">📋 Review Your Specialty:</h4>
      <ul style="font-size: 0.9em;">
        <li><strong>Check ${chosenSpecialty} specialty abilities</strong> - Review your specialty item for special abilities you may need to activate or track</li>
        <li><strong>Add Solo Mode abilities</strong> - From your specialty's Solo Mode options</li>
        <li><strong>Add Squad Mode abilities</strong> - From your specialty's Squad Mode options</li>
        ${chosenSpecialty === 'Librarian' ? '<li><strong>Choose Psychic Powers</strong> - Select from Psychic Powers compendium based on your discipline</li>' : ''}
        ${chosenSpecialty === 'Techmarine' ? '<li><strong>Choose Common Cybernetic</strong> - One additional cybernetic at character creation</li>' : ''}
        ${chosenSpecialty === 'Tactical Marine' ? '<li><strong>Special Issue Ammo</strong> - Add one clip (≤25 Requisition) per mission</li>' : ''}
      </ul>
      
      <p style="font-size: 0.85em; color: #999; margin-top: 15px;">
        <em>Consult your ${chosenSpecialty} specialty item and Deathwatch Core Rulebook for details.</em>
      </p>
    `,
    rejectClose: false,
    modal: true
  });
  
} catch (error) {
  console.error('Space Marine initialization failed:', error);
  ui.notifications.error(`Initialization failed: ${error.message}`);
}
