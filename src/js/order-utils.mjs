const categories = {
  vestidos: 'Vestidos', saias: 'Saias', blusas: 'Blusas', conjuntos: 'Conjuntos',
  acessorios: 'Acessórios', promocoes: 'Promoções'
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function stockQuantity(product) {
  if (product.stock == null || product.stock === '') return null;
  const quantity = Number(product.stock);
  return Number.isInteger(quantity) && quantity >= 0 ? quantity : 0;
}

export function cartItemFromProduct(product, qty = 1) {
  return {
    id: String(product.id), code: String(product.codigo ?? product.id),
    name: String(product.name || '').trim(), description: product.description || '',
    category: product.category, image_url: product.image_url || '',
    price: Number(product.price), qty, stock: stockQuantity(product),
    active: product.active !== false
  };
}

export function reconcileCart(items, products) {
  const byId = new Map(products.map(product => [String(product.id), product]));
  let changed = false;
  const reconciled = [];
  for (const item of items) {
    const product = byId.get(String(item.id));
    if (!product || product.active === false || !categories[product.category]) {
      changed = true;
      continue;
    }
    const stock = stockQuantity(product);
    const requested = Number(item.qty);
    const quantity = Number.isInteger(requested) && requested > 0 ? requested : 1;
    const qty = stock == null ? quantity : Math.min(quantity, stock);
    if (qty !== requested || Math.round(Number(item.price) * 100) !== Math.round(Number(product.price) * 100)) changed = true;
    if (qty > 0) reconciled.push(cartItemFromProduct(product, qty));
    else changed = true;
  }
  return { items: reconciled, changed };
}

export function composeWhatsAppMessage(items, customer = {}, siteUrl = 'https://virtuosacg.store/') {
  const money = value => 'R$ ' + Number(value).toFixed(2).replace('.', ',');
  const lines = ['*PEDIDO DE COMPRA - VIRTUOSA CG*'];
  if (customer.name) lines.push(`*Cliente:* ${customer.name}`);
  if (customer.phone) lines.push(`*WhatsApp:* ${customer.phone}`);
  if (customer.address) lines.push(`*Endereço:* ${customer.address}`);
  lines.push('', '*Produtos:*');
  items.forEach((item, index) => {
    lines.push('', `*${index + 1}. ${item.name}*`, `Código: ${item.code}`,
      `Descrição: ${item.description || 'Sem descrição.'}`,
      `Categoria: ${categories[item.category] || item.category}`,
      `Quantidade: ${item.qty}`, `Valor unitário: ${money(item.price)}`,
      `Subtotal: ${money(item.price * item.qty)}`);
    if (item.image_url) lines.push(`Foto: ${item.image_url}`);
    lines.push(`Produto: ${siteUrl}#produto-${encodeURIComponent(item.id)}`);
  });
  lines.push('', `*Total:* ${money(items.reduce((total, item) => total + item.price * item.qty, 0))}`,
    `*Loja:* ${siteUrl}`);
  return lines.join('\n');
}
