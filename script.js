"use strict";

const STORY_URL = "story.json";
const SAVE_KEY = "parazskapuk-save-v3";

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const elements = {
  chapterKicker: document.getElementById("chapterKicker"),
  routeHint: document.getElementById("routeHint"),
  chapterTitle: document.getElementById("chapterTitle"),
  storyText: document.getElementById("storyText"),
  choices: document.getElementById("choices"),
  combatPanel: document.getElementById("combatPanel"),
  enemyName: document.getElementById("enemyName"),
  enemyShortName: document.getElementById("enemyShortName"),
  enemyStats: document.getElementById("enemyStats"),
  combatTags: document.getElementById("combatTags"),
  playerAttackText: document.getElementById("playerAttackText"),
  playerMeter: document.getElementById("playerMeter"),
  enemyMeter: document.getElementById("enemyMeter"),
  playerMeterText: document.getElementById("playerMeterText"),
  enemyMeterText: document.getElementById("enemyMeterText"),
  combatLog: document.getElementById("combatLog"),
  autoWinButton: document.getElementById("autoWinButton"),
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
  armorValue: document.getElementById("armorValue"),
  inventoryList: document.getElementById("inventoryList"),
  diceDisplay: document.getElementById("diceDisplay"),
  eventLog: document.getElementById("eventLog"),
  eatButton: document.getElementById("eatButton"),
  potionButton: document.getElementById("potionButton"),
  musicToggle: document.getElementById("musicToggle"),
  resetButton: document.getElementById("resetButton"),
  rulesToggle: document.getElementById("rulesToggle"),
  finishNowButton: document.getElementById("finishNowButton"),
  setupModal: document.getElementById("setupModal"),
  rolledStats: document.getElementById("rolledStats"),
  potionPicker: document.getElementById("potionPicker"),
  rerollButton: document.getElementById("rerollButton"),
  startButton: document.getElementById("startButton"),
  rulesModal: document.getElementById("rulesModal"),
  closeRulesButton: document.getElementById("closeRulesButton"),
  toast: document.getElementById("toast"),
  music: document.getElementById("bgMusic")
};

let story = null;
let chapters = new Map();
let pendingRoll = null;
let selectedPotion = "stamina";
let toastTimer = 0;

let state = emptyState();

function emptyState() {
  return {
    version: 3,
    currentChapter: "c001",
    initial: { skill: 0, stamina: 0, luck: 0 },
    player: { skill: 0, stamina: 0, luck: 0 },
    provisions: 0,
    gold: 0,
    potion: { type: "stamina", doses: 0 },
    inventory: [],
    weapon: "basic_sword",
    armor: "leather_armor",
    flags: {},
    appliedChapters: {},
    combat: null,
    events: []
  };
}

function d6() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollQuiet(count) {
  const dice = Array.from({ length: count }, d6);
  return {
    dice,
    total: dice.reduce((sum, die) => sum + die, 0)
  };
}

function setDiceDisplay(lines) {
  elements.diceDisplay.textContent = lines.join(" · ");
}

function formatDice(label, roll) {
  return `${label}: ${roll.dice.join("+")}=${roll.total}`;
}

function rollHero() {
  const skill = d6() + 6;
  const stamina = rollQuiet(2).total + 12;
  const luck = d6() + 6;
  return { skill, stamina, luck };
}

function statName(stat) {
  return {
    skill: "Ügyesség",
    stamina: "Életerő",
    luck: "Szerencse"
  }[stat] ?? stat;
}

function clampStats() {
  state.player.skill = Math.max(0, Math.min(state.player.skill, state.initial.skill));
  state.player.stamina = Math.max(0, Math.min(state.player.stamina, state.initial.stamina));
  state.player.luck = Math.max(0, Math.min(state.player.luck, state.initial.luck));
  state.provisions = Math.max(0, state.provisions);
  state.gold = Math.max(0, state.gold);
}

function hasItem(item) {
  return state.inventory.includes(item);
}

function itemLabel(id) {
  return story?.items?.[id]?.name ?? id.replaceAll("_", " ");
}

function weaponData(id = state.weapon) {
  return story?.weapons?.[id] ?? story?.weapons?.basic_sword ?? { name: "Kard", attackBonus: 0, damageBonus: 0, tags: [] };
}

function armorData(id = state.armor) {
  return story?.armor?.[id] ?? story?.armor?.leather_armor ?? { name: "Bőrpáncél", reduction: 0 };
}

