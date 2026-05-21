let storyData = {};
let currentChapter = "1";

// Kibővített játékos adatok
let player = {
    hp: 20,
    maxHp: 20,
    skill: 10,
    inventory: []
};

async function initGame() {
    try {
        const response = await fetch('story.json');
        storyData = await response.json();
        
        // Játékos adatainak nullázása
        player.hp = player.maxHp;
        player.skill = 10;
        player.inventory = [];
        currentChapter = "1";
        
        updateUI();
        renderChapter(currentChapter);
    } catch (error) {
        console.error("Hiba történt a történet betöltésekor:", error);
        document.getElementById('story-text').innerText = "Nem sikerült betölteni a kalandot.";
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

    // Tárgyak (Rewards) felvétele
    if (chapter.rewards) {
        chapter.rewards.forEach(item => {
            if (!player.inventory.includes(item)) {
                player.inventory.push(item);
                alert(`Új tárgyat szereztél: ${item}`);
            }
        });
        updateUI();
    }

    textContainer.innerHTML = chapter.text;
    choicesContainer.innerHTML = '';

    // --- HARCRENDSZER ---
    if (chapter.type === "combat") {
        // Ellenfél aktuális életerejének beállítása
        let currentEnemyHp = chapter.enemy.hp;

        // Vizuális doboz az ellenfélnek
        textContainer.innerHTML += `
            <div id="enemy-stats-box" style="background: #4a0000; padding: 15px; margin-top: 15px; border-radius: 5px; border-left: 5px solid #ff3333;">
                <b>⚔️ Ellenfél: ${chapter.enemy.name}</b><br>
                Életerő: <span id="enemy-hp-display" style="color: #ffcc00; font-weight: bold; font-size: 1.2em;">${currentEnemyHp}</span> / ${chapter.enemy.hp} <br>
                Ügyesség: ${chapter.enemy.skill}
            </div>
            <p id="combat-log" style="color: #ffaa00; font-style: italic; margin-top: 10px;"></p>
        `;
        
        const combatLog = document.getElementById('combat-log');
        const enemyHpDisplay = document.getElementById('enemy-hp-display');

        // Harc Gomb
        const fightBtn = document.createElement('button');
        fightBtn.innerText = "⚔️ Támadás!";
        fightBtn.classList.add('choice-btn', 'fight-btn');
        
        fightBtn.addEventListener('click', () => {
            // 1. A játékos sebez
            const playerDmg = Math.floor(Math.random() * 4) + 1;
            currentEnemyHp -= playerDmg;
            
            // 2. Az ellenfél sebez (ha még él)
            let enemyDmg = 0;
            if (currentEnemyHp > 0) {
                enemyDmg = Math.floor(Math.random() * 4) + 1;
                player.hp -= enemyDmg;
            }

            // UI frissítése
            updateUI();
            enemyHpDisplay.innerText = Math.max(0, currentEnemyHp); // Ne menjen mínuszba vizuálisan
            
            // 3. Eredmények kiértékelése
            if (player.hp <= 0) {
                alert(`A(z) ${chapter.enemy.name} halálos sebet ejtett rajtad!`);
                renderChapter("5"); 
            } else if (currentEnemyHp <= 0) {
                combatLog.innerText = `Bevitted a végső csapást! A(z) ${chapter.enemy.name} elpusztult.`;
                combatLog.style.color = "#00ff00";
                
                // Gombok eltávolítása és a továbblépés megjelenítése
                choicesContainer.innerHTML = ''; 
                renderChoices(chapter.choices, choicesContainer);
            } else {
                combatLog.innerText = `Te sebeztél: ${playerDmg} HP-t. Az ellenfél visszatámadt: ${enemyDmg} HP sebzést kaptál.`;
            }
        });

        // Menekülés Gomb
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
        choicesContainer.appendChild(fleeBtn);

    } else {
        // Ha nincs harc, simán kirajzoljuk a gombokat
        renderChoices(chapter.choices, choicesContainer);
    }

    // Újraindítás gomb kezelése
    if (chapter.type === "game_over" || chapter.type === "victory") {
        const restartBtn = document.createElement('button');
        restartBtn.innerText = "🔄 Újraindítás";
        restartBtn.classList.add('choice-btn');
        restartBtn.addEventListener('click', initGame);
        choicesContainer.appendChild(restartBtn);
    }
}

// Gombok legenerálása (csak ha a feltételek engedik)
function renderChoices(choices, container) {
    if (!choices) return;

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

// Jobb alsó statisztika frissítése
function updateUI() {
    const hpEl = document.getElementById('hp');
    const skillEl = document.getElementById('skill');
    const invEl = document.getElementById('inventory');
    
    if (hpEl) hpEl.innerText = player.hp;
    if (skillEl) skillEl.innerText = player.skill;
    if (invEl) invEl.innerText = player.inventory.length > 0 ? player.inventory.join(', ') : 'Üres';
}

// Játék indítása
initGame();