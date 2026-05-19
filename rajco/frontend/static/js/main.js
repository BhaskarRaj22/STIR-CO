/* =========================================
   RAJ & CO — MAIN JAVASCRIPT
   ========================================= */

// ─── STATE ───
let currentUser = null;
let currentCategory = null;
let allVendors = [];
let allProducts = [];
let currentVendorId = null;
let previousPage = 'home';
let localizeRadius = 5;
let localizeCategory = 'all';
let currentDealId = null;
let chatPollInterval = null;

// ─── CATEGORY CONFIG ───
const CAT_CONFIG = {
  hardware: {
    title: 'Hardware',
    desc: 'Locks, curtain bars, door handles, knobs, hinges and all hardware products',
    icon: 'fa-screwdriver-wrench',
    subcategories: ['All', 'Locks & Security', 'Curtain Rods & Fixtures', 'Door & Window Hardware', 'Smart Locks', 'Knobs & Handles'],
    color: '#8B4513'
  },
  tiles: {
    title: 'Tiles & Marble',
    desc: 'Granite, vitrified tiles, Italian marble, designer wall tiles and flooring solutions',
    icon: 'fa-th',
    subcategories: ['All', 'Marble Flooring', 'Ceramic Tiles', 'Granite & Stone', 'Designer Tiles', 'Vitrified Tiles'],
    color: '#2E4A7A'
  },
  painter: {
    title: 'Painters',
    desc: 'Interior, exterior, texture painting, waterproofing and artistic wall designs',
    icon: 'fa-paint-roller',
    subcategories: ['All', 'Interior Painting', 'Exterior Painting', 'Texture & Wall Art', 'Waterproofing', '3D Wall Design'],
    color: '#2E5C35'
  },
  decor: {
    title: 'Home Decor',
    desc: 'Curtains, carpets, bedsheets, blinds and personalized home decor design',
    icon: 'fa-couch',
    subcategories: ['All', 'Curtains & Drapes', 'Carpets & Rugs', 'Bedsheets & Linen', 'Blinds', 'Custom Decor'],
    color: '#6B2E5F'
  }
};

// ─── PRODUCT IMAGES (Unsplash direct) ───
const PRODUCT_IMAGES = {
  hardware: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80',
  tiles: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&q=80',
  painter: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&q=80',
  decor: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=300&q=80'
};

const VENDOR_IMAGES = {
  hardware: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=100&q=80',
  tiles: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=100&q=80',
  painter: 'https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=100&q=80',
  decor: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=100&q=80'
};

// ─── PAGE ROUTING ───
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  if (page === 'home') loadBestsellers();
  if (page === 'deals') { loadDeals(); stopChatPoll(); }
  if (page === 'dashboard') loadDashboard();
  if (page === 'login' && currentUser) { showPage('home'); return; }
  previousPage = page;
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadBestsellers();
  setupNavbarScroll();
});

function setupNavbarScroll() {
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 50) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });
}

// ─── AUTH CHECK ───
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.logged_in) {
      currentUser = data.user;
      updateAuthUI();
    }
  } catch (e) { console.log('Auth check failed'); }
}

function updateAuthUI() {
  const authBtns = document.getElementById('authBtns');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');
  if (currentUser) {
    authBtns.style.display = 'none';
    userMenu.style.display = 'flex';
    userName.textContent = currentUser.name.split(' ')[0];
  } else {
    authBtns.style.display = 'flex';
    userMenu.style.display = 'none';
  }
}

function toggleUserDropdown() {
  document.getElementById('userDropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.btn-user')) {
    document.getElementById('userDropdown')?.classList.remove('open');
  }
});

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  updateAuthUI();
  showPage('home');
  showToast('Logged out successfully', 'info');
}

// ─── SEARCH ───
function toggleSearch() {
  const bar = document.getElementById('searchBar');
  bar.classList.toggle('open');
  if (bar.classList.contains('open')) document.getElementById('searchInput').focus();
}

let searchTimeout = null;
async function handleSearch(val) {
  clearTimeout(searchTimeout);
  const results = document.getElementById('searchResults');
  if (val.length < 2) { results.innerHTML = ''; return; }
  searchTimeout = setTimeout(async () => {
    try {
      const [vRes, pRes] = await Promise.all([
        fetch(`/api/vendors?city=${encodeURIComponent(val)}`),
        fetch(`/api/products`)
      ]);
      const vData = await vRes.json();
      const pData = await pRes.json();

      const vendors = vData.vendors.filter(v =>
        v.business_name.toLowerCase().includes(val.toLowerCase()) ||
        v.city.toLowerCase().includes(val.toLowerCase()) ||
        v.category.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 4);

      const products = pData.products.filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 3);

      let html = '';
      if (vendors.length) {
        html += vendors.map(v => `
          <div class="search-result-item" onclick="openVendorFromSearch(${v.id}, '${v.category}')">
            <i class="fa fa-store" style="color:var(--gold)"></i>
            <div>
              <strong style="color:var(--white);display:block;font-size:13px">${v.business_name}</strong>
              <small>${v.category} · ${v.city}</small>
            </div>
          </div>`).join('');
      }
      if (products.length) {
        html += products.map(p => `
          <div class="search-result-item" onclick="showCategory('${p.category}')">
            <i class="fa fa-box" style="color:var(--gold)"></i>
            <div>
              <strong style="color:var(--white);display:block;font-size:13px">${p.name}</strong>
              <small>₹${p.price_min}–₹${p.price_max} / ${p.unit}</small>
            </div>
          </div>`).join('');
      }
      if (!html) html = '<div class="search-result-item">No results found</div>';
      results.innerHTML = html;
    } catch (e) {}
  }, 300);
}

