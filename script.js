
(function(){
  const API_URL = "https://demohotelsapi.pythonanywhere.com/hotels/";
  const PAGE_SIZE = 24;

  let allHotels = [];
  let filtered = [];
  let visibleCount = PAGE_SIZE;

  const grid = document.getElementById('hotelGrid');
  const resultsCount = document.getElementById('resultsCount');
  const statPill = document.getElementById('statPill');
  const locationFilter = document.getElementById('locationFilter');
  const priceMin = document.getElementById('priceMin');
  const priceMax = document.getElementById('priceMax');
  const sortSelect = document.getElementById('sortSelect');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const activeFiltersEl = document.getElementById('activeFilters');
  const quickTags = document.getElementById('quickTags');

  // ---------- FETCH ----------
  // The API doesn't send CORS headers, so a direct browser fetch can be blocked.
  // We try direct first, then fall back to a public CORS proxy.
  async function fetchWithFallback(){
    try{
      const res = await fetch(API_URL);
      if(!res.ok) throw new Error('status ' + res.status);
      return await res.json();
    }catch(directErr){
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(API_URL);
      const res = await fetch(proxyUrl);
      if(!res.ok) throw new Error('Both direct and proxy fetch failed (' + res.status + ')');
      return await res.json();
    }
  }

  async function loadHotels(){
    try{
      const data = await fetchWithFallback();
      allHotels = (data.data || []).map(h => ({
        ...h,
        priceNum: parseFloat(h.price)
      }));
      populateLocations();
      populateQuickTags();
      statPill.textContent = allHotels.length + ' hotels live';
      applyFilters();
    }catch(err){
      grid.innerHTML = `<div class="error-state">
        <h3>Couldn't load hotels</h3>
        <p>${err.message}. This is usually a CORS restriction from the API — try opening this file via a local server (e.g. VS Code "Live Server") instead of double-clicking it, or host it on Netlify/GitHub Pages.</p>
      </div>`;
      statPill.textContent = 'API unavailable';
    }
  }

  function populateLocations(){
    const cities = [...new Set(allHotels.map(h => h.location))].sort();
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      locationFilter.appendChild(opt);
    });
  }

  function populateQuickTags(){
    const cities = [...new Set(allHotels.map(h => h.location))].sort().slice(0,6);
    quickTags.innerHTML = '';
    cities.forEach(city => {
      const btn = document.createElement('button');
      btn.textContent = city;
      btn.addEventListener('click', () => {
        searchInput.value = city;
        applyFilters();
      });
      quickTags.appendChild(btn);
    });
  }

  // ---------- FILTER + SORT ----------
  function applyFilters(){
    const q = searchInput.value.trim().toLowerCase();
    const loc = locationFilter.value;
    const min = parseFloat(priceMin.value);
    const max = parseFloat(priceMax.value);
    const ratingVal = parseFloat(document.querySelector('input[name="rating"]:checked').value);

    filtered = allHotels.filter(h => {
      if(q){
        const matchesText = h.name.toLowerCase().includes(q) ||
                             h.location.toLowerCase().includes(q) ||
                             String(h.id) === q;
        if(!matchesText) return false;
      }
      if(loc && h.location !== loc) return false;
      if(!isNaN(min) && h.priceNum < min) return false;
      if(!isNaN(max) && h.priceNum > max) return false;
      if(ratingVal && h.rating < ratingVal) return false;
      return true;
    });

    sortHotels();
    visibleCount = PAGE_SIZE;
    renderActiveFilters(q, loc, min, max, ratingVal);
    render();
  }

  function sortHotels(){
    const mode = sortSelect.value;
    const sorters = {
      'price-asc': (a,b) => a.priceNum - b.priceNum,
      'price-desc': (a,b) => b.priceNum - a.priceNum,
      'rating-desc': (a,b) => b.rating - a.rating,
      'rating-asc': (a,b) => a.rating - b.rating,
      'name-asc': (a,b) => a.name.localeCompare(b.name),
      'name-desc': (a,b) => b.name.localeCompare(a.name),
    };
    if(sorters[mode]) filtered.sort(sorters[mode]);
  }

  function renderActiveFilters(q, loc, min, max, ratingVal){
    const chips = [];
    if(q) chips.push(['Search: "' + q + '"', () => { searchInput.value=''; applyFilters(); }]);
    if(loc) chips.push(['City: ' + loc, () => { locationFilter.value=''; applyFilters(); }]);
    if(!isNaN(min)) chips.push(['Min ₹' + min, () => { priceMin.value=''; applyFilters(); }]);
    if(!isNaN(max)) chips.push(['Max ₹' + max, () => { priceMax.value=''; applyFilters(); }]);
    if(ratingVal) chips.push([ratingVal + '★ & up', () => { document.querySelector('input[name="rating"][value="0"]').checked = true; applyFilters(); }]);

    activeFiltersEl.innerHTML = '';
    chips.forEach(([label, onRemove]) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<span>${label}</span>`;
      const btn = document.createElement('button');
      btn.textContent = '✕';
      btn.addEventListener('click', onRemove);
      chip.appendChild(btn);
      activeFiltersEl.appendChild(chip);
    });
  }

  // ---------- RENDER ----------
  function render(){
    resultsCount.innerHTML = `<strong>${filtered.length}</strong> hotels found`;

    if(filtered.length === 0){
      grid.innerHTML = `<div class="empty-state">
        <h3>No hotels match your search</h3>
        <p>Try widening your price range, clearing a filter, or searching a different city.</p>
      </div>`;
      return;
    }

    const toShow = filtered.slice(0, visibleCount);
    grid.innerHTML = '';
    toShow.forEach(h => grid.appendChild(buildCard(h)));

    if(visibleCount < filtered.length){
      const wrap = document.createElement('div');
      wrap.className = 'load-more-wrap';
      const btn = document.createElement('button');
      btn.className = 'load-more';
      btn.textContent = `Load more (${filtered.length - visibleCount} remaining)`;
      btn.addEventListener('click', () => { visibleCount += PAGE_SIZE; render(); });
      wrap.appendChild(btn);
      grid.appendChild(wrap);
    }
  }

  function buildCard(h){
    const card = document.createElement('div');
    card.className = 'hotel-card';
    card.innerHTML = `
      <div class="card-img">
        <span class="card-badge">#${h.id}</span>
        <span class="card-rating">★ ${h.rating.toFixed(1)}</span>
        <img src="${h.thumbnail}" alt="${h.name}" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-title">${h.name}</div>
        <div class="card-location">📍 ${h.location}</div>
        <div class="card-desc">${h.description}</div>
        <div class="card-footer">
          <div class="card-price">₹${Math.round(h.priceNum).toLocaleString('en-IN')} <span>/ night</span></div>
          <div class="card-id">ID ${h.id}</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => openModal(h));
    return card;
  }

  // ---------- MODAL ----------
  const modalOverlay = document.getElementById('modalOverlay');
  function openModal(h){
    document.getElementById('modalImg').src = h.thumbnail;
    document.getElementById('modalTitle').textContent = h.name;
    document.getElementById('modalRating').textContent = '★ ' + h.rating.toFixed(1);
    document.getElementById('modalLoc').textContent = '📍 ' + h.location + ' · Hotel ID ' + h.id;
    document.getElementById('modalDesc').textContent = h.description;
    document.getElementById('modalPrice').innerHTML = '₹' + Math.round(h.priceNum).toLocaleString('en-IN') + ' <span>/ night</span>';

    const gallery = document.getElementById('modalGallery');
    gallery.innerHTML = '';
    (h.photos || []).slice(0,8).forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.addEventListener('click', () => { document.getElementById('modalImg').src = src; });
      gallery.appendChild(img);
    });

    modalOverlay.classList.add('open');
  }
  document.getElementById('modalClose').addEventListener('click', () => modalOverlay.classList.remove('open'));
  modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) modalOverlay.classList.remove('open'); });

  // ---------- EVENTS ----------
  searchBtn.addEventListener('click', applyFilters);
  searchInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') applyFilters(); });
  locationFilter.addEventListener('change', applyFilters);
  priceMin.addEventListener('change', applyFilters);
  priceMax.addEventListener('change', applyFilters);
  sortSelect.addEventListener('change', applyFilters);
  document.querySelectorAll('input[name="rating"]').forEach(r => r.addEventListener('change', applyFilters));

  document.getElementById('resetFilters').addEventListener('click', () => {
    searchInput.value = '';
    locationFilter.value = '';
    priceMin.value = '';
    priceMax.value = '';
    document.querySelector('input[name="rating"][value="0"]').checked = true;
    sortSelect.value = 'relevance';
    applyFilters();
  });

  document.getElementById('feedbackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('feedbackNote').textContent = 'Thanks — your feedback has been noted!';
    e.target.reset();
  });

  loadHotels();
})();