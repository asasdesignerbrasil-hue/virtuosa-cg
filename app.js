import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

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
let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

// DOM
const cartCount = q('#cart-count');
const cartPanel = q('#cart');
const cartItemsWrap = q('#cart-items');
const cartTotalEl = q('#cart-total');
const btnCart = q('#btn-cart');
const whatsappOrderBtn = q('#whatsapp-order');
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
// ... (função existente, sem mudanças) ...
  cartCount.textContent = cart.reduce((s,i)=>s+i.qty,0);
  cartItemsWrap.innerHTML = '';
  let total = 0;

  if(cart.length === 0){
    cartItemsWrap.innerHTML = '<p>Seu carrinho está vazio.</p>';
  } else {
    cart.forEach(it => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div>${it.code} — ${it.name} x ${it.qty}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${formatCurrency(it.price*it.qty)}
          <button class="btn small btn-remove" data-id="${it.id}" data-action="remove" title="Remover 1">-</button>
        </div>`;
      cartItemsWrap.appendChild(div);
    });
  }

  total = cart.reduce((s,i)=>s + i.price * i.qty,0);
  cartTotalEl.textContent = formatCurrency(total);
}

whatsappOrderBtn.addEventListener('click', async function(e) {
  e.preventDefault();

  const customerName = customerNameInput.value.trim();
  const customerPhone = customerPhoneInput.value.trim();
  const customerAddress = customerAddressInput.value.trim();

  // 1. Validação
  if (!customerName || !customerPhone) {
    alert('Por favor, informe seu nome e telefone para continuar.');
    customerNameInput.focus();
    return;
  }

  if (cart.length === 0) {
    alert('Seu carrinho está vazio.');
    return;
  }

  // 2. Preparar dados
  let total = cart.reduce((s,i)=>s + i.price * i.qty,0);
  const pedidoItens = cart.map(i=> `(${i.code}) ${i.name} - ${i.qty}x`);
  const resumoPedido = pedidoItens.join('; '); // Resumo para o DB
  const totalCents = Math.round(total * 100);

  // 3. Salvar no Supabase
  try {
    const payload = {
      resumo: resumoPedido,
      total_cents: totalCents,
      whatsapp_number: customerPhone,
      customer_name: customerName,
      address: customerAddress || null
    };

    const { error } = await supabase.from('pedidos').insert(payload);

    if (error) {
        throw error;
    }

    console.log('Pedido salvo no banco de dados!');

  } catch (error) {
    console.error('Erro ao salvar pedido no DB:', error.message);
  }

  // 4. Montar URL do WhatsApp
  const pedidoHeader = '*NOVO PEDIDO - VIRTUOSA CG*';
  const clienteInfo = [
    `*Cliente:* ${customerName}`,
    `*Telefone:* ${customerPhone}`
  ];
  if (customerAddress) {
    clienteInfo.push(`*Endereço:* ${customerAddress}`);
  }

  const pedidoTotal = `*Total:* ${formatCurrency(total)}`;
  const pedidoOrigem = `*Origem:* ${SITE_URL}`;

  // Junta com quebras de linha reais (\n)
  const text = [
    pedidoHeader,
    ...clienteInfo,
    '---',
    '*Itens:*',
    ...pedidoItens,
    '---',
    pedidoTotal,
    pedidoOrigem
  ].join('\n');

  const encodedText = encodeURIComponent(text);

  const url = `https://wa.me/${phone}?text=${encodedText}`;
  window.open(url, '_blank');
});

function addToCart(id, name, price, code){
// ... (função existente, sem mudanças) ...
  const found = cart.find(i=>i.id === id);
  if(found){
    found.qty += 1;
  } else {
    cart.push({id, name, price, qty:1, code});
  }
  saveCart();
}

function removeFromCart(id){
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
    const code = card.dataset.code || card.dataset.id;
    addToCart(card.dataset.id, card.dataset.name, Number(card.dataset.price), code);
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
  const whatsappBtn = e.target.closest('.btn-whatsapp');
  if(whatsappBtn){
    // Este é o botão "Comprar pelo WhatsApp" do card individual
    const card = whatsappBtn.closest('.card');
    const code = card.dataset.code || card.dataset.id;
    const total = formatCurrency(Number(card.dataset.price));
    const simpleText = `PEDIDO VIRTUOSA CG\nProduto ${code}\nQtd 1\nTOTAL ${total}\n${SITE_URL}`;
    const encodedSimpleText = encodeURIComponent(simpleText);

    const href = `https://wa.me/${phone}?text=${encodedSimpleText}`;
    whatsappBtn.setAttribute('href', href);
    // Deixa o link ser seguido normalmente
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

    if (data.length === 0) {
        menuGrid.innerHTML = '<p>Nenhum produto disponível no momento.</p>';
        return;
    }

    menuGrid.innerHTML = '';

    const placeholderImg = 'https://placehold.co/600x400/fff4fb/0e0a0d?text=Virtuosa+CG';

    for (const p of data) {
        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.id = p.id;
        card.dataset.code = p.codigo;
        card.dataset.category = p.category;
        card.dataset.name = p.name;
        card.dataset.price = p.price;

        card.innerHTML = `
            <img src="${p.image_url || placeholderImg}" alt="${p.name}" onerror="this.onerror=null;this.src='${placeholderImg}';">
            <div class="card-body">
              <h3 class="item-name">${formatProductTitle(p)}</h3>
              <p class="item-desc">${p.description || 'Sem descrição.'}</p>
              <div class="card-footer">
                <span class="price">${formatCurrency(p.price)}</span>
                <div class="btns">
                  <button class="btn small btn-cart" data-action="add">Adicionar</button>
                  <button class="btn small btn-more">Ver mais</button>
                  <a class="btn small btn-whatsapp" href="#" data-wtext="${p.codigo}">Comprar pelo WhatsApp</a>
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