function weaponLabel(id = state.weapon) {
  return weaponData(id).name ?? itemLabel(id);
}

function armorLabel(id = state.armor) {
  return armorData(id).name ?? itemLabel(id);
}

function addEvent(message) {
  if (!message) return;
  state.events.unshift(message);
  state.events = state.events.slice(0, 12);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => elements.toast.classList.add("hidden"), 2400);
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // A játék mentés nélkül is fut.
  }
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || saved.version !== 3 || !saved.player || !saved.initial) return false;
    state = { ...emptyState(), ...saved };
    state.flags = saved.flags ?? {};
    state.appliedChapters = saved.appliedChapters ?? {};
    state.events = saved.events ?? [];
    return true;
  } catch {
    return false;
  }
}

function renderSetupRolls(rolls) {
  pendingRoll = rolls;
  elements.rolledStats.replaceChildren(...[
    ["Ügyesség", rolls.skill],
    ["Életerő", rolls.stamina],
    ["Szerencse", rolls.luck]
  ].map(([label, value]) => {
    const card = document.createElement("div");
    card.className = "roll-card";
    const name = document.createElement("span");
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    card.append(name, number);
    return card;
  }));
}

function renderPotionPicker() {
  const buttons = Object.entries(story.potions).map(([id, potion]) => {
    const button = document.createElement("button");
    button.className = `potion-card${id === selectedPotion ? " selected" : ""}`;
    button.type = "button";
    button.dataset.potion = id;

    const kicker = document.createElement("span");
    kicker.textContent = potion.kicker;
    const name = document.createElement("strong");
    name.textContent = potion.name;
    button.append(kicker, name);

    button.addEventListener("click", () => {
      selectedPotion = id;
      renderPotionPicker();
    });
    return button;
  });

  elements.potionPicker.replaceChildren(...buttons);
}

function openSetup() {
  renderSetupRolls(rollHero());
  renderPotionPicker();
  elements.setupModal.classList.remove("hidden");
}

function closeSetup() {
  elements.setupModal.classList.add("hidden");
}

function newState(rolls, potionType) {
  state = emptyState();
  state.currentChapter = story.rules.startChapter;
  state.initial = { ...rolls };
  state.player = { ...rolls };
  state.provisions = story.rules.startingProvisions;
  state.gold = story.rules.startingGold;
  state.potion = { type: potionType, doses: story.rules.potionDoses };
  state.inventory = [...story.rules.startingInventory];
  state.weapon = story.rules.startingWeapon;
  state.armor = story.rules.startingArmor;
  state.events = ["A kalandlap elkészült."];
}

function applyEffects(effects = [], source = "effect") {
  for (const effect of effects) {
    if (effect.type === "addItem" && !hasItem(effect.item)) {
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
      if (delta !== 0) addEvent(`${statName(effect.stat)} ${delta > 0 ? "nőtt" : "csökkent"} ${Math.abs(delta)} ponttal.`);
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
      if (!hasItem(effect.weapon)) state.inventory.push(effect.weapon);
      addEvent(`Fegyvert váltottál: ${weaponLabel(effect.weapon)}.`);
    }

    if (effect.type === "equipArmor") {
      state.armor = effect.armor;
      if (!hasItem(effect.armor)) state.inventory.push(effect.armor);
      addEvent(`Védelmet váltottál: ${armorLabel(effect.armor)}.`);
    }

    if (effect.type === "message") {
      addEvent(effect.text);
    }

    if (effect.type === "death") {
      state.player.stamina = 0;
      addEvent(effect.message ?? "A kaland véget ért.");
    }
  }

  clampStats();
  if (state.player.stamina <= 0 && state.currentChapter !== story.rules.deathChapter) {
    state.currentChapter = story.rules.deathChapter;
  }
  if (source !== "silent") saveGame();
}

function enterChapter(id) {
  state.combat = null;
  state.currentChapter = id;
  const chapter = chapters.get(id);

  if (!chapter) {
    saveGame();
    renderMissingChapter(id);
    return;
  }

  if (!state.appliedChapters[id]) {
    applyEffects(chapter.effects, "silent");
    state.appliedChapters[id] = true;
  }

  if (state.player.stamina <= 0 && chapter.type !== "ending") {
    state.currentChapter = story.rules.deathChapter;
  }

  saveGame();
  render();
  scrollToStoryTop();
}

