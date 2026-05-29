let storyData = {};
let currentChapter = "1";

let player = {
    hp: 40,
    maxHp: 40,
    skill: 20,
    potions: 3,
    inventory: []
};

async function initGame() {
    try {
        const response = await fetch('story.json');
        storyData = await response.json();
        
        player.hp = player.maxHp;
        player.skill = 20;
        player.potions = 3;
        player.inventory = [];
        currentChapter = "1";
        
        updateUI();
        renderChapter(currentChapter);
    } catch (error) {
        console.error("Hiba történt a történet betöltésekor:", error);
        document.getElementById('story-text').innerText = "Nem sikerült betölteni a kalandot. Ellenőrizd a story.json fájlt!";
    }
}

function renderChapter(chapterId) {
    const chapter = storyData[chapterId];
    const textContainer = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices-container');
    
    if (!chapter) {
        textContainer.innerText = "A történet ezen szála még íródik... Vége.";
        choicesContainer.innerHTML = '';
        return;
    }

    if (chapter.rewards) {
        chapter.rewards.forEach(item => {
            if (!player.inventory.includes(item)) {
                player.inventory.push(item);
                alert(`Új tárgyat szereztél: ${item.replace(/_/g, " ")}`);
            }
        });
        updateUI();
    }

    textContainer.innerHTML = chapter.text;
    choicesContainer.innerHTML = ''; 

    if (chapter.type === "combat") {
        let currentEnemyHp = chapter.enemy.hp;

        textContainer.innerHTML += `
            <div class="combat-box">
                <b>⚔️ Ellenfél: ${chapter.enemy.name}</b><br>
                Életerő: <span id="enemy-hp-display" style="color: #ffcc00; font-weight: bold; font-size: 1.2em;">${currentEnemyHp}</span> / ${chapter.enemy.hp} <br>
                Ügyesség: ${chapter.enemy.skill}
            </div>
            <p id="combat-log" style="color: #ffaa00; font-style: italic; margin-top: 10px; font-weight: bold;"></p>
        `;
        
        const combatLog = document.getElementById('combat-log');
        const enemyHpDisplay = document.getElementById('enemy-hp-display');

        const fightBtn = document.createElement('button');
        fightBtn.innerText = "⚔️ Támadás!";
        fightBtn.classList.add('choice-btn', 'fight-btn');
        fightBtn.addEventListener('click', () => {
            const playerDmg = Math.floor(Math.random() * 4) + 1;
            currentEnemyHp -= playerDmg;
            
            let enemyDmg = 0;
            if (currentEnemyHp > 0) {
                enemyDmg = Math.floor(Math.random() * 4) + 1;
                player.hp -= enemyDmg;
            }

            updateUI();
            enemyHpDisplay.innerText = Math.max(0, currentEnemyHp); 
            
            if (player.hp <= 0) {
                alert(`A(z) ${chapter.enemy.name} halálos sebet ejtett rajtad!`);
                renderChapter("5"); 
            } else if (currentEnemyHp <= 0) {
                combatLog.innerText = `Bevitted a végső csapást! A(z) ${chapter.enemy.name} elpusztult.`;
                combatLog.style.color = "#00ff00";
                choicesContainer.innerHTML = ''; 
                renderChoices(chapter.choices, choicesContainer);
            } else {
                combatLog.innerText = `Te sebeztél: ${playerDmg} HP-t. Az ellenfél visszatámadt: ${enemyDmg} HP sebzést kaptál.`;
            }
        });

        const combatPotionBtn = document.createElement('button');
        combatPotionBtn.innerText = `🧪 Varázsital ivása harc közben (+15 HP)`;
        combatPotionBtn.classList.add('choice-btn', 'potion-btn');
        if (player.potions <= 0 || player.hp >= player.maxHp) combatPotionBtn.disabled = true;

        combatPotionBtn.addEventListener('click', () => {
            if (player.potions > 0 && player.hp < player.maxHp) {
                player.potions--;
                player.hp = Math.min(player.maxHp, player.hp + 15);
                
                const enemyDmg = Math.floor(Math.random() * 4) + 1;
                player.hp -= enemyDmg;

                updateUI();
                if (player.potions <= 0 || player.hp >= player.maxHp) combatPotionBtn.disabled = true;

                if (player.hp <= 0) {
                    alert(`Miközben ittad az italt, a(z) ${chapter.enemy.name} halálos sebet ejtett rajtad!`);
                    renderChapter("5"); 
                } else {
                    combatLog.innerText = `Felhajtottál egy italt! Visszanyertél 15 HP-t. De az ivás közben az ellenfél sebzett rajtad: ${enemyDmg} HP-t.`;
                }
            }
        });

        const fleeBtn = document.createElement('button');
        fleeBtn.innerText = "🏃 Menekülés megkísérlése";
        fleeBtn.classList.add('choice-btn', 'flee-btn');
        fleeBtn.addEventListener('click', () => {
            const dmg = Math.floor(Math.random() * 4) + 1;
            player.hp -= dmg;
            updateUI();

            if (player.hp <= 0) {
                alert(`Menekülés közben hátba támadtak. Kaptál ${dmg} sebzést, ami halálos volt...`);
                renderChapter("5"); 
                return;
            }

            const diceRoll = (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1);
            if (diceRoll <= player.skill) {
                alert(`Sikeresen elmenekültél! (Viszont kaptál ${dmg} sebzést)`);
                currentChapter = chapter.choices[0].next;
                renderChapter(currentChapter);
            } else {
                combatLog.innerText = `Nem sikerült elmenekülni! Kaptál ${dmg} sebzést. A harc folytatódik!`;
            }
        });

        choicesContainer.appendChild(fightBtn);
        choicesContainer.appendChild(combatPotionBtn);
        choicesContainer.appendChild(fleeBtn);

    } else {
        renderChoices(chapter.choices, choicesContainer);
    }

    if (chapter.type === "game_over" || chapter.type === "victory") {
        const restartBtn = document.createElement('button');
        restartBtn.innerText = "🔄 Újraindítás";
        restartBtn.classList.add('choice-btn');
        restartBtn.addEventListener('click', initGame);
        choicesContainer.appendChild(restartBtn);
    }
}

