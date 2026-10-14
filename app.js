'use strict';

const page = document.body.dataset.page;
const navLinks = [['home', 'index.html', 'Главная'], ['about', 'about.html', 'О нас'], ['contact', 'contact.html', 'Контакты']];
document.getElementById('site-header').innerHTML = `
  <div class="nav-shell">
    <a class="brand" href="index.html" aria-label="TravelBloom — главная"><img src="favicon.svg" width="34" height="34" alt=""><span>Travel<span class="brand-light">Bloom</span><span class="brand-dot">.</span></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Открыть меню">☰</button>
    <nav id="main-nav" aria-label="Основная навигация">${navLinks.map(([key, url, label]) => `<a href="${url}"${key === page ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <form class="search-form" id="search-form" role="search"><label class="sr-only" for="search-input">Поиск направлений</label><span class="search-icon" aria-hidden="true">⌕</span><input id="search-input" name="q" type="search" placeholder="Пляжи, храмы, страны…" maxlength="100" autocomplete="off"><button class="search-submit" type="submit">Поиск</button><button class="search-clear" type="button" id="clear-button">Сбросить</button></form>
  </div>`;
document.getElementById('site-footer').innerHTML = `<p><strong>TravelBloom.</strong> Начните с любопытства.</p><div><a href="about.html">О проекте</a><a href="contact.html">Связаться</a><span>Учебный проект · 2026</span></div>`;

const menu = document.querySelector('.menu-toggle');
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(expanded));
  menu.setAttribute('aria-label', expanded ? 'Закрыть меню' : 'Открыть меню');
  document.getElementById('main-nav').classList.toggle('open', expanded);
});

const searchInput = document.getElementById('search-input');
const normalize = text => text.toLocaleLowerCase().trim().replace(/[.,!?]/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
const categories = {
  beaches: {label: 'Пляжи', aliases: ['beach', 'beaches', 'пляж', 'пляжи', 'пляжей', 'океан', 'море']},
  temples: {label: 'Храмы', aliases: ['temple', 'temples', 'храм', 'храмы', 'храмов']},
  countries: {label: 'Страны', aliases: ['country', 'countries', 'страна', 'страны', 'стран', 'города', 'город']}
};
let dataPromise;
function getData() {
  if (!dataPromise) dataPromise = fetch('travel_recommendation_api.json').then(response => {
    if (!response.ok) throw new Error('Не удалось загрузить направления.');
    return response.json();
  }).catch(error => { dataPromise = undefined; throw error; });
  return dataPromise;
}

let searchSequence = 0;
let currentResults = [];
function clearSearch() {
  searchSequence++;
  searchInput.value = '';
  if (page === 'home') {
    document.getElementById('results').hidden = true;
    document.getElementById('featured-place').hidden = false;
    document.getElementById('result-cards').replaceChildren();
    document.getElementById('result-status').textContent = '';
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }
  searchInput.focus();
}
document.getElementById('clear-button').addEventListener('click', clearSearch);
document.getElementById('search-form').addEventListener('submit', event => {
  event.preventDefault();
  if (page !== 'home') {
    window.location.href = 'index.html?q=' + encodeURIComponent(searchInput.value.trim());
    return;
  }
  runSearch(searchInput.value);
});

function makeCard(place) {
  const article = document.createElement('article');
  article.className = 'result-card';
  const image = document.createElement('img');
  image.src = place.imageUrl;
  image.alt = place.alt;
  image.width = 440;
  image.height = 160;
  const content = document.createElement('div');
  content.className = 'card-content';
  const location = document.createElement('p');
  location.className = 'card-location';
  location.textContent = place.location;
  const heading = document.createElement('h3');
  heading.textContent = place.name;
  const description = document.createElement('p');
  description.textContent = place.description;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-link';
  button.textContent = 'Подробнее ↗';
  button.setAttribute('aria-label', 'Подробнее: ' + place.name);
  button.addEventListener('click', () => openPlace(place));
  content.append(location, heading, description, button);
  article.append(image, content);
  return article;
}

async function runSearch(rawQuery) {
  const sequence = ++searchSequence;
  const query = normalize(rawQuery);
  searchInput.value = rawQuery.trim();
  const results = document.getElementById('results');
  const status = document.getElementById('result-status');
  const cards = document.getElementById('result-cards');
  results.hidden = false;
  document.getElementById('featured-place').hidden = true;
  cards.replaceChildren();
  document.getElementById('results-heading').textContent = 'Рекомендации';
  if (!query) {
    status.textContent = 'Введите beach, temple, country или название места. Можно искать и по-русски: пляжи, храмы, страны.';
    searchInput.focus();
    return;
  }
  status.textContent = 'Ищем ваше следующее открытие…';
  try {
    const data = await getData();
    if (sequence !== searchSequence) return;
    const category = Object.keys(categories).find(key => categories[key].aliases.includes(query));
    const matchedCountry = data.countries.find(country => country.keywords.some(keyword => normalize(keyword) === query) || normalize(country.name) === query);
    const countryCities = data.countries.flatMap(country => country.cities.map(city => ({...city, countryKeywords: country.keywords, category: 'countries'})));
    const all = [...data.beaches.map(item => ({...item, category: 'beaches'})), ...data.temples.map(item => ({...item, category: 'temples'})), ...countryCities];
    currentResults = category ? all.filter(item => item.category === category) : matchedCountry ? matchedCountry.cities.map(city => ({...city, category: 'countries'})) : all.filter(item => {
      const searchable = [item.name, item.location, ...item.keywords, ...(item.countryKeywords || [])].map(normalize);
      return searchable.some(text => text.includes(query));
    });
    document.getElementById('results-heading').textContent = category ? categories[category].label : matchedCountry ? matchedCountry.name : 'Результаты поиска';
    status.textContent = currentResults.length ? `Найдено: ${currentResults.length} · «${rawQuery.trim()}»` : `По запросу «${rawQuery.trim()}» ничего не найдено. Попробуйте «пляжи», «храмы», «страны» или «Австралия».`;
    cards.replaceChildren(...currentResults.map(makeCard));
    const url = new URL(window.location.href);
    url.searchParams.set('q', rawQuery.trim());
    history.replaceState(null, '', url);
    if (window.matchMedia('(max-width: 800px)').matches) results.scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (error) {
    if (sequence === searchSequence) status.textContent = 'Не удалось загрузить рекомендации. Проверьте соединение и повторите поиск.';
  }
}

function openPlace(place) {
  const dialog = document.getElementById('place-dialog');
  document.getElementById('dialog-image').src = place.imageUrl;
  document.getElementById('dialog-image').alt = place.alt;
  document.getElementById('dialog-category').textContent = categories[place.category].label + ' / ' + place.location;
  document.getElementById('dialog-title').textContent = place.name;
  document.getElementById('dialog-description').textContent = place.description;
  document.getElementById('dialog-tip').textContent = place.tip;
  document.getElementById('dialog-map').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.mapQuery);
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.showModal();
}

if (page === 'home') {
  document.getElementById('close-results').addEventListener('click', clearSearch);
  document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
    runSearch(button.dataset.query);
    if (!window.matchMedia('(max-width: 800px)').matches) document.querySelector('.hero').scrollIntoView({behavior: 'smooth'});
  }));
  document.getElementById('explore-button').addEventListener('click', () => document.getElementById('discover').scrollIntoView({behavior: 'smooth', block: 'center'}));
  const dialog = document.getElementById('place-dialog');
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  const query = new URLSearchParams(window.location.search).get('q');
  if (query !== null) runSearch(query);
}

if (page === 'contact') {
  const form = document.getElementById('contact-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const nameInput = document.getElementById('name');
    const messageInput = document.getElementById('message');
    nameInput.setCustomValidity(nameInput.value.trim() ? '' : 'Введите имя.');
    messageInput.setCustomValidity(messageInput.value.trim().length >= 10 ? '' : 'Введите сообщение длиной не менее 10 символов.');
    if (!form.reportValidity()) return;
    document.getElementById('preview-sender').textContent = nameInput.value.trim() + ' · ' + document.getElementById('email').value.trim();
    document.getElementById('preview-body').textContent = messageInput.value.trim();
    document.getElementById('message-preview').hidden = false;
    document.getElementById('form-status').textContent = 'Сообщение подготовлено. Это демонстрация: письмо не отправлено.';
  });
  ['name', 'message'].forEach(id => document.getElementById(id).addEventListener('input', event => event.target.setCustomValidity('')));
  document.getElementById('edit-message').addEventListener('click', () => { document.getElementById('message-preview').hidden = true; document.getElementById('form-status').textContent = ''; document.getElementById('message').focus(); });
}