function openVendorFromSearch(vid, cat) {
  document.getElementById('searchBar').classList.remove('open');
  document.getElementById('searchResults').innerHTML = '';
  currentCategory = cat;
  openVendorDetail(vid);
}

// ─── MOBILE MENU ───
function toggleMobileMenu() {
  document.getElementById('navLinks').classList.toggle('mobile-open');
}

// ─── HERO ACTIONS ───
function scrollToCategories() {
  document.getElementById('categoriesSection')?.scrollIntoView({ behavior: 'smooth' });
}

// ─── BESTSELLERS ───
async function loadBestsellers() {
  try {
    const res = await fetch('/api/products?bestseller=true');
    const data = await res.json();
    const grid = document.getElementById('bestsellerGrid');
    if (!grid) return;
    grid.innerHTML = data.products.slice(0, 8).map(p => `
      <div class="bestseller-card" onclick="showCategory('${p.category}')">
        <div class="bc-img">
          <img src="${PRODUCT_IMAGES[p.category]}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x180/e8e0d0/9a7a32?text=${encodeURIComponent(p.name)}'">
          <span class="bestseller-tag">🔥 Best Seller</span>
        </div>
        <div class="bc-body">
          <h4>${p.name}</h4>
          <div class="bc-sub">${p.subcategory} · ${capitalizeFirst(p.category)}</div>
          <div class="bc-price">₹${p.price_min} <span>– ₹${p.price_max} / ${p.unit}</span></div>
        </div>
      </div>`).join('');
  } catch (e) { console.error('Bestsellers load failed', e); }
}

// ─── CATEGORY PAGE ───
async function showCategory(cat) {
  currentCategory = cat;
  const cfg = CAT_CONFIG[cat];
  document.getElementById('catHeroIcon').innerHTML = `<i class="fa ${cfg.icon}"></i>`;
  document.getElementById('catHeroTitle').textContent = cfg.title;
  document.getElementById('catHeroDesc').textContent = cfg.desc;

  // Tabs
  document.getElementById('catTabs').innerHTML = ['Vendors', 'Products', 'Best Sellers', 'Catalog'].map((t, i) =>
    `<button class="cat-tab ${i===0?'active':''}" onclick="switchCatTab('${t}', this)">${t}</button>`
  ).join('');

  // Subcategory pills
  document.getElementById('subcatPills').innerHTML = cfg.subcategories.map((s, i) =>
    `<button class="subcat-pill ${i===0?'active':''}" onclick="filterBySubcat('${s}', this)">${s}</button>`
  ).join('');

  showPage('category');
  await loadCategoryVendors(cat);
  await loadCategoryProducts(cat, null);
}

async function loadCategoryVendors(cat, subcat = null) {
  const list = document.getElementById('vendorsList');
  list.innerHTML = '<div style="padding:20px;text-align:center;color:#888"><i class="fa fa-spinner fa-spin" style="color:var(--gold);font-size:24px"></i><p style="margin-top:10px">Loading vendors...</p></div>';
  try {
    let url = `/api/vendors?category=${cat}`;
    if (subcat && subcat !== 'All') url += `&subcategory=${encodeURIComponent(subcat)}`;
    const res = await fetch(url);
    const data = await res.json();
    allVendors = data.vendors;
    document.getElementById('vendorCount').textContent = `${allVendors.length} vendor${allVendors.length !== 1 ? 's' : ''} found`;
    renderVendors(allVendors);
  } catch (e) { list.innerHTML = '<div style="padding:20px;text-align:center;color:#888">Failed to load vendors</div>'; }
}

function renderVendors(vendors) {
  const list = document.getElementById('vendorsList');
  if (!vendors.length) {
    list.innerHTML = '<div style="padding:30px;text-align:center;color:#888"><i class="fa fa-store-slash" style="font-size:32px;color:#ddd;display:block;margin-bottom:10px"></i>No vendors found in this category</div>';
    return;
  }
  list.innerHTML = vendors.map(v => `
    <div class="vendor-card" onclick="openVendorDetail(${v.id})" id="vc-${v.id}">
      <div class="vc-top">
        <div class="vc-avatar">
          <img src="${VENDOR_IMAGES[v.category] || ''}" alt="${v.business_name}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\'fa fa-store\'></i>'">
        </div>
        <div class="vc-info" style="flex:1">
          <h4>${v.business_name}</h4>
          <div class="vc-sub">${v.subcategory}</div>
          <div class="vc-rating">
            <span class="stars-small">${renderStars(v.rating)}</span>
            <span>${v.rating} (${v.reviews_count} reviews)</span>
            ${v.is_verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
          </div>
        </div>
      </div>
      <div class="vc-meta">
        <span><i class="fa fa-location-dot"></i>${v.city}, ${v.state}</span>
        <span><i class="fa fa-briefcase"></i>${v.experience_years}+ yrs exp</span>
        ${v.distance_km !== undefined ? `<span class="distance-badge"><i class="fa fa-location-crosshairs"></i>${v.distance_km} km away</span>` : ''}
      </div>
      <div class="vc-actions">
        <button class="vc-btn vc-btn-secondary" onclick="event.stopPropagation();openDealModal(${v.id}, null)"><i class="fa fa-handshake"></i> Deal</button>
        <button class="vc-btn vc-btn-primary" onclick="event.stopPropagation();openVendorDetail(${v.id})">View Profile</button>
      </div>
    </div>`).join('');
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(empty);
}

