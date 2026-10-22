# Chapter Modifiers

## Overview
Chapters provide passive characteristic bonuses to actors when assigned. Unlike equipment, chapter items do not need to be "equipped" - their modifiers are always active.

## Implementation
- Chapter items are defined in `src/packs-source/chapters/`
- Each chapter can have a `modifiers` array with characteristic bonuses
- Modifiers are automatically collected by `ModifierCollector.collectItemModifiers()`
- Chapter modifiers are applied during actor data preparation

## Example: Black Templars
```json
{
  "name": "Black Templars",
  "type": "chapter",
  "system": {
    "modifiers": [
      {
        "name": "Weapon Skill Bonus",
        "modifier": 5,
        "effectType": "characteristic",
        "valueAffected": "ws",
        "enabled": true
      },
      {
        "name": "Willpower Bonus",
        "modifier": 5,
        "effectType": "characteristic",
        "valueAffected": "wil",
        "enabled": true
      }
    ]
  }
}
```

## Modifier Structure
- `name`: Display name of the modifier
- `modifier`: Numeric value (positive or negative)
- `effectType`: Type of effect (`"characteristic"`, `"skill"`, `"initiative"`)
- `valueAffected`: Target characteristic/skill key (`"ws"`, `"bs"`, `"str"`, etc.)
- `enabled`: Boolean to enable/disable the modifier

## Adding Chapter Modifiers
1. Edit the chapter JSON file in `src/packs-source/chapters/`
2. Add modifiers array to the `system` object
3. Run `npm run build:packs` to compile
4. Assign the chapter item to an actor in Foundry

## Testing
Tests are located in `tests/modifier-collector.test.mjs` and verify:
- Chapter modifiers are collected without requiring equipped status
- Non-chapter items still require equipped status
- Chapter and equipment modifiers work together
- Modifiers are correctly applied to characteristics
