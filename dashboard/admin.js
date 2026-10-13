import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { escapeHtml } from '../src/js/order-utils.mjs'

const SUPABASE_URL = 'https://ovospsvsraiudnqfapeb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92b3Nwc3ZzcmFpdWRucWZhcGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MDM5NTgsImV4cCI6MjA3NjM3OTk1OH0.alUcXs_g4_xaV7r_2xCQPofdOKB3aFnt_3BDCy2AjgM'
const BUCKET_NAME = 'produtos'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// UI
const loginView = document.getElementById('login-view')
// ... (código existente sem mudanças) ...
const dashboardView = document.getElementById('dashboard-view')
const produtosView = document.getElementById('produtos-view')
const novoView = document.getElementById('novo-view')
const configView = document.getElementById('config-view') // NOVO
const loginForm = document.getElementById('login-form')
const loginButton = document.getElementById('btn-login')
const forgotPasswordButton = document.getElementById('forgot-password')
const authFeedback = document.getElementById('auth-feedback')
const resetView = document.getElementById('reset-view')
const resetForm = document.getElementById('reset-form')
const resetFeedback = document.getElementById('reset-feedback')
const savePasswordButton = document.getElementById('save-password')
const captchaContainer = document.getElementById('login-captcha')
const stockInput = document.getElementById('produto-estoque')
const produtoForm = document.getElementById('produto-form')
const configForm = document.getElementById('config-form') // NOVO
const produtosList = document.getElementById('produtos-list')
const countProd = document.getElementById('count-prod')
const adminEmail = document.getElementById('admin-email')
const adminWrap = document.querySelector('.admin-wrap');

// UI - Responsividade
const menuToggle = document.getElementById('menu-toggle')
// ... (código existente sem mudanças) ...
const sidebar = document.getElementById('sidebar')

// UI - Upload
const uploadInput = document.getElementById('produto-upload')
// ... (código existente sem mudanças) ...
const preview = document.getElementById('img-preview')
const uploadStatus = document.getElementById('upload-status')
const imgUrlInput = document.getElementById('produto-img')
const saveBtn = document.getElementById('save-prod')

// UI - Estatísticas do Dashboard
const countPedidosHoje = document.getElementById('count-pedidos-hoje')
const countGanhosHoje = document.getElementById('count-ganhos-hoje')


let currentUser = null
let isUploading = false
let editingStock = null
let ordersChannel = null
let captchaSiteKey = ''
let captchaToken = ''
let captchaWidgetId = null
let captchaConfigError = false
let recoveryMode = new URLSearchParams(location.search).get('recovery') === '1' ||
  new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery'

// --- Helpers ---
function show(view){
  [loginView,dashboardView,produtosView,novoView,configView,resetView].forEach(v=>v.hidden=true)
  if(view === 'login') loginView.hidden = false
  if(view === 'dashboard') dashboardView.hidden = false
  if(view === 'produtos') produtosView.hidden = false
  if(view === 'novo') novoView.hidden = false
  if(view === 'config') configView.hidden = false // NOVO
  if(view === 'reset') resetView.hidden = false
}

function setActiveNav(name){
// ... (código existente sem mudanças) ...
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'))
  const btn = document.querySelector(`.nav-btn[data-view="${name}"]`)
  if(btn) btn.classList.add('active')
}