function scrollToStoryTop() {
  window.scrollTo({ top: 0, behavior: "auto" });
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

function renderMissingChapter(id) {
  elements.chapterKicker.textContent = id;
  elements.routeHint.textContent = "Hiányzó út";
  elements.chapterTitle.textContent = "Hiányzó fejezet";
  elements.storyText.replaceChildren(paragraph("Ez a fejezet még nincs a történetben."));
  elements.combatPanel.classList.add("hidden");
  elements.choices.replaceChildren();
  renderSheet();
}

function paragraph(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

function render() {
  const chapter = chapters.get(state.currentChapter);
  if (!chapter) return renderMissingChapter(state.currentChapter);

  elements.chapterKicker.textContent = `${chapter.id.replace("c", "")}. fejezet`;
  elements.routeHint.textContent = routeText(chapter);
  elements.chapterTitle.textContent = chapter.title;
  elements.storyText.replaceChildren(...chapter.text.map(paragraph));

  renderSheet();

  if (chapter.type === "combat") {
    startCombat(chapter);
    return;
  }

  elements.combatPanel.classList.add("hidden");
  renderChoices(chapter.choices ?? []);
}

function routeText(chapter) {
  if (chapter.type === "combat") return "Harc";
  if (chapter.type === "ending" && chapter.ending === "victory") return "Kivitted";
  if (chapter.type === "ending") return "Végállomás";
  return `${chapter.choices?.length ?? 0} út`;
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

  const potion = story?.potions?.[state.potion.type];
  elements.potionValue.textContent = potion ? `${potion.short} (${state.potion.doses})` : "-";
  elements.weaponValue.textContent = weaponLabel();
  elements.armorValue.textContent = armorLabel();

  const hiddenGear = new Set([state.weapon, state.armor]);
  const inventory = state.inventory.filter((item) => !hiddenGear.has(item));
  const chips = inventory.length
    ? inventory.map((item) => {
        const chip = document.createElement("span");
        chip.className = "inventory-item";
        chip.textContent = itemLabel(item);
        return chip;
      })
    : [emptyInventoryChip()];
  elements.inventoryList.replaceChildren(...chips);

  const inCombat = Boolean(state.combat);
  elements.eatButton.disabled = state.provisions <= 0 || state.player.stamina >= state.initial.stamina || inCombat;
  elements.potionButton.disabled = state.potion.doses <= 0 || inCombat;
  elements.eventLog.replaceChildren(...state.events.map(paragraph));

  updateMeter(elements.playerMeter, state.player.stamina, state.initial.stamina);
  elements.playerMeterText.textContent = `${Math.max(0, state.player.stamina)}/${Math.max(1, state.initial.stamina)}`;
}

function emptyInventoryChip() {
  const chip = document.createElement("span");
  chip.className = "inventory-item";
  chip.textContent = "üres";
  return chip;
}

function updateMeter(element, current, max) {
  const percent = Math.max(0, Math.min(100, Math.round((current / Math.max(1, max)) * 100)));
  element.style.width = `${percent}%`;
}

function renderChoices(choices) {
  elements.choices.replaceChildren();

  if (!choices.length) {
    const chapter = chapters.get(state.currentChapter);
    if (chapter?.type === "ending") {
      elements.choices.appendChild(choiceButton({ label: "Új játék", hint: "Új kalandlapot dobsz.", tone: "good" }, resetGame));
    }
    return;
  }

  for (const choice of choices) {
    const availability = choiceAvailable(choice);
    const button = choiceButton(choice, () => choose(choice));
    if (!availability.ok) {
      button.disabled = true;
      button.querySelector("span").textContent = availability.reason;
    }
    elements.choices.appendChild(button);
  }
}

function choiceButton(choice, action) {
  const button = document.createElement("button");
  button.className = `choice-button ${choice.tone ?? ""}`.trim();
  button.type = "button";

  const label = document.createElement("strong");
  label.textContent = choice.label;
  const hint = document.createElement("span");
  hint.textContent = choice.hint ?? "";
  button.append(label, hint);
  button.addEventListener("click", action);
  return button;
}

function choiceAvailable(choice) {
  const req = choice.requires ?? {};

  if (req.items) {
    const missing = req.items.filter((item) => !hasItem(item));
    if (missing.length) return { ok: false, reason: `Hiányzik: ${missing.map(itemLabel).join(", ")}.` };
  }

  if (req.anyItems) {
    const hasAny = req.anyItems.some(hasItem);
    if (!hasAny) return { ok: false, reason: `Legalább egy kell: ${req.anyItems.map(itemLabel).join(", ")}.` };
  }

  if (req.flags) {
    const missingFlag = req.flags.find((flag) => !state.flags[flag]);
    if (missingFlag) return { ok: false, reason: "Ehhez még nincs meg a szükséges nyom." };
  }

  if (req.notFlags) {
    const blocked = req.notFlags.find((flag) => state.flags[flag]);
    if (blocked) return { ok: false, reason: "Ezt már nem választhatod." };
  }

  if (req.gold && state.gold < req.gold) return { ok: false, reason: `Ehhez ${req.gold} arany kell.` };
  if (req.provisions && state.provisions < req.provisions) return { ok: false, reason: `Ehhez ${req.provisions} adag élelem kell.` };

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
  const roll = rollQuiet(2);
  setDiceDisplay([formatDice(statName(test.stat), roll)]);
  const target = state.player[test.stat];
  const success = roll.total <= target;
  let next = success ? test.success : test.failure;

  if (test.stat === "luck") state.player.luck -= 1;

  applyEffects(success ? test.successEffects : test.failureEffects, "test");
  addEvent(`${statName(test.stat)} próba: ${roll.total} ${success ? "siker" : "kudarc"} a ${target} ellen.`);
  clampStats();

  if (state.player.stamina <= 0) next = story.rules.deathChapter;
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
      finished: false,
      rounds: 0,
      armorUsed: false,
      lastLog: "A küzdelem elkezdődött.",
      playerAttackText: "Támadóerő: -",
      enemyAttackText: "Támadóerő: -"
    };
  }

  renderCombat(chapter);
}

