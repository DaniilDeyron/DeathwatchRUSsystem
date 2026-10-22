(async () => {
  const token = canvas.tokens.controlled[0];
  if (!token) {
    ui.notifications.error("You must select a token first");
    return;
  }

  const target = game.user.targets.first();
  if (!target) {
    ui.notifications.error("You must target a token first");
    return;
  }

  const dx = target.center.x - token.center.x;
  const dy = target.center.y - token.center.y;
  const angleRadians = Math.atan2(dy, dx);
  const angleDegrees = angleRadians * (180 / Math.PI);

  const regionData = {
    name: "Psychic Blast Template",
    shapes: [{
      type: "cone",
      x: token.center.x,
      y: token.center.y,
      radius: (20 / (canvas.grid.distance || 3)) * (canvas.grid.size || 100),
      angle: 45,
      rotation: angleDegrees
    }],
    color: "#4400FF",
    elevation: { bottom: 0, top: 5 },
    visibility: 2,
    locked: false,
    ownership: {
      default: 0,
      [game.user.id]: 3
    },
    flags: {
      deathwatch: {
        isAttackTemplate: true,
        createdByTurn: game.combat?.current?.turn,
        createdInRound: game.combat?.current?.round,
        weaponType: "psychic-blast"
      }
    }
  };

  await canvas.scene.createEmbeddedDocuments("Region", [regionData]);
  canvas.regions.activate();
  ui.notifications.info("Psychic Blast template placed - adjust as needed");
})();