// Helper para formatar moeda
function formatCurrency(v){
// ... (código existente sem mudanças) ...
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function setAuthLayout(isLoggedIn) {
  document.body.classList.toggle('is-logged-in', isLoggedIn)
  document.body.classList.toggle('is-logged-out', !isLoggedIn)
  adminWrap.classList.toggle('logged-in', isLoggedIn)
  adminWrap.classList.toggle('logged-out', !isLoggedIn)
}

function resetProdutoForm() {
// ... (código existente sem mudanças) ...
    produtoForm.reset();
    document.getElementById('produto-id').value = '';
    stockInput.value = '';
    editingStock = null;
    document.getElementById('form-title').textContent = 'Adicionar Produto';
    preview.src = '';
    preview.hidden = true;
    uploadStatus.textContent = '';
    uploadInput.value = null;
    isUploading = false;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
}

// --- Carregar estatísticas do Dashboard ---
async function loadDashboardStats() {
// ... (código existente sem mudanças) ...
    // Pega o início do dia de hoje (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISOString = today.toISOString();

    // Busca pedidos de hoje
    const { data, error } = await supabase
        .from('pedidos')
        .select('total_cents')
        .gte('created_at', todayISOString); // gte = maior ou igual a

    if (error) {
        console.error('Erro ao buscar estatísticas:', error.message);
        countPedidosHoje.textContent = '?';
        countGanhosHoje.textContent = 'Erro';
        return;
    }

    // Calcula os totais
    const pedidosHoje = data.length;
    const ganhosHoje = data.reduce((sum, order) => sum + (order.total_cents || 0), 0) / 100; // / 100 para converter centavos

    // Atualiza a UI
    countPedidosHoje.textContent = pedidosHoje;
    countGanhosHoje.textContent = formatCurrency(ganhosHoje);
}


// --- Carregar Configurações (NOVA FUNÇÃO) ---
async function loadConfig() {
    console.log('Carregando configurações...');
    const { data, error } = await supabase
        .from('configuracoes')
        .select('value')
        .eq('key', 'banner_aviso')
        .single();

    if (error) {
        console.error('Erro ao carregar config:', error.message);
        return;
    }

    if (data) {
        document.getElementById('banner-text').value = data.value;
    }
}

// --- Salvar Configurações (NOVO EVENTO) ---
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-config');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const newText = document.getElementById('banner-text').value;

    const { error } = await supabase
        .from('configuracoes')
        .update({ value: newText })
        .eq('key', 'banner_aviso');

    if (error) {
        alert('Erro ao salvar aviso: ' + error.message);
    } else {
        alert('Aviso salvo com sucesso!');
    }

    btn.disabled = false;
    btn.textContent = 'Salvar Aviso';
});


// Auth
function setFeedback(element, message = '', isError = false, kind = '') {
  element.textContent = message
  element.dataset.kind = kind
  element.hidden = !message
  element.classList.toggle('error', isError)
}

function authErrorMessage(error) {
  if (error.code === 'captcha_required') return 'Conclua a verificação de segurança para continuar.'
  if (error.code === 'captcha_unavailable') return 'A verificação de segurança não carregou. Atualize a página e tente novamente.'
  if (error.code === 'captcha_failed') return 'A verificação de segurança expirou ou falhou. Tente novamente.'
  if (error.code === 'invalid_credentials') return 'E-mail ou senha incorretos.'
  if (error.code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.'
  if (error.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (error.code === 'otp_expired') return 'O link expirou. Solicite uma nova recuperação de senha.'
  if (error.code === 'weak_password') return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.'
  if (error.code === 'same_password') return 'Escolha uma senha diferente da atual.'
  if (/fetch|network/i.test(error.message || '')) return 'Falha de conexão. Verifique sua internet e tente novamente.'
  return 'Não foi possível concluir o acesso. Tente novamente em alguns instantes.'
}

async function initializeCaptcha() {
  try {
    const { data, error } = await supabase.from('configuracoes').select('value')
      .eq('key', 'turnstile_site_key').maybeSingle()
    if (error) throw error
    captchaSiteKey = data?.value?.trim() || ''
    if (!captchaSiteKey) return
    captchaContainer.hidden = false
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.addEventListener('load', () => {
      try {
        captchaWidgetId = window.turnstile.render(captchaContainer, {
        sitekey: captchaSiteKey, theme: 'light', size: 'compact', language: 'pt-br',
        callback(token) {
          captchaToken = token
          if (authFeedback.dataset.kind === 'captcha') setFeedback(authFeedback)
        },
        'expired-callback'() {
          captchaToken = ''
          setFeedback(authFeedback, 'Conclua novamente a verificação de segurança.', true, 'captcha')
        },
        'error-callback'() {
          captchaToken = ''
          setFeedback(authFeedback, 'Não foi possível validar a segurança. Tente novamente.', true, 'captcha')
        }
        })
      } catch {
        captchaConfigError = true
        setFeedback(authFeedback, authErrorMessage({ code: 'captcha_unavailable' }), true, 'captcha')
      }
    })
    script.addEventListener('error', () => {
      captchaConfigError = true
      setFeedback(authFeedback, authErrorMessage({ code: 'captcha_unavailable' }), true, 'captcha')
    })
    document.head.appendChild(script)
  } catch (error) {
    captchaConfigError = true
    setFeedback(authFeedback, authErrorMessage({ code: 'captcha_unavailable' }), true, 'captcha')
  }
}

async function captchaOptions() {
  await captchaReady
  if (captchaConfigError) throw { code: 'captcha_unavailable' }
  if (!captchaSiteKey) return {}
  if (!captchaToken) throw { code: 'captcha_required' }
  return { captchaToken }
}

function resetCaptcha() {
  captchaToken = ''
  if (captchaWidgetId != null && window.turnstile) window.turnstile.reset(captchaWidgetId)
}

function applyAuthSession(session, event) {
  const previousUserId = currentUser?.id
  currentUser = session?.user || null
  if (event === 'PASSWORD_RECOVERY') recoveryMode = true
  if (ordersChannel && (!currentUser || recoveryMode)) {
    supabase.removeChannel(ordersChannel)
    ordersChannel = null
  }
  setAuthLayout(Boolean(currentUser) && !recoveryMode)
  sidebar.classList.remove('open')
  adminEmail.textContent = currentUser?.email || '—'

  if (!currentUser) {
    show('login')
    return
  }
  if (recoveryMode) {
    show('reset')
    return
  }
  if (previousUserId !== currentUser.id || !loginView.hidden || !resetView.hidden) {
    show('dashboard')
    setActiveNav('dashboard')
    loadProdutos()
    loadDashboardStats()
    loadConfig()
  }
  if (!ordersChannel) {
    ordersChannel = supabase.channel('pedidos-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, loadDashboardStats)
      .subscribe()
  }
}

async function handleAuthState() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    applyAuthSession(data.session)
    if (recoveryMode && !data.session) {
      setFeedback(authFeedback, 'O link de recuperação está inválido ou expirou. Solicite um novo link.', true)
    }
  } catch (error) {
    applyAuthSession(null)
    setFeedback(authFeedback, authErrorMessage(error), true)
  }
}

// Defer UI loading until the auth callback releases the session lock.
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(() => applyAuthSession(session, event), 0)
})

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (loginButton.disabled) return
  setFeedback(authFeedback)
  loginButton.disabled = true
  loginButton.textContent = 'Entrando...'
  try {
    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-pass').value
    const options = await captchaOptions()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password, options })
    if (error) throw error
    recoveryMode = false
    applyAuthSession(data.session)
    document.getElementById('login-pass').value = ''
  } catch (error) {
    setFeedback(authFeedback, authErrorMessage(error), true, error.code?.startsWith('captcha') ? 'captcha' : 'auth')
  } finally {
    resetCaptcha()
    loginButton.disabled = false
    loginButton.textContent = 'Entrar'
  }
})