function prepEnemy(enemy) {
  const copy = structuredClone(enemy);
  for (const adjustment of copy.adjustments ?? []) {
    if (adjustment.flag && state.flags[adjustment.flag]) {
      copy.skill += adjustment.skill ?? 0;
      copy.stamina += adjustment.stamina ?? 0;
      copy.damage = (copy.damage ?? story.rules.combat.baseDamage) + (adjustment.damage ?? 0);
      copy.name = adjustment.name ?? copy.name;
      copy.tags = [...new Set([...(copy.tags ?? []), ...(adjustment.addTags ?? [])])];
    }
  }
  copy.maxStamina = Math.max(1, copy.stamina);
  copy.stamina = Math.max(1, copy.stamina);
  copy.id = copy.id ?? copy.name.toLowerCase().replaceAll(" ", "_");
  return copy;
}

function activeEnemy() {
  if (!state.combat?.enemies?.length) return null;
  return state.combat.enemies[Math.min(state.combat.enemyIndex, state.combat.enemies.length - 1)];
}

function renderCombat(chapter) {
  const enemy = activeEnemy();
  if (!enemy) {
    completeCombat(chapter);
    return;
  }

  elements.combatPanel.classList.remove("hidden");
  elements.enemyName.textContent = enemy.name;
  elements.enemyShortName.textContent = enemy.name;
  elements.enemyStats.textContent = `Ügyesség ${enemy.skill} · Életerő ${Math.max(0, enemy.stamina)}/${enemy.maxStamina}`;
  elements.playerAttackText.textContent = state.combat.playerAttackText;
  elements.combatLog.textContent = state.combat.lastLog;
  elements.autoWinButton.disabled = false;

  updateMeter(elements.enemyMeter, enemy.stamina, enemy.maxStamina);
  elements.enemyMeterText.textContent = `${Math.max(0, enemy.stamina)}/${enemy.maxStamina}`;
  renderCombatTags(enemy);
  renderSheet();
  elements.choices.replaceChildren();

  if (state.combat.pendingLuck) {
    elements.choices.appendChild(choiceButton({
      label: "Szerencsét próbálok",
      hint: `Jelenlegi Szerencse: ${state.player.luck}. A próba után 1 ponttal csökken.`,
      tone: "combat-action"
    }, () => resolveCombatLuck(chapter)));
    elements.choices.appendChild(choiceButton({
      label: "Nem kockáztatok",
      hint: "A találat eredménye változatlan marad."
    }, () => skipCombatLuck(chapter)));
    return;
  }

  if (state.combat.finished) {
    elements.choices.appendChild(choiceButton({
      label: chapter.combat.winLabel ?? "Tovább",
      hint: "A harc véget ért.",
      tone: "good"
    }, () => completeCombat(chapter)));
    return;
  }

  elements.choices.appendChild(combatButton({
    label: "Harci forduló",
    hint: "2k6 + Ügyesség + fegyverbónusz. A biztos alap.",
    mode: "normal"
  }, chapter));
  elements.choices.appendChild(combatButton({
    label: "Védekező állás",
    hint: "Kisebb kockázat: gyengébb támadás, de kevesebb kapott sebzés.",
    mode: "guard"
  }, chapter));

  const power = combatButton({
    label: "Erős támadás",
    hint: "Nagyobb sebzés, de -2 támadóerő és hibánál fájdalmasabb ellenütés.",
    mode: "power",
    tone: "danger"
  }, chapter);
  if (state.player.stamina <= 2) {
    power.disabled = true;
    power.querySelector("span").textContent = "Ehhez legalább 3 Életerő kell.";
  }
  elements.choices.appendChild(power);

  if (chapter.combat.fleeTo) {
    elements.choices.appendChild(choiceButton({
      label: "Menekülés",
      hint: `${chapter.combat.fleeDamage ?? story.rules.combat.fleeDamage} Életerő sebzés, majd elhagyod a harcot.`,
      tone: "danger"
    }, () => fleeCombat(chapter)));
  }
}

