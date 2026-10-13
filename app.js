import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { cartItemFromProduct, composeWhatsAppMessage, escapeHtml, reconcileCart, stockQuantity } from './src/js/order-utils.mjs';

const SUPABASE_URL = 'https://ovospsvsraiudnqfapeb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92b3Nwc3ZzcmFpdWRucWZhcGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MDM5NTgsImV4cCI6MjA3NjM3OTk1OH0.alUcXs_g4_xaV7r_2xCQPofdOKB3aFnt_3BDCy2AjgM';
const SITE_URL = 'https://virtuosacg.store/';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// utilidades
const q = sel => document.querySelector(sel);
const qa = sel => Array.from(document.querySelectorAll(sel));

// WhatsApp da loja
const phone = '5583987118599'; // formato 55 + DDD + número

// estado do carrinho
const CART_KEY = 'virtuosa_cg_cart_v1';
let cart = [];
try {
  const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  if (Array.isArray(stored)) cart = stored.filter(item => item && item.id != null && Number.isInteger(item.qty) && item.qty > 0);
} catch {
  localStorage.removeItem(CART_KEY);
}
const productsById = new Map();
let isOrdering = false;

// DOM
const cartCount = q('#cart-count');
const cartPanel = q('#cart');
const cartItemsWrap = q('#cart-items');
const cartTotalEl = q('#cart-total');
const btnCart = q('#btn-cart');
const whatsappOrderBtn = q('#whatsapp-order');
const customerForm = q('#customer-form');
const yearEl = q('#year');
const customerNameInput = q('#customer-name');
const customerPhoneInput = q('#customer-phone');
const customerAddressInput = q('#customer-address');
const menuGrid = q('#menu');
const bannerWrap = q('#banner-aviso-wrap'); // NOVO
const bannerText = q('#banner-aviso-text'); // NOVO

yearEl.textContent = new Date().getFullYear();