forgotPasswordButton.addEventListener('click', async () => {
  const emailInput = document.getElementById('login-email')
  if (!emailInput.reportValidity()) return
  forgotPasswordButton.disabled = true
  setFeedback(authFeedback)
  try {
    const redirectTo = new URL('admin.html?recovery=1', location.href).href
    const options = await captchaOptions()
    const { error } = await supabase.auth.resetPasswordForEmail(emailInput.value.trim(), { redirectTo, ...options })
    if (error) throw error
    setFeedback(authFeedback, 'Confira seu e-mail para recuperar a senha.')
  } catch (error) {
    setFeedback(authFeedback, authErrorMessage(error), true, error.code?.startsWith('captcha') ? 'captcha' : 'auth')
  } finally {
    resetCaptcha()
    forgotPasswordButton.disabled = false
  }
})

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (savePasswordButton.disabled) return
  const password = document.getElementById('new-password').value
  const confirmation = document.getElementById('confirm-password').value
  if (password.length < 8 || password !== confirmation) {
    setFeedback(resetFeedback, 'As senhas devem ser iguais e ter pelo menos 8 caracteres.', true)
    return
  }
  savePasswordButton.disabled = true
  savePasswordButton.textContent = 'Salvando...'
  try {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    recoveryMode = false
    resetForm.reset()
    history.replaceState(null, '', location.pathname)
    await handleAuthState()
  } catch (error) {
    setFeedback(resetFeedback, authErrorMessage(error), true)
  } finally {
    savePasswordButton.disabled = false
    savePasswordButton.textContent = 'Salvar senha'
  }
})

async function logout() {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) return alert(authErrorMessage(error))
  recoveryMode = false
  history.replaceState(null, '', location.pathname)
  applyAuthSession(null)
  resetCaptcha()
  setFeedback(authFeedback)
  setFeedback(resetFeedback)
}

document.getElementById('logout').addEventListener('click', logout)
document.getElementById('cancel-recovery').addEventListener('click', logout)