function renderCombatTags(enemy) {
  const tags = [
    ...(enemy.traits ?? []),
    ...(enemy.tags ?? []),
    weaponData().attackBonus ? `${weaponLabel()} +${weaponData().attackBonus}` : null
  ].filter(Boolean);

  if (!tags.length) {
    elements.combatTags.replaceChildren();
    return;
  }

  elements.combatTags.replaceChildren(...tags.map((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = combatTagLabel(tag);
    return chip;
  }));
}

function combatTagLabel(tag) {
  return story.combatTags?.[tag] ?? tag;
}

function combatButton(choice, chapter) {
  const button = choiceButton(choice, () => combatRound(chapter, choice.mode));
  button.classList.add("combat-action");
  return button;
}

function combatRound(chapter, mode) {
  const enemy = activeEnemy();
  if (!enemy || state.combat.finished || state.combat.pendingLuck) return;

  const weapon = weaponData();
  const playerRoll = rollQuiet(2);
  const enemyRoll = rollQuiet(2);
  const modifiers = combatModeModifiers(mode, enemy);
  const playerSkill = state.player.skill + (weapon.attackBonus ?? 0) + modifiers.playerAttack;
  const enemySkill = enemy.skill + modifiers.enemyAttack;
  const playerTotal = playerRoll.total + playerSkill;
  const enemyTotal = enemyRoll.total + enemySkill;

  state.combat.rounds += 1;
  state.combat.playerAttackText = `Támadóerő: ${playerTotal}`;
  state.combat.enemyAttackText = `Támadóerő: ${enemyTotal}`;
  setDiceDisplay([formatDice("Te", playerRoll), formatDice(enemy.name, enemyRoll)]);

  if (playerTotal > enemyTotal) {
    const damage = playerDamage(enemy, modifiers.playerDamage);
    enemy.stamina -= damage;
    state.combat.lastLog = `${modeLabel(mode)} ${playerTotal} : ${enemyTotal}. Találtál, ${enemy.name} ${damage} Életerőt veszít.`;
    maybeAddEnemyReaction(enemy, "hit");
    if (enemy.stamina > 0 && state.player.luck > 0) {
      state.combat.pendingLuck = { type: "attack", enemyIndex: state.combat.enemyIndex };
    }
  } else if (enemyTotal > playerTotal) {
    const damage = incomingDamage(enemy, modifiers.incomingReduction, modifiers.missPenalty, mode);
    state.player.stamina -= damage;
    state.combat.lastLog = `${modeLabel(mode)} ${playerTotal} : ${enemyTotal}. ${enemy.name} talál, ${damage} Életerőt veszítesz.`;
    applyEnemyAfterHit(enemy, damage);
    if (state.player.stamina > 0 && state.player.luck > 0) {
      state.combat.pendingLuck = { type: "defense" };
    }
  } else {
    state.combat.lastLog = `${modeLabel(mode)} ${playerTotal} : ${enemyTotal}. A csapások kioltják egymást, nincs sebzés.`;
  }

  if (finishRoundIfNeeded(chapter)) return;
  saveGame();
  renderCombat(chapter);
}

