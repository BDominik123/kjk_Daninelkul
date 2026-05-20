(function () {
    const music = document.getElementById('bg-music');
    const slider = document.getElementById('volume-range');
    const display = document.getElementById('volume-display');
    const muteBtn = document.getElementById('mute-btn');

    let isMuted = false;
    let lastVolume = 0.7;

    if (music) {
        music.volume = lastVolume;
        music.play().catch(() => {
            document.addEventListener('click', () => music.play(), { once: true });
        });
    }

    function updateSliderTrack(pct) {
        if (slider) {
            slider.style.setProperty('--vol-pct', pct + '%');
        }
    }

    function updateSpeakerIcon(vol) {
        const waves = document.getElementById('speaker-waves');
        if (!waves) return;

        if (vol === 0) {
            waves.style.opacity = '0.2';
        } else if (vol < 40) {
            waves.setAttribute('d', 'M15.54 8.46a5 5 0 0 1 0 7.07');
            waves.style.opacity = '1';
        } else {
            waves.setAttribute('d', 'M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14');
            waves.style.opacity = '1';
        }
    }

    if (slider) {
        slider.addEventListener('input', () => {
            const val = parseInt(slider.value, 10);
            lastVolume = val / 100;
            
            if (music) {
                music.volume = lastVolume;
                music.muted = false;
            }
            
            isMuted = false;
            
            if (muteBtn) {
                muteBtn.textContent = 'Némítás';
                muteBtn.classList.remove('muted');
            }
            if (display) {
                display.textContent = val + '%';
            }
            
            updateSliderTrack(val);
            updateSpeakerIcon(val);
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            
            if (music) {
                music.muted = isMuted;
            }
            
            if (isMuted) {
                muteBtn.textContent = 'Hangosítás';
                muteBtn.classList.add('muted');
                updateSpeakerIcon(0);
            } else {
                muteBtn.textContent = 'Némítás';
                muteBtn.classList.remove('muted');
                const currentVal = slider ? parseInt(slider.value, 10) : 70;
                updateSpeakerIcon(currentVal);
            }
        });
    }

    if (slider) {
        const initialVal = parseInt(slider.value, 10) || 70;
        updateSliderTrack(initialVal);
        updateSpeakerIcon(initialVal);
    }
})();