// helpers
function saveCart(){
// ... (função existente, sem mudanças) ...
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

function formatCurrency(v){
// ... (função existente, sem mudanças) ...
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function formatProductTitle(product){
  return product.codigo ? `${product.codigo} — ${product.name}` : product.name;
}

function renderCart(){
  cartCount.textContent = cart.reduce((s,i)=>s+i.qty,0);
  cartItemsWrap.innerHTML = '';
  if(cart.length === 0){
    cartItemsWrap.innerHTML = '<p>Seu carrinho está vazio.</p>';
  } else {
    cart.forEach(it => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      const stock = stockQuantity(it);
      const unavailable = it.active === false || stock === 0;
      const atLimit = unavailable || (stock != null && it.qty >= stock);
      const warning = unavailable ? 'Produto indisponível.' : stock != null && it.qty > stock ? `Disponível: ${stock} unidade(s).` : '';
      div.innerHTML = `
        ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" alt="${escapeHtml(it.name)}">` : ''}
        <div class="cart-item-details">
          <h4 class="cart-item-name">${escapeHtml(it.code)} — ${escapeHtml(it.name)}</h4>
          <p class="cart-item-description">${escapeHtml(it.description || '')}</p>
          <div>${formatCurrency(it.price)} por unidade</div>
          ${warning ? `<p class="cart-stock-warning">${warning}</p>` : ''}
          <div class="cart-item-quantity">
            <button type="button" class="btn small" data-id="${escapeHtml(it.id)}" data-action="remove" aria-label="Remover uma unidade de ${escapeHtml(it.name)}">-</button>
            <span>${it.qty}</span>
            <button type="button" class="btn small" data-id="${escapeHtml(it.id)}" data-action="increase" aria-label="Adicionar uma unidade de ${escapeHtml(it.name)}" ${atLimit ? 'disabled' : ''}>+</button>
            <strong>${formatCurrency(it.price * it.qty)}</strong>
          </div>
        </div>`;
      cartItemsWrap.appendChild(div);
    });
  }
  const total = cart.reduce((s,i)=>s + i.price * i.qty,0);
  cartTotalEl.textContent = formatCurrency(total);
  whatsappOrderBtn.disabled = cart.length === 0 || isOrdering;
}

customerForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  if (isOrdering || !customerForm.reportValidity() || cart.length === 0) return;
  await openWhatsAppOrder(cart, {
    name: customerNameInput.value.trim(),
    phone: customerPhoneInput.value.trim(),
    address: customerAddressInput.value.trim()
  }, true);
});

async function openWhatsAppOrder(requestedItems, customer = {}, fromCart = false) {
  if (isOrdering) return;
  requestedItems = requestedItems.map(item => ({ ...item }));
  // Open during the user gesture so mobile browsers can keep the WhatsApp tab.
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  isOrdering = true;
  renderCart();
  try {
    const { data, error } = await supabase.from('produtos').select('*')
      .in('id', requestedItems.map(item => item.id));
    if (error) throw error;
    const refreshed = reconcileCart(requestedItems, data);
    if (refreshed.changed || refreshed.items.length === 0) {
      popup?.close();
      if (fromCart) {
        cart = refreshed.items;
        saveCart();
      }
      await loadMenu();
      alert('A disponibilidade ou o preço mudou. Confira os produtos antes de continuar.');
      return;
    }
    const text = composeWhatsAppMessage(refreshed.items, customer, SITE_URL);
    if (fromCart) {
      cart = refreshed.items;
      saveCart();
      try {
        const { error: orderError } = await supabase.from('pedidos').insert({
          resumo: text,
          total_cents: Math.round(cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 100),
          whatsapp_number: customer.phone,
          customer_name: customer.name,
          address: customer.address || null
        });
        if (orderError) console.error('Erro ao registrar pedido:', orderError.message);
      } catch (orderError) {
        console.error('Erro ao registrar pedido:', orderError.message);
      }
    }
    const href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    if (popup && !popup.closed) popup.location.replace(href);
    else window.location.assign(href);
  } catch (error) {
    popup?.close();
    alert('Não foi possível verificar os produtos. Tente novamente.');
    console.error('Erro ao preparar pedido:', error.message);
  } finally {
    isOrdering = false;
    renderCart();
  }
}

function addToCart(id){
  if (isOrdering) return;
  const product = productsById.get(String(id));
  if (!product || product.active === false) return;
  const found = cart.find(item => String(item.id) === String(id));
  const stock = stockQuantity(product);
  if (stock != null && (found?.qty || 0) >= stock) {
    alert(stock === 0 ? 'Este produto está esgotado.' : 'Você atingiu a quantidade disponível deste produto.');
    return;
  }
  if (found) Object.assign(found, cartItemFromProduct(product, found.qty + 1));
  else cart.push(cartItemFromProduct(product));
  saveCart();
}

function removeFromCart(id){
  if (isOrdering) return;
// ... (função existente, sem mudanças) ...
  const idx = cart.findIndex(i=>i.id === id);
  if(idx > -1){
    cart[idx].qty -= 1;
    if(cart[idx].qty <= 0) cart.splice(idx,1);
    saveCart();
  }
}

// Delegação de eventos
document.addEventListener('click', function(e){
// ... (função existente, sem mudanças) ...
  const addBtn = e.target.closest('.btn-cart[data-action="add"]');
  if(addBtn){
    const card = addBtn.closest('.card');
    addToCart(card.dataset.id);
    return;
  }
  const removeBtn = e.target.closest('button[data-action="remove"]');
  if(removeBtn){
    removeFromCart(removeBtn.dataset.id);
    return;
  }
  const moreBtn = e.target.closest('.btn-more');
  if(moreBtn){
    alert('Descrição completa:\n' + moreBtn.closest('.card').querySelector('.item-desc').textContent);
    return;
  }
  const increaseBtn = e.target.closest('button[data-action="increase"]');
  if (increaseBtn) {
    addToCart(increaseBtn.dataset.id);
    return;
  }
  const whatsappBtn = e.target.closest('.btn-whatsapp');
  if(whatsappBtn){
    e.preventDefault();
    const card = whatsappBtn.closest('.card');
    const product = productsById.get(card.dataset.id);
    if (!product || stockQuantity(product) === 0 || product.active === false) return;
    openWhatsAppOrder([cartItemFromProduct(product)]);
    return;
  }
});

// Abrir/fechar painel do carrinho
btnCart.addEventListener('click', function(e){
// ... (função existente, sem mudanças) ...
  e.preventDefault();
  cartPanel.classList.toggle('open');
  const isOpen = cartPanel.classList.contains('open');
  cartPanel.setAttribute('aria-hidden', String(!isOpen));
  btnCart.setAttribute('aria-expanded', String(isOpen));
});
cartPanel.querySelector('.close-panel').addEventListener('click', function(){
// ... (função existente, sem mudanças) ...
  cartPanel.classList.remove('open');
  cartPanel.setAttribute('aria-hidden', 'true');
  btnCart.setAttribute('aria-expanded', 'false');
});

function updateCartViewport() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--cart-viewport-height', `${viewport?.height || window.innerHeight}px`);
  document.documentElement.style.setProperty('--cart-viewport-top', `${viewport?.offsetTop || 0}px`);
}
window.addEventListener('resize', updateCartViewport);
window.visualViewport?.addEventListener('resize', updateCartViewport);
window.visualViewport?.addEventListener('scroll', updateCartViewport);
updateCartViewport();

// Filtros
qa('.filter-btn').forEach(btn=>{
// ... (função existente, sem mudanças) ...
  btn.addEventListener('click', ()=>{
    qa('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    qa('.card').forEach(card=>{
      if(f === 'all' || card.dataset.category === f){
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// Busca
q('#search').addEventListener('input', function(){
// ... (função existente, sem mudanças) ...
  const term = this.value.toLowerCase();
  qa('.card').forEach(card=>{
    const name = card.dataset.name.toLowerCase();
    const desc = card.querySelector('.item-desc').textContent.toLowerCase();
    const code = (card.dataset.code || '').toLowerCase();
    if(name.includes(term) || desc.includes(term) || code.includes(term)) card.style.display = '';
    else card.style.display = 'none';
  });
});

// --- Carregamento dinâmico do Menu ---
async function loadMenu() {
// ... (função existente, sem mudanças) ...
    console.log('Carregando catálogo da Virtuosa CG...');
    menuGrid.innerHTML = '<p>Carregando catálogo...</p>';

    const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('active', true)
        .in('category', ['vestidos', 'saias', 'blusas', 'conjuntos', 'acessorios', 'promocoes'])
        .order('name', { ascending: true });

    if (error) {
        console.error('Erro ao carregar catálogo:', error);
        menuGrid.innerHTML = '<p>Erro ao carregar o catálogo. Tente recarregar a página.</p>';
        return;
    }

    productsById.clear();
    data.forEach(product => productsById.set(String(product.id), product));
    cart = cart.map(item => {
      const product = productsById.get(String(item.id));
      return product ? cartItemFromProduct(product, item.qty) : { ...item, active: false, stock: 0 };
    });
    saveCart();

    if (data.length === 0) {
        menuGrid.innerHTML = '<p>Nenhum produto disponível no momento.</p>';
        return;
    }

    menuGrid.innerHTML = '';

    const placeholderImg = 'https://placehold.co/600x400/fff4fb/0e0a0d?text=Virtuosa+CG';

    for (const p of data) {
        const card = document.createElement('article');
        card.className = 'card';
        card.id = `produto-${p.id}`;
        card.dataset.id = p.id;
        card.dataset.code = p.codigo ?? p.id;
        card.dataset.category = p.category;
        card.dataset.name = p.name;
        card.dataset.price = p.price;

        const stock = stockQuantity(p);
        const soldOut = stock === 0;
        const item = cartItemFromProduct(p);
        const buyHref = `https://wa.me/${phone}?text=${encodeURIComponent(composeWhatsAppMessage([item], {}, SITE_URL))}`;
        card.innerHTML = `
            <img src="${escapeHtml(p.image_url || placeholderImg)}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='${placeholderImg}';">
            <div class="card-body">
              <h3 class="item-name">${escapeHtml(formatProductTitle(p))}</h3>
              <p class="item-desc">${escapeHtml(p.description || 'Sem descrição.')}</p>
              ${stock != null ? `<p class="stock-label ${soldOut ? 'sold-out' : ''}">${soldOut ? 'Esgotado' : `${stock} unidade(s) disponível(is)`}</p>` : ''}
              <div class="card-footer">
                <span class="price">${formatCurrency(p.price)}</span>
                <div class="btns">
                  <button class="btn small btn-cart" data-action="add" ${soldOut ? 'disabled' : ''}>Adicionar</button>
                  <button class="btn small btn-more">Ver mais</button>
                  <a class="btn small btn-whatsapp" href="${soldOut ? '#' : buyHref}" aria-disabled="${soldOut}" target="_blank" rel="noopener noreferrer">Comprar pelo WhatsApp</a>
                </div>
              </div>
            </div>
        `;
        menuGrid.appendChild(card);
    }
}

// --- NOVO: Carregamento dinâmico do Banner ---
async function loadBanner() {
    console.log('Carregando aviso...');
    const { data, error } = await supabase
        .from('configuracoes')
        .select('value')
        .eq('key', 'banner_aviso')
        .single();

    if (error) {
        console.error('Erro ao carregar aviso:', error.message);
        bannerWrap.hidden = true;
        return;
    }

    if (data && data.value) {
        bannerText.textContent = data.value;
        bannerWrap.hidden = false;
    } else {
        bannerWrap.hidden = true;
    }
}


// --- Assinatura Realtime ---
// ... (função existente, sem mudanças) ...
supabase.channel('produtos-changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'produtos' },
    (payload) => {
      console.log('Mudança detectada no catálogo!', payload);
      loadMenu();
    }
  )
  .subscribe();

// NOVO: Ouvir mudanças no banner
supabase.channel('config-changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'configuracoes', filter: 'key=eq.banner_aviso' },
    (payload) => {
      console.log('Banner atualizado!', payload);
      // Recarrega o banner
      loadBanner();
    }
  )
  .subscribe();


// --- Inicialização ---
renderCart();
loadMenu();
loadBanner(); // NOVO

// Fim do app.js
