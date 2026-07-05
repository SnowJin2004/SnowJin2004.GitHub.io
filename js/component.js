document.addEventListener('click', (event) => {
    const btn = event.target.closest('.accordion-btn');
    if (!btn) return;

    const panel = btn.nextElementSibling;
    btn.classList.toggle('open');

    if (panel.style.maxHeight && panel.style.maxHeight !== "0px") {
        panel.style.maxHeight = "0px";
    } else {
        panel.style.maxHeight = panel.scrollHeight + "px";
    }
});