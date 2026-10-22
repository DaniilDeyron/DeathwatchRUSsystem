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
    name: "Hand Flamer Template",
    shapes: [{
      type: "cone",
      x: token.center.x,
      y: token.center.y,
      radius: (10 / (canvas.grid.distance || 3)) * (canvas.grid.size || 100),
      angle: 30,
      rotation: angleDegrees
    }],
    color: "#FF6600",
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
        weaponType: "hand-flamer"
      }
    }
  };

  await canvas.scene.createEmbeddedDocuments("Region", [regionData]);
  canvas.regions.activate();
  ui.notifications.info("Hand Flamer template placed - adjust as needed");
})();
