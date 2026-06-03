"use strict";

const STORY_URL = "story.json";
const SAVE_KEY = "parazskapuk-save-v1";

const elements = {
  chapterKicker: document.getElementById("chapterKicker"),
  chapterTitle: document.getElementById("chapterTitle"),
  storyText: document.getElementById("storyText"),
  choices: document.getElementById("choices"),
  combatPanel: document.getElementById("combatPanel"),
  enemyName: document.getElementById("enemyName"),
  enemyStats: document.getElementById("enemyStats"),
  playerMeter: document.getElementById("playerMeter"),
  enemyMeter: document.getElementById("enemyMeter"),
  playerMeterText: document.getElementById("playerMeterText"),
  enemyMeterText: document.getElementById("enemyMeterText"),
  combatLog: document.getElementById("combatLog"),
  skillValue: document.getElementById("skillValue"),
  staminaValue: document.getElementById("staminaValue"),
  luckValue: document.getElementById("luckValue"),
  skillInitial: document.getElementById("skillInitial"),
  staminaInitial: document.getElementById("staminaInitial"),
  luckInitial: document.getElementById("luckInitial"),
  foodValue: document.getElementById("foodValue"),
  goldValue: document.getElementById("goldValue"),
  potionValue: document.getElementById("potionValue"),
  weaponValue: document.getElementById("weaponValue"),
  inventoryList: document.getElementById("inventoryList"),
  diceDisplay: document.getElementById("diceDisplay"),
  eventLog: document.getElementById("eventLog"),
  eatButton: document.getElementById("eatButton"),
  potionButton: document.getElementById("potionButton"),
  musicToggle: document.getElementById("musicToggle"),
  resetButton: document.getElementById("resetButton"),
  rulesToggle: document.getElementById("rulesToggle"),
  setupModal: document.getElementById("setupModal"),
  rolledStats: document.getElementById("rolledStats"),
  potionPicker: document.getElementById("potionPicker"),
  rerollButton: document.getElementById("rerollButton"),
  startButton: document.getElementById("startButton"),
  rulesModal: document.getElementById("rulesModal"),
  closeRulesButton: document.getElementById("closeRulesButton"),
  music: document.getElementById("bg-music")
};

let story = null;
let chapters = new Map();
let pendingRoll = null;
let selectedPotion = "stamina";

let state = {
  currentChapter: "c001",
  initial: { skill: 0, stamina: 0, luck: 0 },
  player: { skill: 0, stamina: 0, luck: 0 },
  provisions: 10,
  gold: 6,
  potion: { type: "stamina", doses: 2 },
  inventory: [],
  flags: {},
  appliedChapters: {},
  weapon: "basic_sword",
  combat: null,
  events: []
};

function d6() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(count) {
  const dice = Array.from({ length: count }, d6);
  const total = dice.reduce((sum, die) => sum + die, 0);
  elements.diceDisplay.textContent = `${dice.join(" + ")} = ${total}`;
  return { dice, total };
}

function rollHero() {
  const skill = d6() + 6;
  const staminaRoll = rollDiceQuiet(2) + 12;
  const luck = d6() + 6;
  return { skill, stamina: staminaRoll, luck };
}

function rollDiceQuiet(count) {
  return Array.from({ length: count }, d6).reduce((sum, die) => sum + die, 0);
}

function clampStats() {
  state.player.skill = Math.max(0, Math.min(state.player.skill, state.initial.skill));
  state.player.stamina = Math.max(0, Math.min(state.player.stamina, state.initial.stamina));
  state.player.luck = Math.max(0, Math.min(state.player.luck, state.initial.luck));
  state.provisions = Math.max(0, state.provisions);
  state.gold = Math.max(0, state.gold);
}

function itemLabel(id) {
  return story?.items?.[id]?.name ?? id.replaceAll("_", " ");
}

function weaponLabel(id) {
  return story?.weapons?.[id]?.name ?? itemLabel(id);
}

function currentWeapon() {
  return story?.weapons?.[state.weapon] ?? story?.weapons?.basic_sword ?? { name: "Kard", attackBonus: 0 };
}

