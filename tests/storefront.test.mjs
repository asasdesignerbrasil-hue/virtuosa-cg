import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cartItemFromProduct, composeWhatsAppMessage, escapeHtml, reconcileCart, stockQuantity } from '../src/js/order-utils.mjs';

const product = {
  id: 19, codigo: 1, name: 'Saia Alfaiataria Transpassada ', active: true,
  description: 'Elegância e modéstia.\nCor: Cinza\nTamanho: M a GG',
  category: 'saias', price: 129.99, stock: 4,
  image_url: 'https://example.invalid/saia.png'
};

test('existing products with unspecified stock remain available', () => {
  assert.equal(stockQuantity({ stock: null }), null);
  assert.equal(stockQuantity({}), null);
  const item = cartItemFromProduct(product, 2);
  const result = reconcileCart([item], [{ ...product, stock: null }]);
  assert.equal(result.items[0].qty, 2);
  assert.equal(result.changed, false);
});

test('insufficient stock is capped and zero stock removes the item', () => {
  const item = cartItemFromProduct(product, 3);
  const reduced = reconcileCart([item], [{ ...product, stock: 1 }]);
  assert.equal(reduced.items[0].qty, 1);
  assert.equal(reduced.changed, true);
  assert.deepEqual(reconcileCart([item], [{ ...product, stock: 0 }]), { items: [], changed: true });
});

test('deleted and inactive products cannot be included in an order', () => {
  const item = cartItemFromProduct(product);
  assert.equal(reconcileCart([item], []).items.length, 0);
  assert.equal(reconcileCart([item], [{ ...product, active: false }]).items.length, 0);
});

test('price changes require review and legacy carts get current product details', () => {
  const legacy = { id: '19', code: '1', name: product.name, price: 129.99, qty: 1 };
  const hydrated = reconcileCart([legacy], [product]);
  assert.equal(hydrated.changed, false);
  assert.equal(hydrated.items[0].description, product.description);
  assert.equal(hydrated.items[0].image_url, product.image_url);
  assert.equal(reconcileCart([legacy], [{ ...product, price: 139.99 }]).changed, true);
});

test('WhatsApp receives complete details for every item and customer', () => {
  const second = { ...product, id: 20, codigo: 2, name: 'Blusa', category: 'blusas', price: 50 };
  const text = composeWhatsAppMessage([cartItemFromProduct(product, 2), cartItemFromProduct(second, 1)], {
    name: 'Cliente de teste', phone: '83999990000', address: 'Endereço de teste'
  });
  for (const expected of [
    'Cliente de teste', '83999990000', 'Endereço de teste', 'Saia Alfaiataria Transpassada',
    'Código: 1', 'Cor: Cinza', 'Tamanho: M a GG', 'Categoria: Saias', 'Quantidade: 2',
    'Valor unitário: R$ 129,99', 'Subtotal: R$ 259,98', 'Foto: https://example.invalid/saia.png',
    'https://virtuosacg.store/#produto-19', 'Blusa', 'Código: 2', '*Total:* R$ 309,98'
  ]) assert.ok(text.includes(expected), expected);
});

test('single-product WhatsApp order has the same details without customer fields', () => {
  const text = composeWhatsAppMessage([cartItemFromProduct(product)]);
  assert.ok(text.includes(product.description));
  assert.ok(text.includes('Quantidade: 1'));
  assert.ok(text.includes('*Total:* R$ 129,99'));
  assert.ok(!text.includes('*Cliente:*'));
});

test('missing product codes use the product id and HTML is escaped', () => {
  assert.equal(cartItemFromProduct({ ...product, codigo: null }).code, '19');
  assert.equal(escapeHtml('<img alt="x">&'), '&lt;img alt=&quot;x&quot;&gt;&amp;');
});