// --- Responsividade Admin ---
menuToggle.addEventListener('click', () => {
// ... (código existente sem mudanças) ...
    sidebar.classList.toggle('open');
});
document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
// ... (código existente sem mudanças) ...
  btn.addEventListener('click', ()=>{
    const v = btn.dataset.view
    setActiveNav(v)
    if(v === 'dashboard') {
        show('dashboard');
        loadDashboardStats(); // Recarrega estatísticas
    }
    if(v === 'produtos') show('produtos')
    if(v === 'novo'){
      resetProdutoForm();
      show('novo')
    }
    if(v === 'config'){ // NOVO
      loadConfig();
      show('config')
    }
    sidebar.classList.remove('open'); // Fecha o menu
  })
});
// --- CRUD produtos ---
async function loadProdutos(){
// ... (código existente sem mudanças) ...
  const { data, error } = await supabase.from('produtos').select('*')
    .in('category', ['vestidos', 'saias', 'blusas', 'conjuntos', 'acessorios', 'promocoes'])
    .order('id', { ascending: true })
  if(error) return alert(error.message)
  produtosList.innerHTML = ''
  countProd.textContent = data.filter(p => p.active).length

  const placeholderImg = 'https://placehold.co/600x400/fff4fb/0e0a0d?text=Virtuosa+CG';

  data.forEach(p => {
    const row = document.createElement('div')
    row.className = 'prod-row'
    const title = p.codigo ? `${p.codigo} — ${p.name}` : p.name
    row.innerHTML = `
      <img src="${escapeHtml(p.image_url || placeholderImg)}" alt="${escapeHtml(p.name)}">
      <div class="meta">
        <strong>${escapeHtml(title)}</strong>
        <div class="desc">${escapeHtml(p.description || '')}</div>
        <div class="price">R$ ${Number(p.price).toFixed(2).replace('.',',')}</div>
        <div class="stock-control">
          <label for="stock-${p.id}">Estoque</label>
          <input id="stock-${p.id}" class="stock-quantity" type="number" min="0" step="1" inputmode="numeric" value="${p.stock ?? ''}" data-original-stock="${p.stock ?? ''}" placeholder="Não informado">
          <button type="button" class="btn" data-action="stock" data-id="${p.id}">Salvar estoque</button>
        </div>
        <p class="stock-feedback" role="status" aria-live="polite" hidden></p>
      </div>
      <div class="prod-actions">
        <button class="btn" data-action="edit" data-id="${p.id}">Editar</button>
        <button class="btn" data-action="del" data-id="${p.id}">Excluir</button>
      </div>
    `
    produtosList.appendChild(row)
  })
}

// ATUALIZAÇÃO 2: Excluir imagem do bucket ao excluir produto
produtosList.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button')
  if(!btn) return
  const id = btn.dataset.id
  const action = btn.dataset.action

  if (action === 'stock') {
    const row = btn.closest('.prod-row')
    const input = row.querySelector('.stock-quantity')
    const feedback = row.querySelector('.stock-feedback')
    if (!input.reportValidity()) return
    const stock = input.value.trim() === '' ? null : Number(input.value)
    if (stock != null && (!Number.isInteger(stock) || stock < 0)) return
    btn.disabled = true
    setFeedback(feedback)
    try {
      let query = supabase.from('produtos').update({ stock }).eq('id', id)
      query = input.dataset.originalStock === '' ? query.is('stock', null) : query.eq('stock', Number(input.dataset.originalStock))
      const { data, error } = await query.select('id, stock').maybeSingle()
      if (error) throw error
      if (!data) {
        await loadProdutos()
        alert('O estoque foi alterado em outra sessão. Confira a quantidade atual antes de salvar.')
        return
      }
      input.dataset.originalStock = data.stock == null ? '' : String(data.stock)
      setFeedback(feedback, 'Estoque atualizado.')
    } catch (error) {
      setFeedback(feedback, 'Não foi possível salvar o estoque. Tente novamente.', true)
    } finally {
      btn.disabled = false
    }
    return
  }

  if(action === 'edit'){
    // ... (código de editar existente, sem mudanças) ...
    const { data } = await supabase.from('produtos').select('*').eq('id', id).single()
    if(!data) return alert('Produto não encontrado');

    resetProdutoForm();

    document.getElementById('produto-id').value = data.id
    document.getElementById('produto-nome').value = data.name
    document.getElementById('produto-desc').value = data.description
    document.getElementById('produto-preco').value = data.price
    stockInput.value = data.stock ?? ''
    editingStock = data.stock ?? null
    document.getElementById('produto-codigo').value = data.codigo || ''
    document.getElementById('produto-cat').value = data.category
    document.getElementById('produto-img').value = data.image_url || ''
    document.getElementById('produto-active').checked = data.active

    if(data.image_url) {
        preview.src = data.image_url;
        preview.hidden = false;
    }

    document.getElementById('form-title').textContent = 'Editar Produto'
    setActiveNav('novo')
    show('novo')
  }

  if(action === 'del'){
    // Lógica de exclusão atualizada
    if(!confirm('Excluir este produto? A IMAGEM associada (se houver) será EXCLUÍDA permanentemente.')) return;

    // 1. Buscar o produto para pegar a URL da imagem
    const { data: product, error: fetchError } = await supabase
      .from('produtos')
      .select('image_url')
      .eq('id', id)
      .single();

    if (fetchError) {
      return alert('Erro ao buscar produto: ' + fetchError.message);
    }

    // 2. Excluir o produto do banco de dados (acontece primeiro)
    const { error: dbError } = await supabase.from('produtos').delete().eq('id', id);
    if (dbError) {
      return alert('Erro ao excluir produto do banco: ' + dbError.message);
    }

    // 3. Se o produto tinha uma imagem, excluí-la do Storage
    if (product && product.image_url) {
      try {
        // Extrai o 'filePath' da URL completa
        // Ex: .../storage/v1/object/public/produtos/public/minha-imagem.png
        // Queremos: public/minha-imagem.png
        const urlParts = product.image_url.split(`/${BUCKET_NAME}/`);
        if (urlParts.length > 1) {
          const filePath = decodeURIComponent(urlParts[1]);
          console.log('Tentando excluir imagem:', filePath);

          const { error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]); // Passa um array de paths

          if (storageError) {
            throw storageError;
          }
          console.log('Imagem excluída com sucesso.');
        }
      } catch (err) {
        console.error('Erro ao excluir imagem do storage:', err.message);
        alert('Produto excluído do banco, mas falha ao excluir a imagem do storage. Verifique o console.');
      }
    }

    // 4. Recarregar a lista de produtos na UI
    loadProdutos();
  }
})