function addEvent(message) {
  state.events.unshift(message);
  state.events = state.events.slice(0, 10);
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || !saved.player || !saved.initial) return false;
    state = saved;
    return true;
  } catch {
    return false;
  }
}

function newState(rolls, potionType) {
  state = {
    currentChapter: "c001",
    initial: { ...rolls },
    player: { ...rolls },
    provisions: story.rules.startingProvisions,
    gold: story.rules.startingGold,
    potion: { type: potionType, doses: 2 },
    inventory: [...story.rules.startingInventory],
    flags: {},
    appliedChapters: {},
    weapon: "basic_sword",
    combat: null,
    events: ["A kalandlap elkészült."]
  };
}

function renderSetupRolls(rolls) {
  pendingRoll = rolls;
  elements.rolledStats.innerHTML = [
    ["Ügyesség", rolls.skill],
    ["Életerő", rolls.stamina],
    ["Szerencse", rolls.luck]
  ].map(([label, value]) => `
    <div class="roll-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderPotionPicker() {
  const potions = story.potions;
  elements.potionPicker.innerHTML = Object.entries(potions).map(([id, potion]) => `
    <button class="potion-card ${id === selectedPotion ? "selected" : ""}" type="button" data-potion="${id}">
      <span>${potion.kicker}</span>
      <strong>${potion.name}</strong>
    </button>
  `).join("");

  elements.potionPicker.querySelectorAll("[data-potion]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPotion = button.dataset.potion;
      renderPotionPicker();
    });
  });
}

function openSetup() {
  renderSetupRolls(rollHero());
  renderPotionPicker();
  elements.setupModal.classList.remove("hidden");
}

function closeSetup() {
  elements.setupModal.classList.add("hidden");
}

function applyEffects(effects = [], source = "effect") {
  for (const effect of effects) {
    if (effect.type === "addItem" && !state.inventory.includes(effect.item)) {
      state.inventory.push(effect.item);
      addEvent(`Tárgy került a zsákba: ${itemLabel(effect.item)}.`);
    }
    if (effect.type === "removeItem") {
      state.inventory = state.inventory.filter((item) => item !== effect.item);
      addEvent(`Kikerült a zsákból: ${itemLabel(effect.item)}.`);
    }
    if (effect.type === "gold") {
      state.gold += effect.amount;
      addEvent(`${effect.amount > 0 ? "Szereztél" : "Elköltöttél"} ${Math.abs(effect.amount)} aranyat.`);
    }
    if (effect.type === "provisions") {
      state.provisions += effect.amount;
      addEvent(`${effect.amount > 0 ? "Élelmet szereztél" : "Élelmet vesztettél"}: ${Math.abs(effect.amount)} adag.`);
    }
    if (effect.type === "stat") {
      const before = state.player[effect.stat];
      state.player[effect.stat] += effect.amount;
      clampStats();
      const delta = state.player[effect.stat] - before;
      if (delta !== 0) {
        addEvent(`${statName(effect.stat)} ${delta > 0 ? "nőtt" : "csökkent"} ${Math.abs(delta)} ponttal.`);
      }
    }
    if (effect.type === "restore") {
      state.player[effect.stat] = state.initial[effect.stat];
      addEvent(`${statName(effect.stat)} visszaállt a kezdeti értékre.`);
    }
    if (effect.type === "raiseInitial") {
      state.initial[effect.stat] += effect.amount;
      state.player[effect.stat] += effect.amount;
      addEvent(`${statName(effect.stat)} kezdeti értéke ${effect.amount} ponttal nőtt.`);
    }
    if (effect.type === "flag") {
      state.flags[effect.flag] = effect.value ?? true;
    }
    if (effect.type === "equip") {
      state.weapon = effect.weapon;
      if (!state.inventory.includes(effect.weapon)) state.inventory.push(effect.weapon);
      addEvent(`Fegyvert váltottál: ${weaponLabel(effect.weapon)}.`);
    }
    if (effect.type === "death") {
      state.player.stamina = 0;
      addEvent(effect.message ?? "A kaland véget ért.");
    }
  }

  clampStats();
  if (state.player.stamina <= 0 && state.currentChapter !== "c049") {
    state.currentChapter = "c049";
  }
  if (source !== "silent") saveGame();
}

function statName(stat) {
  return { skill: "Ügyesség", stamina: "Életerő", luck: "Szerencse" }[stat] ?? stat;
}

function enterChapter(id) {
  state.combat = null;
  state.currentChapter = id;
  const chapter = chapters.get(id);

  if (!chapter) {
    renderMissingChapter(id);
    return;
  }

  if (!state.appliedChapters[id]) {
    applyEffects(chapter.effects, "silent");
    state.appliedChapters[id] = true;
  }

  if (state.player.stamina <= 0 && chapter.type !== "ending") {
    state.currentChapter = "c049";
  }

  saveGame();
  render();
}

function renderMissingChapter(id) {
  elements.chapterKicker.textContent = id;
  elements.chapterTitle.textContent = "Hiányzó fejezet";
  elements.storyText.innerHTML = `<p>Ez a fejezet még nincs a történetben.</p>`;
  elements.choices.innerHTML = "";
  elements.combatPanel.classList.add("hidden");
}

function render() {
  const chapter = chapters.get(state.currentChapter);
  if (!chapter) return renderMissingChapter(state.currentChapter);

  elements.chapterKicker.textContent = `${chapter.id.replace("c", "")}. fejezet`;
  elements.chapterTitle.textContent = chapter.title;
  elements.storyText.innerHTML = chapter.text.map((paragraph) => `<p>${paragraph}</p>`).join("");
  renderSheet();

  if (chapter.type === "combat") {
    startCombat(chapter);
    return;
  }

  elements.combatPanel.classList.add("hidden");
  renderChoices(chapter.choices ?? []);
}

function renderSheet() {
  elements.skillValue.textContent = state.player.skill;
  elements.staminaValue.textContent = state.player.stamina;
  elements.luckValue.textContent = state.player.luck;
  elements.skillInitial.textContent = `/ ${state.initial.skill}`;
  elements.staminaInitial.textContent = `/ ${state.initial.stamina}`;
  elements.luckInitial.textContent = `/ ${state.initial.luck}`;
  elements.foodValue.textContent = state.provisions;
  elements.goldValue.textContent = state.gold;

  const potion = story.potions[state.potion.type];
  elements.potionValue.textContent = `${potion.short} (${state.potion.doses})`;
  elements.weaponValue.textContent = weaponLabel(state.weapon);

  const inventory = state.inventory.filter((item) => item !== "basic_sword");
  elements.inventoryList.innerHTML = inventory.length
    ? inventory.map((item) => `<span class="inventory-item">${itemLabel(item)}</span>`).join("")
    : `<span class="inventory-item">üres</span>`;

  elements.eatButton.disabled = state.provisions <= 0 || state.player.stamina >= state.initial.stamina || Boolean(state.combat);
  elements.potionButton.disabled = state.potion.doses <= 0 || Boolean(state.combat);
  elements.eventLog.innerHTML = state.events.map((event) => `<p>${event}</p>`).join("");

  const current = Math.max(0, state.player.stamina);
  const max = Math.max(1, state.initial.stamina);
  elements.playerMeter.style.width = `${Math.round((current / max) * 100)}%`;
  elements.playerMeterText.textContent = `${current}/${max}`;
}

function renderChoices(choices) {
  elements.choices.innerHTML = "";

  if (!choices.length) {
    const chapter = chapters.get(state.currentChapter);
    if (chapter?.ending) {
      elements.choices.appendChild(choiceButton({ label: "Új játék", tone: "good" }, () => resetGame()));
    }
    return;
  }

  choices.forEach((choice) => {
    const availability = choiceAvailable(choice);
    const button = choiceButton(choice, () => choose(choice));
    if (!availability.ok) {
      button.disabled = true;
      button.querySelector("span").textContent = availability.reason;
    }
    elements.choices.appendChild(button);
  });
}

function choiceButton(choice, action) {
  const button = document.createElement("button");
  button.className = `choice-button ${choice.tone ?? ""}`.trim();
  button.type = "button";
  button.innerHTML = `<strong>${choice.label}</strong><span>${choice.hint ?? ""}</span>`;
  button.addEventListener("click", action);
  return button;
}

function choiceAvailable(choice) {
  const req = choice.requires ?? {};
  if (req.items) {
    const missing = req.items.filter((item) => !state.inventory.includes(item));
    if (missing.length) return { ok: false, reason: `Hiányzik: ${missing.map(itemLabel).join(", ")}.` };
  }
  if (req.flags) {
    const missingFlag = req.flags.find((flag) => !state.flags[flag]);
    if (missingFlag) return { ok: false, reason: "Ehhez még nincs meg a szükséges nyom." };
  }
  if (req.gold && state.gold < req.gold) {
    return { ok: false, reason: `Ehhez ${req.gold} arany kell.` };
  }
  if (req.provisions && state.provisions < req.provisions) {
    return { ok: false, reason: `Ehhez ${req.provisions} adag élelem kell.` };
  }
  return { ok: true, reason: "" };
}

function choose(choice) {
  if (!choiceAvailable(choice).ok) return;

  applyEffects(choice.effects, "choice");

  if (choice.test) {
    resolveTest(choice.test);
    return;
  }

  enterChapter(choice.next);
}

function resolveTest(test) {
  const roll = rollDice(2);
  const target = state.player[test.stat];
  const success = roll.total <= target;
  let next = success ? test.success : test.failure;

  if (test.stat === "luck") {
    state.player.luck -= 1;
  }

  applyEffects(success ? test.successEffects : test.failureEffects, "test");
  addEvent(`${statName(test.stat)} próba: ${roll.total} ${success ? "siker" : "kudarc"} a ${target} ellen.`);
  clampStats();

  if (state.player.stamina <= 0) next = "c049";
  saveGame();
  enterChapter(next);
}

function startCombat(chapter) {
  if (!state.combat || state.combat.chapterId !== chapter.id) {
    state.combat = {
      chapterId: chapter.id,
      enemyIndex: 0,
      enemies: chapter.combat.enemies.map(prepEnemy),
      pendingLuck: null,
      finished: false
    };
  }
  renderCombat(chapter, "A küzdelem elkezdődött.");
}

function prepEnemy(enemy) {
  const copy = { ...enemy, maxStamina: enemy.stamina };
  for (const adjustment of enemy.adjustments ?? []) {
    if (adjustment.flag && state.flags[adjustment.flag]) {
      copy.skill += adjustment.skill ?? 0;
      copy.stamina += adjustment.stamina ?? 0;
      copy.name = adjustment.name ?? copy.name;
    }
  }
  copy.maxStamina = copy.stamina;
  return copy;
}

function activeEnemy() {
  if (!state.combat?.enemies?.length) return null;
  const index = Math.min(state.combat.enemyIndex, state.combat.enemies.length - 1);
  return state.combat.enemies[index];
}

function renderCombat(chapter, fallbackLog = "") {
  const enemy = activeEnemy();
  if (!enemy) {
    state.combat = null;
    enterChapter(chapter.combat.afterWin);
    return;
  }
  elements.combatPanel.classList.remove("hidden");
  elements.enemyName.textContent = enemy.name;
  elements.enemyStats.textContent = `Ügyesség ${enemy.skill} · Életerő ${enemy.stamina}/${enemy.maxStamina}`;
  elements.combatLog.textContent = state.combat.lastLog ?? fallbackLog;

  const enemyCurrent = Math.max(0, enemy.stamina);
  elements.enemyMeter.style.width = `${Math.round((enemyCurrent / Math.max(1, enemy.maxStamina)) * 100)}%`;
  elements.enemyMeterText.textContent = `${enemyCurrent}/${enemy.maxStamina}`;
  renderSheet();

  elements.choices.innerHTML = "";

  if (state.combat.pendingLuck) {
    elements.choices.appendChild(choiceButton({
      label: "Szerencsét próbálok",
      hint: `Jelenlegi Szerencse: ${state.player.luck}. Sikerrel jobb lesz a sebzés, kudarc esetén rosszabb.`
    }, () => resolveCombatLuck(chapter)));
    elements.choices.appendChild(choiceButton({
      label: "Nem kockáztatok",
      hint: "A forduló eredménye változatlan marad."
    }, () => skipCombatLuck(chapter)));
    return;
  }

  if (state.combat.finished) {
    elements.choices.appendChild(choiceButton({
      label: chapter.combat.winLabel ?? "Tovább",
      hint: "A harc véget ért.",
      tone: "good"
    }, () => {
      applyEffects(chapter.combat.winEffects, "combat");
      enterChapter(chapter.combat.afterWin);
    }));
    return;
  }

  elements.choices.appendChild(choiceButton({
    label: "Következő harci forduló",
    hint: "Mindkét fél 2k6 + Ügyesség támadóerőt dob."
  }, () => combatRound(chapter)));

  if (chapter.combat.fleeTo) {
    elements.choices.appendChild(choiceButton({
      label: "Menekülés",
      hint: "Automatikus 2 Életerő sebzés, utána elhagyod a harcot.",
      tone: "danger"
    }, () => fleeCombat(chapter)));
  }
}

function attackStrength(skill) {
  const roll = rollDice(2);
  return { roll, total: roll.total + skill };
}

function combatRound(chapter) {
  const enemy = activeEnemy();
  if (!enemy || state.combat.finished) return renderCombat(chapter);
  const weapon = currentWeapon();
  const playerAttack = attackStrength(state.player.skill + (weapon.attackBonus ?? 0));
  const enemyAttack = attackStrength(enemy.skill);
  const playerText = `Te: ${playerAttack.total}`;
  const enemyText = `${enemy.name}: ${enemyAttack.total}`;

  if (playerAttack.total > enemyAttack.total) {
    enemy.stamina -= 2;
    state.combat.lastLog = `${playerText}, ${enemyText}. Találtál: az ellenfél 2 Életerőt veszít.`;
    if (enemy.stamina > 0 && state.player.luck > 0) {
      state.combat.pendingLuck = { type: "attack" };
    }
  } else if (enemyAttack.total > playerAttack.total) {
    state.player.stamina -= 2;
    state.combat.lastLog = `${playerText}, ${enemyText}. Téged találtak el: 2 Életerőt veszítesz.`;
    if (state.player.stamina > 0 && state.player.luck > 0) {
      state.combat.pendingLuck = { type: "defense" };
    }
  } else {
    state.combat.lastLog = `${playerText}, ${enemyText}. A pengék összeakadnak, nincs sebzés.`;
  }

  if (finishRoundIfNeeded(chapter)) return;
  saveGame();
  renderCombat(chapter);
}

function resolveCombatLuck(chapter) {
  const pending = state.combat.pendingLuck;
  const enemy = activeEnemy();
  const target = state.player.luck;
  const roll = rollDice(2);
  const lucky = roll.total <= target;
  state.player.luck -= 1;

  if (pending.type === "attack") {
    if (lucky) {
      enemy.stamina -= 2;
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: siker. A seb mélyült, az ellenfél további 2 Életerőt veszít.`;
    } else {
      enemy.stamina += 1;
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: kudarc. A csapás csak karcolás, 1 Életerőt visszaad az ellenfélnek.`;
    }
  }

  if (pending.type === "defense" || pending.type === "flee") {
    if (lucky) {
      state.player.stamina += 1;
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: siker. A seb enyhébb, 1 Életerőt visszanyersz.`;
    } else {
      state.player.stamina -= 1;
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: kudarc. A találat rosszabb, még 1 Életerőt veszítesz.`;
    }
  }

  state.combat.pendingLuck = null;
  if (finishRoundIfNeeded(chapter)) return;

  if (pending.type === "flee" && state.player.stamina > 0) {
    saveGame();
    enterChapter(chapter.combat.fleeTo);
    return;
  }

  saveGame();
  renderCombat(chapter);
}

function skipCombatLuck(chapter) {
  const pending = state.combat.pendingLuck;
  state.combat.pendingLuck = null;

  if (pending?.type === "flee" && state.player.stamina > 0) {
    enterChapter(chapter.combat.fleeTo);
    return;
  }

  if (finishRoundIfNeeded(chapter)) return;
  saveGame();
  renderCombat(chapter);
}

function finishRoundIfNeeded(chapter) {
  const enemy = activeEnemy();
  clampStats();

  if (state.player.stamina <= 0) {
    state.combat = null;
    state.currentChapter = "c049";
    saveGame();
    render();
    return true;
  }

  if (enemy.stamina <= 0) {
    state.combat.enemyIndex += 1;
    if (state.combat.enemyIndex >= state.combat.enemies.length) {
      state.combat.finished = true;
      state.combat.lastLog = chapter.combat.victoryText ?? "Az ellenfeled elterül. A terem elcsendesedik.";
    } else {
      const next = activeEnemy();
      state.combat.lastLog = `${enemy.name} elesett. A következő ellenfél előrelép: ${next.name}.`;
    }
  }

  return false;
}

function fleeCombat(chapter) {
  state.player.stamina -= chapter.combat.fleeDamage ?? 2;
  state.combat.lastLog = "Hátat fordítasz a harcnak. A menekülés ára 2 Életerő.";

  if (state.player.stamina <= 0) {
    finishRoundIfNeeded(chapter);
    return;
  }

  if (state.player.luck > 0) {
    state.combat.pendingLuck = { type: "flee" };
    saveGame();
    renderCombat(chapter);
    return;
  }

  enterChapter(chapter.combat.fleeTo);
}

function eatProvision() {
  if (state.provisions <= 0 || state.player.stamina >= state.initial.stamina || state.combat) return;
  state.provisions -= 1;
  state.player.stamina += story.rules.provisionHeal;
  clampStats();
  addEvent(`Ettél egy adag élelmet, +${story.rules.provisionHeal} Életerő.`);
  saveGame();
  render();
}

function drinkPotion() {
  if (state.potion.doses <= 0 || state.combat) return;

  const potion = story.potions[state.potion.type];
  state.potion.doses -= 1;
  applyEffects(potion.effects, "potion");
  addEvent(`Megittál egy adagot: ${potion.name}.`);
  saveGame();
  render();
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  state.combat = null;
  openSetup();
}

function setupAudio() {
  elements.music.volume = 0.45;
  elements.musicToggle.addEventListener("click", async () => {
    if (elements.music.paused) {
      await elements.music.play().catch(() => {});
      elements.musicToggle.classList.add("active");
      return;
    }
    elements.music.muted = !elements.music.muted;
    elements.musicToggle.classList.toggle("active", !elements.music.muted);
  });
}

async function init() {
  const response = await fetch(STORY_URL);
  story = await response.json();
  chapters = new Map(story.chapters.map((chapter) => [chapter.id, chapter]));

  setupAudio();
  elements.eatButton.addEventListener("click", eatProvision);
  elements.potionButton.addEventListener("click", drinkPotion);
  elements.resetButton.addEventListener("click", resetGame);
  elements.rerollButton.addEventListener("click", () => renderSetupRolls(rollHero()));
  elements.startButton.addEventListener("click", () => {
    newState(pendingRoll, selectedPotion);
    closeSetup();
    enterChapter("c001");
  });
  elements.rulesToggle.addEventListener("click", () => elements.rulesModal.classList.remove("hidden"));
  elements.closeRulesButton.addEventListener("click", () => elements.rulesModal.classList.add("hidden"));
  elements.rulesModal.addEventListener("click", (event) => {
    if (event.target === elements.rulesModal) elements.rulesModal.classList.add("hidden");
  });

  if (!loadGame()) {
    openSetup();
  }

  render();
}

init().catch((error) => {
  elements.chapterTitle.textContent = "Nem sikerült betölteni a játékot";
  elements.storyText.innerHTML = `<p>${error.message}</p>`;
});