function renderChoices(choices, container) {
    if (!choices) return;

    if (player.potions > 0 && player.hp < player.maxHp) {
        const fullHealBtn = document.createElement('button');
        fullHealBtn.innerText = `🧪 Gyógyital használata: Teljes életerő visszaállítása (+${player.maxHp - player.hp} HP) [${player.potions} db maradt]`;
        fullHealBtn.classList.add('choice-btn', 'potion-btn');
        
        fullHealBtn.addEventListener('click', () => {
            player.potions--;
            player.hp = player.maxHp;
            updateUI();
            
            container.innerHTML = '';
            renderChoices(choices, container);
        });
        container.appendChild(fullHealBtn);
    }

    choices.forEach(choice => {
        let canChoose = true;
        if (choice.requires) {
            canChoose = choice.requires.every(req => player.inventory.includes(req));
        }

        if (canChoose) {
            const button = document.createElement('button');
            button.innerText = choice.text;
            button.classList.add('choice-btn');
            
            button.addEventListener('click', () => {
                currentChapter = choice.next;
                renderChapter(currentChapter);
            });
            container.appendChild(button);
        }
    });
}

function updateUI() {
    const hpEl = document.getElementById('hp');
    const skillEl = document.getElementById('skill');
    const potionsEl = document.getElementById('potions');
    const invEl = document.getElementById('inventory');
    
    if (hpEl) hpEl.innerText = player.hp;
    if (skillEl) skillEl.innerText = player.skill;
    if (potionsEl) potionsEl.innerText = player.potions;
    if (invEl) {
        invEl.innerText = player.inventory.length > 0 ? player.inventory.join(', ').replace(/_/g, " ") : 'Üres';
    }
}

initGame();