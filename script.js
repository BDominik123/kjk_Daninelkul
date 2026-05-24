let storyData = {};
let player = {
    hp: 40,
    maxHp: 40,
    skill: 20,
    potions: 3, // Kezdő italok száma
    inventory: []
};

let currentChapter = "1";

function initGame() {
    player.hp = player.maxHp;
    player.skill = 20;
    player.potions = 3;
    player.inventory = [];
    currentChapter = "1";
    
    updateUI();
    renderChapter(currentChapter);
}

function renderChapter(chapterId) {
    const chapter = storyData[chapterId];
    const textContainer = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices-container');
    
    if (!chapter) return;

    // Tárgyak felvétele
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

    // --- HARCRENDSZER ---
    if (chapter.type === "combat") {
        let currentEnemyHp = chapter.enemy.hp;

        textContainer.innerHTML += `
            <div style="background: #4a0000; padding: 15px; margin-top: 15px; border-radius: 5px; border-left: 5px solid #ff3333;">
                <b>⚔️ Ellenfél: ${chapter.enemy.name}</b><br>
                Életerő: <span id="enemy-hp-display" style="color: #ffcc00; font-weight: bold; font-size: 1.2em;">${currentEnemyHp}</span> / ${chapter.enemy.hp} <br>
                Ügyesség: ${chapter.enemy.skill}
            </div>
            <p id="combat-log" style="color: #ffaa00; font-style: italic; margin-top: 10px; font-weight: bold;"></p>
        `;
        
        const combatLog = document.getElementById('combat-log');
        const enemyHpDisplay = document.getElementById('enemy-hp-display');

        // Támadás
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

        // Harc közbeni Varázsital Gomb (Időbe telik!)
        const combatPotionBtn = document.createElement('button');
        combatPotionBtn.innerText = `🧪 Varázsital ivása harc közben (+15 HP)`;
        combatPotionBtn.classList.add('choice-btn', 'potion-btn');
        if (player.potions <= 0 || player.hp >= player.maxHp) combatPotionBtn.disabled = true;

        combatPotionBtn.addEventListener('click', () => {
            if (player.potions > 0 && player.hp < player.maxHp) {
                player.potions--;
                player.hp = Math.min(player.maxHp, player.hp + 15);
                
                // Az ellenfél üt egyet, mert az ivás időbe telik
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

        // Menekülés
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
        // Ha nincs harc, a sima gombok kirajzolása
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

// Gombok legenerálása a BÉKÉS fejezetekhez
function renderChoices(choices, container) {
    if (!choices) return;

    // BÉKÉS IDŐBEN: Biztonságos Varázsital ivása
    if (player.potions > 0 && player.hp < player.maxHp) {
        const safePotionBtn = document.createElement('button');
        safePotionBtn.innerText = `🧪 Biztonságos gyógyulás: Varázsital ivása (+15 HP) [Van még: ${player.potions} db]`;
        safePotionBtn.classList.add('choice-btn', 'potion-btn');
        
        safePotionBtn.addEventListener('click', () => {
            player.potions--;
            player.hp = Math.min(player.maxHp, player.hp + 15);
            updateUI();
            
            // Miután ivott a játékos, újrarendereljük a gombokat,
            // hogy eltűnjön az ivás gomb, ha elfogyott az ital, vagy tele lett a HP.
            container.innerHTML = '';
            renderChoices(choices, container);
        });
        container.appendChild(safePotionBtn);
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
    document.getElementById('hp').innerText = player.hp;
    document.getElementById('skill').innerText = player.skill;
    document.getElementById('potions').innerText = player.potions;
    
    const invEl = document.getElementById('inventory');
    invEl.innerText = player.inventory.length > 0 ? player.inventory.join(', ').replace(/_/g, " ") : 'Üres';
}

window.onload = initGame;