async function loadCategoryProducts(cat, subcat, viewType = 'all') {
  try {
    let url = `/api/products?category=${cat}`;
    if (subcat && subcat !== 'All') url += `&subcategory=${encodeURIComponent(subcat)}`;
    if (viewType === 'bestseller') url += '&bestseller=true';
    const res = await fetch(url);
    const data = await res.json();
    allProducts = data.products;
    renderProductsSm(allProducts);
  } catch (e) {}
}

function renderProductsSm(products) {
  const grid = document.getElementById('productsList');
  if (!grid) return;
  if (!products.length) {
    grid.innerHTML = '<div style="padding:30px;text-align:center;color:#888;grid-column:span 2">No products found</div>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <div class="product-card-sm">
      <div class="pc-img">
        <img src="${PRODUCT_IMAGES[p.category]}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x120/e8e0d0/9a7a32?text=${encodeURIComponent(p.name)}'">
        ${p.is_bestseller ? '<span class="pc-bestseller-tag">🔥 Best Seller</span>' : ''}
      </div>
      <div class="pc-body">
        <h5>${p.name}</h5>
        <div class="pc-sub">${p.subcategory}</div>
        <div class="pc-price">₹${p.price_min} <small>– ₹${p.price_max} / ${p.unit}</small></div>
        <button class="pc-deal-btn" onclick="openDealModal(${p.vendor_id}, ${p.id})">
          <i class="fa fa-handshake"></i> Get Quote
        </button>
      </div>
    </div>`).join('');
}

function filterBySubcat(subcat, btn) {
  document.querySelectorAll('.subcat-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  loadCategoryVendors(currentCategory, subcat === 'All' ? null : subcat);
  loadCategoryProducts(currentCategory, subcat === 'All' ? null : subcat);
}

function toggleProductView(type, btn) {
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadCategoryProducts(currentCategory, null, type);
}

function switchCatTab(tab, btn) {
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'Best Sellers') toggleProductView('bestseller', document.querySelectorAll('.toggle-btn')[1]);
  else if (tab === 'Catalog') toggleProductView('catalog', document.querySelectorAll('.toggle-btn')[2]);
  else toggleProductView('all', document.querySelectorAll('.toggle-btn')[0]);
}

function filterVendors(sortBy) {
  let sorted = [...allVendors];
  if (sortBy === 'rating') sorted.sort((a, b) => b.rating - a.rating);
  else if (sortBy === 'distance') sorted.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
  else if (sortBy === 'experience') sorted.sort((a, b) => b.experience_years - a.experience_years);
  renderVendors(sorted);
}

// ─── VENDOR DETAIL ───
async function openVendorDetail(vid) {
  showLoading(true);
  currentVendorId = vid;
  try {
    const res = await fetch(`/api/vendors/${vid}`);
    const data = await res.json();
    const v = data.vendor;
    const products = data.products;
    renderVendorDetail(v, products);
    showPage('vendor');
  } catch (e) {
    showToast('Failed to load vendor details', 'error');
  }
  showLoading(false);
}

function renderVendorDetail(v, products) {
  const el = document.getElementById('vendorDetail');
  const icon = CAT_CONFIG[v.category]?.icon || 'fa-store';
  const tagArr = v.tags ? v.tags.split(',') : [];

  el.innerHTML = `
    <div class="vd-header">
      <div class="vd-avatar"><i class="fa ${icon}"></i></div>
      <div class="vd-info" style="flex:1">
        <h2>${v.business_name}</h2>
        <div class="vd-cat"><i class="fa ${icon}"></i> ${capitalizeFirst(v.category)} · ${v.subcategory}</div>
        <div class="vd-meta-row">
          <div class="vd-meta-item"><i class="fa fa-location-dot"></i> ${v.city}, ${v.state} - ${v.pin_code}</div>
          <div class="vd-meta-item"><i class="fa fa-briefcase"></i> ${v.experience_years}+ years experience</div>
          <div class="vd-meta-item"><i class="fa fa-star" style="color:var(--gold)"></i> ${v.rating} (${v.reviews_count} reviews)</div>
          ${v.is_verified ? '<div class="vd-meta-item"><i class="fa fa-check-circle" style="color:var(--green)"></i> Verified Vendor</div>' : ''}
        </div>
        <div class="vd-tags">${tagArr.map(t => `<span>${t.trim()}</span>`).join('')}</div>
      </div>
      <div class="vd-actions">
        <a href="tel:+91${v.phone}" class="btn-primary" style="text-decoration:none"><i class="fa fa-phone"></i> Call Now</a>
        <button class="btn-secondary" onclick="openDealModal(${v.id}, null)" style="background:rgba(201,168,76,0.15);color:var(--gold);border-color:rgba(201,168,76,0.3)"><i class="fa fa-handshake"></i> Start Deal</button>
      </div>
    </div>

    <div class="vd-grid">
      <div>
        <div class="vd-products">
          <div class="vd-products-header">
            <h3>Products & Pricing</h3>
            <span style="font-size:13px;color:#888">${products.length} products</span>
          </div>
          <div class="vd-products-grid">
            ${products.map(p => `
              <div class="product-card-sm" style="cursor:default">
                <div class="pc-img">
                  <img src="${PRODUCT_IMAGES[p.category]}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/200x120/e8e0d0/9a7a32?text=${encodeURIComponent(p.name)}'">
                  ${p.is_bestseller ? '<span class="pc-bestseller-tag">🔥 Best Seller</span>' : ''}
                </div>
                <div class="pc-body">
                  <h5>${p.name}</h5>
                  <div class="pc-sub">${p.subcategory}</div>
                  <div class="pc-price">₹${p.price_min} <small>– ₹${p.price_max} / ${p.unit}</small></div>
                  <button class="pc-deal-btn" onclick="openDealModal(${p.vendor_id}, ${p.id})"><i class="fa fa-handshake"></i> Get Quote</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="vd-products" style="margin-top:20px;padding:24px">
          <h3 style="font-family:var(--font-display);font-size:20px;color:var(--dark);margin-bottom:12px">About ${v.business_name}</h3>
          <p style="font-size:15px;color:#555;line-height:1.7">${v.description}</p>
        </div>
      </div>

      <div class="vd-sidebar">
        <div>
          <h4>Contact Details</h4>
          <div class="contact-item">
            <div class="contact-icon"><i class="fa fa-phone"></i></div>
            <div class="ci-text"><strong>+91 ${v.phone}</strong><span>Call for inquiry</span></div>
          </div>
          ${v.email ? `<div class="contact-item"><div class="contact-icon"><i class="fa fa-envelope"></i></div><div class="ci-text"><strong>${v.email}</strong><span>Email</span></div></div>` : ''}
          <div class="contact-item">
            <div class="contact-icon"><i class="fa fa-location-dot"></i></div>
            <div class="ci-text"><strong>${v.city}, ${v.state}</strong><span>PIN: ${v.pin_code}</span></div>
          </div>
          <button class="btn-primary w-full" style="margin-top:12px" onclick="openDealModal(${v.id}, null)">
            <i class="fa fa-handshake"></i> Start a Deal
          </button>
        </div>
        <div>
          <h4>Rating & Reviews</h4>
          <div class="rating-display">
            <div class="rating-big">${v.rating}</div>
            <div class="rating-stars">${renderStars(v.rating)}</div>
            <div class="rating-count">${v.reviews_count} customer reviews</div>
          </div>
        </div>
        <div>
          <h4>Business Info</h4>
          <div style="font-size:13px;color:#555;line-height:2">
            <div><span style="color:#888">Experience:</span> <strong>${v.experience_years}+ Years</strong></div>
            <div><span style="color:#888">Category:</span> <strong>${v.subcategory}</strong></div>
            <div><span style="color:#888">Location:</span> <strong>${v.city}, ${v.state}</strong></div>
            <div><span style="color:#888">Status:</span> <strong style="color:var(--green)">${v.is_verified ? '✓ Verified' : 'Unverified'}</strong></div>
          </div>
        </div>
      </div>
    </div>`;
}

function goBackFromVendor() {
  if (currentCategory) showPage('category');
  else showPage('home');
}

// ─── LOCALIZEWISE ───
function activateLocalize() {
  showPage('localize');
}

function updateRadius(val) {
  localizeRadius = parseInt(val);
  document.getElementById('radiusLabel').textContent = val + ' KM';
}

function localizeFilter(cat, btn) {
  localizeCategory = cat;
  document.querySelectorAll('.lc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function searchByCity() {
  const city = document.getElementById('localizeCity').value.trim();
  if (!city) { showToast('Please enter a city name', 'error'); return; }

  showLoading(true);
  try {
    const cat = localizeCategory === 'all' ? '' : localizeCategory;
    const res = await fetch(`/api/vendors?city=${encodeURIComponent(city)}${cat ? '&category=' + cat : ''}`);
    const data = await res.json();
    renderLocalizeResults(data.vendors, `Vendors in ${city}`);
  } catch (e) { showToast('Search failed', 'error'); }
  showLoading(false);
}

async function getGPSLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported by your browser', 'error'); return;
  }
  showToast('Getting your location...', 'info');
  showLoading(true);
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    document.getElementById('localizeCity').value = `${lat.toFixed(4)}, ${lng.toFixed(4)} (GPS)`;
    try {
      const res = await fetch('/api/vendors/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radius: localizeRadius, category: localizeCategory === 'all' ? null : localizeCategory })
      });
      const data = await res.json();
      renderLocalizeResults(data.vendors, `Vendors within ${localizeRadius}KM of your location`);
    } catch (e) { showToast('Search failed', 'error'); }
    showLoading(false);
  }, err => {
    showLoading(false);
    showToast('Location access denied. Please enter city manually.', 'error');
  });
}