function combatModeModifiers(mode, enemy) {
  const shielded = hasItem("shield") || hasItem("ember_shield");
  if (mode === "guard") {
    return {
      playerAttack: shielded ? 0 : -1,
      enemyAttack: 0,
      playerDamage: 0,
      incomingReduction: shielded ? 2 : 1,
      missPenalty: 0
    };
  }

  if (mode === "power") {
    return {
      playerAttack: -2,
      enemyAttack: enemy.traits?.includes("quick") ? 1 : 0,
      playerDamage: 2,
      incomingReduction: 0,
      missPenalty: 1
    };
  }

  return {
    playerAttack: 0,
    enemyAttack: 0,
    playerDamage: 0,
    incomingReduction: 0,
    missPenalty: 0
  };
}

function modeLabel(mode) {
  return {
    normal: "Harci forduló",
    guard: "Védekezés",
    power: "Erős támadás"
  }[mode] ?? "Harci forduló";
}

function playerDamage(enemy, modeBonus) {
  const weapon = weaponData();
  let damage = story.rules.combat.baseDamage + (weapon.damageBonus ?? 0) + modeBonus;

  if (enemy.traits?.includes("armored")) damage -= 1;
  if (enemy.tags?.includes("undead") && weapon.tags?.includes("silver")) damage += 1;
  if (enemy.tags?.includes("demon") && weapon.tags?.includes("obsidian")) damage += 1;
  if (state.flags.warlock_weakened && enemy.id === "warlock") damage += 1;

  return Math.max(1, damage);
}

function incomingDamage(enemy, reduction, missPenalty, mode) {
  let damage = enemy.damage ?? story.rules.combat.baseDamage;

  if (enemy.traits?.includes("brutal") && mode !== "guard") damage += 1;
  if (enemy.traits?.includes("fire")) damage += hasItem("ember_shield") ? 0 : 1;
  if (enemy.traits?.includes("quick") && mode === "power") damage += 1;

  const armor = armorData();
  damage -= armor.reduction ?? 0;
  damage -= reduction;
  damage += missPenalty;

  if (enemy.traits?.includes("piercing")) damage += 1;
  return Math.max(1, damage);
}

function maybeAddEnemyReaction(enemy, trigger) {
  if (trigger === "hit" && enemy.traits?.includes("splitting") && enemy.stamina > 0 && !enemy.splitDone) {
    enemy.splitDone = true;
    enemy.skill = Math.max(1, enemy.skill - 1);
    enemy.stamina += 2;
    enemy.maxStamina += 2;
    state.combat.lastLog += " A teste kettéválik, és nehezebb lesz végleg leteríteni.";
  }
}

function applyEnemyAfterHit(enemy, damage) {
  const notes = [];

  if (enemy.traits?.includes("venom") && damage > 0 && state.player.luck > 0) {
    state.player.luck -= 1;
    notes.push("A méreg 1 Szerencsét éget el.");
  }

  if (enemy.traits?.includes("curse") && damage > 0 && state.player.skill > 1) {
    state.player.skill -= 1;
    notes.push("Az átok 1 Ügyességet vesz el.");
  }

  if (enemy.traits?.includes("fire") && hasItem("ember_shield")) {
    notes.push("A parázspajzs felfogja a lángok rosszabb részét.");
  }

  if (notes.length) state.combat.lastLog += ` ${notes.join(" ")}`;
  clampStats();
}