// --- Lógica de Upload ---
uploadInput.addEventListener('change', async (e) => {
// ... (código existente sem mudanças) ...
    const file = e.target.files[0];
    if (!file) return;

    preview.src = URL.createObjectURL(file);
    preview.hidden = false;

    isUploading = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Enviando...';
    uploadStatus.textContent = 'Enviando imagem...';

    const filePath = `public/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    try {
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        if (!urlData.publicUrl) throw new Error('Não foi possível obter a URL pública.');

        imgUrlInput.value = urlData.publicUrl;
        uploadStatus.textContent = 'Upload completo!';
        isUploading = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';

    } catch (error) {
        console.error('Erro no upload:', error);
        uploadStatus.textContent = `Erro: ${error.message}`;
        isUploading = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
    }
});


// salvar produto (create/update)
produtoForm.addEventListener('submit', async (e)=>{
// ... (código existente sem mudanças) ...
  e.preventDefault()

  if(isUploading) {
    alert('Aguarde o término do upload da imagem.');
    return;
  }

  const id = document.getElementById('produto-id').value
  if (!stockInput.reportValidity()) return
  const stock = stockInput.value.trim() === '' ? null : Number(stockInput.value)
  if (stock != null && (!Number.isInteger(stock) || stock < 0)) return
  const payload = {
    name: document.getElementById('produto-nome').value,
    description: document.getElementById('produto-desc').value,
    price: Number(document.getElementById('produto-preco').value),
    stock,
    codigo: Number(document.getElementById('produto-codigo').value),
    category: document.getElementById('produto-cat').value,
    image_url: document.getElementById('produto-img').value || null,
    active: document.getElementById('produto-active').checked
  }

  if(id){
    const stockChanged = stock !== editingStock
    if (!stockChanged) delete payload.stock
    let query = supabase.from('produtos').update(payload).eq('id', id)
    if (stockChanged) query = editingStock == null ? query.is('stock', null) : query.eq('stock', editingStock)
    const { data, error } = await query.select('id').maybeSingle()
    if(error) return alert(error.message)
    if (!data) return alert('O produto ou o estoque foi alterado. Abra o produto novamente antes de salvar.')
    alert('Produto atualizado');
  } else {
    const { error } = await supabase.from('produtos').insert(payload)
    if(error) return alert(error.message)
    alert('Produto adicionado');
  }

  resetProdutoForm();
  loadProdutos();
  setActiveNav('produtos');
  show('produtos');
});

// Botão Cancelar
document.getElementById('cancel-edit').addEventListener('click', () => {
// ... (código existente sem mudanças) ...
    resetProdutoForm();
    setActiveNav('produtos');
    show('produtos');
});


// inicialização
const captchaReady = initializeCaptcha()
handleAuthState()

// Fim do admin.js