function renderLocalizeResults(vendors, title) {
  const container = document.getElementById('localizeResults');
  const count = vendors.length;

  if (!count) {
    container.innerHTML = `
      <div class="localize-empty">
        <i class="fa fa-map-location-dot"></i>
        <h3>No vendors found</h3>
        <p>Try increasing the search radius or searching a nearby city</p>
        <button class="btn-primary" style="margin-top:20px" onclick="document.getElementById('radiusSlider').value=25;updateRadius(25);searchByCity()">
          <i class="fa fa-expand"></i> Expand to 25KM
        </button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="localize-results-header">
      <h3>${title}</h3>
      <span>${count} vendor${count !== 1 ? 's' : ''} found</span>
    </div>
    <div class="localize-vendors-grid">
      ${vendors.map(v => `
        <div class="vendor-card" onclick="openLocalizeVendor(${v.id}, '${v.category}')">
          <div class="vc-top">
            <div class="vc-avatar">
              <img src="${VENDOR_IMAGES[v.category]}" alt="${v.business_name}" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\'fa fa-store\'></i>'">
            </div>
            <div class="vc-info" style="flex:1">
              <h4>${v.business_name}</h4>
              <div class="vc-sub">${v.subcategory}</div>
              <div class="vc-rating">
                <span class="stars-small">${renderStars(v.rating)}</span>
                <span>${v.rating} (${v.reviews_count})</span>
                ${v.is_verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
              </div>
            </div>
          </div>
          <div class="vc-meta">
            <span><i class="fa fa-location-dot"></i>${v.city}, ${v.state}</span>
            ${v.distance_km !== undefined ? `<span class="distance-badge"><i class="fa fa-location-crosshairs"></i>${v.distance_km} km away</span>` : ''}
          </div>
          <div class="vc-meta" style="margin-top:4px">
            <span><i class="fa fa-tag"></i>${capitalizeFirst(v.category)}</span>
            <span><i class="fa fa-briefcase"></i>${v.experience_years}+ yrs</span>
          </div>
          <div class="vc-actions">
            <button class="vc-btn vc-btn-secondary" onclick="event.stopPropagation();openDealModal(${v.id}, null)"><i class="fa fa-handshake"></i> Deal</button>
            <button class="vc-btn vc-btn-primary" onclick="event.stopPropagation();openLocalizeVendor(${v.id}, '${v.category}')">View</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function openLocalizeVendor(vid, cat) {
  currentCategory = cat;
  openVendorDetail(vid);
}

// ─── AUTH STATE ───
let authUserType = 'customer'; // 'customer' | 'vendor'
let authAction   = 'login';    // 'login'    | 'register'

// All form IDs: form-{userType}-{action}
function getFormId() { return `form-${authUserType}-${authAction}`; }

function switchUserType(type) {
  authUserType = type;

  // Left panel buttons
  document.getElementById('leftTypeCustomer')?.classList.toggle('active', type === 'customer');
  document.getElementById('leftTypeVendor')?.classList.toggle('active', type === 'vendor');

  // Top type tabs
  const tabC = document.getElementById('tabCustomer');
  const tabV = document.getElementById('tabVendor');
  tabC.classList.toggle('active', type === 'customer');
  tabV.classList.toggle('active', type === 'vendor');
  tabV.classList.toggle('vendor-active', type === 'vendor');

  // Action tabs colour
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('vendor-active-tab', type === 'vendor');
  });

  showAuthForm();
}

function switchAuthTab(action) {
  authAction = action;
  document.getElementById('actionLogin').classList.toggle('active', action === 'login');
  document.getElementById('actionRegister').classList.toggle('active', action === 'register');
  showAuthForm();
}

function showAuthForm() {
  const allForms = ['form-customer-login','form-customer-register','form-vendor-login','form-vendor-register'];
  allForms.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(getFormId());
  if (target) target.style.display = 'block';
}

// ── OTP auto-tab ──
function otpAutoTab(el, idx, groupId) {
  el.value = el.value.replace(/\D/g, '').slice(-1); // digits only
  if (el.value.length === 1 && idx < 5) {
    const inputs = document.getElementById(groupId).querySelectorAll('.otp-digit');
    inputs[idx + 1].focus();
  }
  if (el.value === '' && idx > 0) {
    const inputs = document.getElementById(groupId).querySelectorAll('.otp-digit');
    inputs[idx - 1].focus();
  }
}

function getOTP(groupId) {
  return [...document.getElementById(groupId).querySelectorAll('.otp-digit')].map(i => i.value).join('');
}

// ── SEND OTP ──
async function sendOTP(userType, action) {
  // Collect phone + email from the correct form
  const fid = `form-${userType}-${action}`;
  const prefix = userType === 'customer' ? (action === 'login' ? 'cLogin' : 'cReg') : (action === 'login' ? 'vLogin' : 'vReg');

  const phone = document.getElementById(prefix + 'Phone')?.value.trim();
  const email = document.getElementById(prefix + 'Email')?.value.trim();
  const name  = document.getElementById(prefix + 'Name')?.value.trim();

  if (!name)  { showToast('Please enter your full name', 'error'); return; }
  if (!/^\d{10}$/.test(phone)) { showToast('Enter a valid 10-digit phone number', 'error'); return; }
  if (!email || !email.includes('@')) { showToast('Enter a valid email address to receive OTP', 'error'); return; }

  // Extra vendor register validations
  if (userType === 'vendor' && action === 'register') {
    if (!document.getElementById('vRegShop').value.trim()) { showToast('Please enter your shop name', 'error'); return; }
    if (!document.getElementById('vRegCategory').value)    { showToast('Please select a business category', 'error'); return; }
    if (!document.getElementById('vRegListing').value.trim()) { showToast('Please fill in the business listing description', 'error'); return; }
    const gst = document.getElementById('vRegGST').value.trim();
    if (!gst || gst.length !== 15) { showToast('Enter a valid 15-character GST number', 'error'); return; }
  }

  showLoading(true);
  try {
    const res  = await fetch('/api/auth/send-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, email })
    });
    const data = await res.json();
    if (data.success) {
      const otpBoxId = prefix + 'OTPBox';
      document.getElementById(otpBoxId).style.display = 'block';
      document.getElementById(otpBoxId).scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`OTP sent to ${email} — check your inbox`, 'success');
    } else {
      showToast(data.message, 'error');
    }
  } catch (e) { showToast('Failed to send OTP. Check your connection.', 'error'); }
  showLoading(false);
}