function resolveCombatLuck(chapter) {
  const pending = state.combat.pendingLuck;
  const enemy = activeEnemy();
  if (!pending || !enemy) return;

  const target = state.player.luck;
  const roll = rollQuiet(2);
  const lucky = roll.total <= target;
  setDiceDisplay([formatDice("Szerencse", roll)]);
  state.player.luck -= 1;

  if (pending.type === "attack") {
    if (lucky) {
      enemy.stamina -= story.rules.combat.luckAttackBonus;
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: siker. A seb mélyül, ${enemy.name} további ${story.rules.combat.luckAttackBonus} Életerőt veszít.`;
    } else {
      enemy.stamina = Math.min(enemy.maxStamina, enemy.stamina + story.rules.combat.unluckyAttackHeal);
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: kudarc. Rosszul fordul a penge, az ellenfél ${story.rules.combat.unluckyAttackHeal} Életerőt visszanyer.`;
    }
  }

  if (pending.type === "defense" || pending.type === "flee") {
    if (lucky) {
      state.player.stamina += story.rules.combat.luckDefenseHeal;
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: siker. A seb enyhébb, ${story.rules.combat.luckDefenseHeal} Életerőt visszanyersz.`;
    } else {
      state.player.stamina -= story.rules.combat.unluckyDefenseDamage;
      state.combat.lastLog = `Szerencsepróba ${roll.total}/${target}: kudarc. A találat rosszabb, még ${story.rules.combat.unluckyDefenseDamage} Életerőt veszítesz.`;
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
    state.currentChapter = story.rules.deathChapter;
    saveGame();
    render();
    return true;
  }

  if (enemy && enemy.stamina <= 0) {
    state.combat.pendingLuck = null;
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
  const damage = chapter.combat.fleeDamage ?? story.rules.combat.fleeDamage;
  state.player.stamina -= damage;
  state.combat.lastLog = `Hátat fordítasz a harcnak. A menekülés ára ${damage} Életerő.`;

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

function completeCombat(chapter) {
  applyEffects(chapter.combat.winEffects, "combat");
  state.combat = null;
  enterChapter(chapter.combat.afterWin);
}

function autoWinCombat() {
  const chapter = chapters.get(state.currentChapter);
  if (!chapter || chapter.type !== "combat" || !state.combat) return;

  for (const enemy of state.combat.enemies) enemy.stamina = 0;
  state.combat.finished = true;
  state.combat.pendingLuck = null;
  state.combat.lastLog = "Auto win: a harc lezárva, az ellenfelek legyőzve.";
  addEvent("Auto win használva a harcban.");
  showToast("Harc megnyerve.");
  completeCombat(chapter);
}

function finishGame() {
  const winChapter = story.rules.winChapter;
  state.combat = null;
  state.flags.won = true;
  state.flags.shortcut_win = true;
  addEvent("Kivitted a játékot a gyors befejezés gombbal.");
  saveGame();
  enterChapter(winChapter);
  addEvent("Kivitted a játékot!");
  saveGame();
  render();
  showToast("Kivitted a játékot!");
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
  state = emptyState();
  elements.diceDisplay.textContent = "-";
  openSetup();
  render();
}

function setupAudio() {
  elements.music.volume = 0.42;
  elements.musicToggle.addEventListener("click", async () => {
    if (elements.music.paused) {
      await elements.music.play().catch(() => {});
      elements.music.muted = false;
      elements.musicToggle.classList.add("active");
      return;
    }

    elements.music.muted = !elements.music.muted;
    elements.musicToggle.classList.toggle("active", !elements.music.muted);
  });
}

function setupEvents() {
  elements.eatButton.addEventListener("click", eatProvision);
  elements.potionButton.addEventListener("click", drinkPotion);
  elements.resetButton.addEventListener("click", resetGame);
  elements.autoWinButton.addEventListener("click", autoWinCombat);
  elements.finishNowButton.addEventListener("click", finishGame);
  elements.rerollButton.addEventListener("click", () => renderSetupRolls(rollHero()));
  elements.startButton.addEventListener("click", () => {
    newState(pendingRoll, selectedPotion);
    closeSetup();
    enterChapter(story.rules.startChapter);
  });
  elements.rulesToggle.addEventListener("click", () => elements.rulesModal.classList.remove("hidden"));
  elements.closeRulesButton.addEventListener("click", () => elements.rulesModal.classList.add("hidden"));
  elements.rulesModal.addEventListener("click", (event) => {
    if (event.target === elements.rulesModal) elements.rulesModal.classList.add("hidden");
  });
}

async function init() {
  const response = await fetch(STORY_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Nem sikerült betölteni: ${STORY_URL}`);
  story = await response.json();
  chapters = new Map(story.chapters.map((chapter) => [chapter.id, chapter]));

  setupAudio();
  setupEvents();

  if (!loadGame()) openSetup();
  render();
  scrollToStoryTop();
}

init().catch((error) => {
  elements.chapterKicker.textContent = "Hiba";
  elements.routeHint.textContent = "Betöltés";
  elements.chapterTitle.textContent = "Nem sikerült elindítani a játékot";
  elements.storyText.replaceChildren(paragraph(error.message));
  elements.combatPanel.classList.add("hidden");
  elements.choices.replaceChildren();
});
