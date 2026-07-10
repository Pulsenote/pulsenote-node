const test = require('node:test');
const assert = require('node:assert');
const { Pulsenote, ApiError, NotificationsService } = require('../dist/main.js');

test('exposes the data-plane groups', () => {
  const c = new Pulsenote({ apiKey: 'pk_test_abc' });
  assert.ok(c.notifications instanceof NotificationsService);
  assert.equal(typeof c.templates, 'object');
  assert.equal(typeof c.domains, 'object');
});

test('wires the X-API-Key header', () => {
  const c = new Pulsenote({ apiKey: 'pk_test_abc' });
  assert.equal(c.request.config.HEADERS['X-API-Key'], 'pk_test_abc');
});

test('honours a custom baseUrl', () => {
  const c = new Pulsenote({ apiKey: 'k', baseUrl: 'https://example.test' });
  assert.equal(c.request.config.BASE, 'https://example.test');
});

test('requires an apiKey', () => {
  assert.throws(() => new Pulsenote({}), /apiKey.*required/);
});

test('exports ApiError', () => {
  assert.equal(typeof ApiError, 'function');
});