// ── VERIFY OTP + LOGIN / REGISTER ──
async function verifyAndLogin(userType, action) {
  const prefix   = userType === 'customer' ? (action === 'login' ? 'cLogin' : 'cReg') : (action === 'login' ? 'vLogin' : 'vReg');
  const otpGroup = prefix + 'OTPInputs';

  const phone = document.getElementById(prefix + 'Phone').value.trim();
  const email = document.getElementById(prefix + 'Email').value.trim();
  const otp   = getOTP(otpGroup);

  if (otp.length < 6) { showToast('Enter all 6 OTP digits', 'error'); return; }

  showLoading(true);

  // 1. Verify OTP
  try {
    const vRes  = await fetch('/api/auth/verify-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    });
    const vData = await vRes.json();
    if (!vData.success) { showToast(vData.message, 'error'); showLoading(false); return; }
  } catch (e) { showToast('OTP verification failed', 'error'); showLoading(false); return; }

  // 2. Build payload
  let payload = { phone, email, user_type: userType };

  if (userType === 'customer') {
    payload.full_name = document.getElementById(prefix + 'Name').value.trim();
    if (action === 'register') {
      payload.address  = document.getElementById('cRegAddress').value.trim();
      payload.city     = document.getElementById('cRegCity').value.trim();
      payload.state    = document.getElementById('cRegState').value.trim();
      payload.pin_code = document.getElementById('cRegPin').value.trim();
    }
  } else {
    payload.full_name = document.getElementById(prefix + 'Name').value.trim();
    if (action === 'login') {
      payload.shop_name = document.getElementById('vLoginShop').value.trim();
    } else {
      payload.address       = document.getElementById('vRegAddress').value.trim();
      payload.city          = document.getElementById('vRegCity').value.trim();
      payload.state         = document.getElementById('vRegState').value.trim();
      payload.pin_code      = document.getElementById('vRegPin').value.trim();
      payload.shop_name     = document.getElementById('vRegShop').value.trim();
      payload.category      = document.getElementById('vRegCategory').value;
      payload.listing       = document.getElementById('vRegListing').value.trim();
      payload.gst_number    = document.getElementById('vRegGST').value.trim();
    }
  }

  // 3. Register / login
  try {
    const rRes  = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const rData = await rRes.json();
    if (rData.success) {
      currentUser = rData.user;
      updateAuthUI();
      showPage('home');
      const greeting = userType === 'vendor' ? `Welcome, ${rData.user.name.split(' ')[0]}! Your business is now listed.` : `Welcome to Raj & Co, ${rData.user.name.split(' ')[0]}!`;
      showToast(greeting, 'success');
    } else {
      showToast(rData.message || 'Authentication failed', 'error');
    }
  } catch (e) { showToast('Registration failed. Try again.', 'error'); }

  showLoading(false);
}

// Keep legacy function names working (called from old HTML remnants, if any)
function switchAuthTab_legacy(tab) { switchAuthTab(tab); }
function sendLoginOTP()     { sendOTP('customer', 'login'); }
function sendRegisterOTP()  { sendOTP('customer', 'register'); }
function verifyLoginOTP()   { verifyAndLogin('customer', 'login'); }
function verifyAndRegister(){ verifyAndLogin('customer', 'register'); }
function otpKeyup(el, idx)  { otpAutoTab(el, idx, 'cLoginOTPInputs'); }
function otpKeyupReg(el, idx){ otpAutoTab(el, idx, 'cRegOTPInputs'); }

// ─── DEAL MODAL ───
function openDealModal(vendorId, productId) {
  if (!currentUser) {
    showToast('Please login to start a deal', 'error');
    showPage('login');
    return;
  }
  document.getElementById('dealVendorId').value = vendorId;
  document.getElementById('dealProductId').value = productId || '';
  document.getElementById('dealTitle').value = '';
  document.getElementById('dealDesc').value = '';
  document.getElementById('dealModal').style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

async function submitDeal() {
  const vendorId = document.getElementById('dealVendorId').value;
  const productId = document.getElementById('dealProductId').value;
  const title = document.getElementById('dealTitle').value.trim();
  const desc = document.getElementById('dealDesc').value.trim();
  if (!title) { showToast('Please enter a deal title', 'error'); return; }
  showLoading(true);
  try {
    const res = await fetch('/api/deals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId, product_id: productId || null, title, description: desc })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('dealModal');
      showToast('Deal inquiry sent! Go to My Deals to track.', 'success');
    } else showToast(data.message || 'Failed to create deal', 'error');
  } catch (e) { showToast('Failed', 'error'); }
  showLoading(false);
}

// ─── DEALS PAGE ───
async function loadDeals() {
  if (!currentUser) { showPage('login'); return; }
  try {
    const res = await fetch('/api/deals');
    const data = await res.json();
    const list = document.getElementById('dealsList');
    if (!data.deals.length) {
      list.innerHTML = '<div style="padding:30px;text-align:center;color:#888"><i class="fa fa-handshake" style="font-size:32px;color:#ddd;display:block;margin-bottom:10px"></i><p>No deals yet</p><button class="btn-primary" style="margin-top:16px;font-size:13px;padding:10px 20px" onclick="showPage(\'home\')">Find Vendors</button></div>';
      return;
    }
    list.innerHTML = data.deals.map(d => `
      <div class="deal-item ${currentDealId === d.id ? 'active' : ''}" onclick="openDealChat(${d.id})" id="di-${d.id}">
        <div class="deal-item-icon"><i class="fa fa-handshake"></i></div>
        <div style="flex:1;min-width:0">
          <h4>${d.title}</h4>
          <p>${d.customer_name} ↔ ${d.vendor_name}</p>
          <span class="deal-status-badge status-${d.status}">${formatStatus(d.status)}</span>
          ${d.amount ? `<span style="margin-left:8px;font-size:11px;font-weight:700;color:var(--gold)">₹${d.amount.toLocaleString()}</span>` : ''}
        </div>
      </div>`).join('');
  } catch (e) { console.error('Load deals failed', e); }
}

async function openDealChat(dealId) {
  currentDealId = dealId;
  document.querySelectorAll('.deal-item').forEach(d => d.classList.remove('active'));
  document.getElementById('di-' + dealId)?.classList.add('active');

  const res = await fetch('/api/deals');
  const data = await res.json();
  const deal = data.deals.find(d => d.id === dealId);
  if (!deal) return;

  const chatArea = document.getElementById('chatArea');
  chatArea.innerHTML = `
    <div class="chat-header">
      <div>
        <h4>${deal.title}</h4>
        <p>${deal.customer_name} ↔ ${deal.vendor_name} · <span class="deal-status-badge status-${deal.status}">${formatStatus(deal.status)}</span></p>
      </div>
      <div class="deal-status-controls">
        <button class="ds-btn ds-agreed" onclick="updateDealStatus(${dealId},'agreed')">✓ Agreed</button>
        <button class="ds-btn ds-progress" onclick="updateDealStatus(${dealId},'in_progress')">▶ In Progress</button>
        <button class="ds-btn ds-complete" onclick="updateDealStatus(${dealId},'completed')">✅ Complete</button>
        <button class="ds-btn ds-cancel" onclick="updateDealStatus(${dealId},'cancelled')">✗ Cancel</button>
      </div>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input-area">
      <div class="chat-input-form">
        <textarea id="chatInput" placeholder="Type your message..." rows="1" onkeydown="chatKeydown(event, ${dealId})"></textarea>
        <button class="chat-send-btn" onclick="sendChatMessage(${dealId})"><i class="fa fa-paper-plane"></i></button>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button onclick="sendQuickMsg(${dealId},'Can we discuss pricing?')" style="padding:5px 12px;border-radius:20px;font-size:11px;border:1px solid #ddd;background:white;cursor:pointer;color:#555">💬 Discuss Price</button>
        <button onclick="sendQuickMsg(${dealId},'When can you start the work?')" style="padding:5px 12px;border-radius:20px;font-size:11px;border:1px solid #ddd;background:white;cursor:pointer;color:#555">📅 Timeline</button>
        <button onclick="sendQuickMsg(${dealId},'Please share your catalog and samples.')" style="padding:5px 12px;border-radius:20px;font-size:11px;border:1px solid #ddd;background:white;cursor:pointer;color:#555">📋 Request Catalog</button>
      </div>
    </div>`;

  await loadMessages(dealId);
  startChatPoll(dealId);
}

async function loadMessages(dealId) {
  try {
    const res = await fetch(`/api/deals/${dealId}/messages`);
    const data = await res.json();
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    msgs.innerHTML = data.messages.map(m => {
      const isMine = m.sender_id === data.current_user_id;
      if (m.msg_type === 'status') {
        return `<div class="msg-bubble system"><div class="bubble-content">${m.content}</div><div class="msg-meta">${formatTime(m.created_at)}</div></div>`;
      }
      return `<div class="msg-bubble ${isMine ? 'sent' : 'received'}">
        <div class="bubble-content">${escapeHtml(m.content)}</div>
        <div class="msg-meta">${isMine ? '' : `<span class="msg-sender">${m.sender_name} · </span>`}${formatTime(m.created_at)}</div>
      </div>`;
    }).join('');
    msgs.scrollTop = msgs.scrollHeight;
  } catch (e) {}
}

async function sendChatMessage(dealId) {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await fetch(`/api/deals/${dealId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    await loadMessages(dealId);
  } catch (e) { showToast('Failed to send message', 'error'); }
}

function sendQuickMsg(dealId, msg) {
  document.getElementById('chatInput').value = msg;
  sendChatMessage(dealId);
}

function chatKeydown(e, dealId) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(dealId); }
}

async function updateDealStatus(dealId, status) {
  let amount = null;
  if (status === 'agreed') {
    amount = prompt('Enter the agreed deal amount (₹):');
    if (amount) amount = parseFloat(amount);
  }
  try {
    await fetch(`/api/deals/${dealId}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, amount })
    });
    showToast(`Deal status updated to: ${formatStatus(status)}`, 'success');
    await loadDeals();
    await openDealChat(dealId);
  } catch (e) { showToast('Failed to update status', 'error'); }
}

