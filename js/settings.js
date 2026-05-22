(function () {
    const btn = document.getElementById('settings-btn');
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');

    if (!btn || !panel || !overlay) return;

    function openPanel() {
        panel.classList.add('open');
        overlay.classList.add('visible');
        btn.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
    }

    function closePanel() {
        panel.classList.remove('open');
        overlay.classList.remove('visible');
        btn.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', () =>
        panel.classList.contains('open') ? closePanel() : openPanel()
    );

    overlay.addEventListener('click', closePanel);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });
})();