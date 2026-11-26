const searchInput = document.querySelector('#gameSearch');
const cards = [...document.querySelectorAll('.game-card')];
const categoryButtons = [...document.querySelectorAll('.category')];
const emptyState = document.querySelector('#emptyState');
let activeCategory = 'all';

function filterGames() {
  const term = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach((card) => {
    const name = (card.dataset.name || '').toLowerCase();
    const category = card.dataset.category || 'all';
    const matchesSearch = name.includes(term);
    const matchesCategory = activeCategory === 'all' || category === activeCategory;
    const visible = matchesSearch && matchesCategory;
    card.hidden = !visible;
    if (visible) visibleCount++;
  });

  emptyState.hidden = visibleCount !== 0;
}

searchInput.addEventListener('input', filterGames);
categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    categoryButtons.forEach((item) => item.classList.toggle('active', item === button));
    filterGames();
  });
});

const menuButton = document.querySelector('#menuButton');
const navigation = document.querySelector('.topbar nav');
menuButton.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});
navigation.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

document.querySelector('#year').textContent = new Date().getFullYear();
filterGames();