function startChatPoll(dealId) {
  stopChatPoll();
  chatPollInterval = setInterval(() => loadMessages(dealId), 5000);
}
function stopChatPoll() {
  if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
}

// ─── DASHBOARD ───
async function loadDashboard() {
  if (!currentUser) { showPage('login'); return; }
  const container = document.getElementById('dashboardContent');
  try {
    const res = await fetch('/api/deals');
    const data = await res.json();
    const deals = data.deals;
    const statusCounts = {};
    deals.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:32px">
        ${[
          { label: 'Total Deals', value: deals.length, icon: 'fa-handshake', color: 'var(--gold)' },
          { label: 'Active', value: (statusCounts.in_progress || 0) + (statusCounts.negotiating || 0), icon: 'fa-spinner', color: 'var(--accent)' },
          { label: 'Completed', value: statusCounts.completed || 0, icon: 'fa-check-circle', color: 'var(--green)' },
          { label: 'Inquiries', value: statusCounts.inquiry || 0, icon: 'fa-question-circle', color: 'var(--blue)' }
        ].map(s => `
          <div style="background:white;border-radius:16px;padding:24px;border:1px solid #EDE5D5">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-size:32px;font-weight:700;color:${s.color};font-family:var(--font-display)">${s.value}</div>
                <div style="font-size:13px;color:#888;margin-top:4px">${s.label}</div>
              </div>
              <div style="width:44px;height:44px;border-radius:10px;background:rgba(201,168,76,0.1);display:flex;align-items:center;justify-content:center;color:${s.color};font-size:18px">
                <i class="fa ${s.icon}"></i>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div style="background:white;border-radius:16px;border:1px solid #EDE5D5;overflow:hidden">
        <div style="padding:20px 24px;border-bottom:1px solid #EDE5D5;display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-family:var(--font-display);font-size:20px;color:var(--dark)">Recent Deals</h3>
          <button class="btn-primary" style="font-size:12px;padding:8px 16px" onclick="showPage('deals')">View All</button>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead style="background:var(--cream)">
            <tr>${['Title','Vendor','Status','Amount','Date'].map(h => `<th style="padding:12px 20px;text-align:left;font-size:12px;font-weight:600;color:#888;letter-spacing:0.5px">${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${deals.slice(0, 10).map(d => `
              <tr style="border-bottom:1px solid #f0ebe3;cursor:pointer" onclick="showPage('deals')">
                <td style="padding:14px 20px;font-size:14px;font-weight:600;color:var(--dark)">${d.title}</td>
                <td style="padding:14px 20px;font-size:13px;color:#555">${d.vendor_name}</td>
                <td style="padding:14px 20px"><span class="deal-status-badge status-${d.status}">${formatStatus(d.status)}</span></td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:var(--gold)">${d.amount ? '₹' + d.amount.toLocaleString() : '—'}</td>
                <td style="padding:14px 20px;font-size:12px;color:#888">${new Date(d.created_at).toLocaleDateString('en-IN')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) { container.innerHTML = '<p style="color:#888;padding:40px;text-align:center">Failed to load dashboard</p>'; }
}

// ─── UTILITIES ───
function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa ${icons[type]}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatStatus(status) {
  const map = { inquiry: 'Inquiry', negotiating: 'Negotiating', agreed: 'Agreed', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };
  return map[status] || status;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
