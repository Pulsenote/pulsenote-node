import { describe, expect, it } from 'vitest';
import type { Template } from '../src/index.js';
import { createTestClient } from './helpers.js';

const template: Template = {
  id: 't-1',
  name: 'Welcome',
  slug: 'welcome',
  locale: 'en',
  body: '<h1>Hi {{name}}</h1>',
  isActive: true,
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
};

describe('templates', () => {
  it('lists templates and passes the locale filter', async () => {
    const { client, requests } = createTestClient({ body: [template] });

    const result = await client.templates.list({ locale: 'pl' });

    expect(requests[0]?.url.pathname).toBe('/api/v1/templates');
    expect(requests[0]?.url.searchParams.get('locale')).toBe('pl');
    expect(result).toHaveLength(1);
  });

  it('retrieves a template by id', async () => {
    const { client, requests } = createTestClient({ body: template });

    await client.templates.retrieve('t-1');

    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe('/api/v1/templates/t-1');
  });

  it('lists the locale variants of a slug', async () => {
    const { client, requests } = createTestClient({ body: [template] });

    await client.templates.listLocales('welcome');

    expect(requests[0]?.url.pathname).toBe('/api/v1/templates/slug/welcome/locales');
  });

  it('creates a template', async () => {
    const { client, requests } = createTestClient({ status: 201, body: template });

    await client.templates.create({ name: 'Welcome', slug: 'welcome', body: '<h1>Hi</h1>', locale: 'en' });

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url.pathname).toBe('/api/v1/templates');
    expect(requests[0]?.body).toEqual({
      name: 'Welcome',
      slug: 'welcome',
      body: '<h1>Hi</h1>',
      locale: 'en',
    });
  });

  it('updates a template with PUT', async () => {
    const { client, requests } = createTestClient({ body: template });

    await client.templates.update('t-1', { name: 'Welcome', slug: 'welcome', body: 'x' });

    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.url.pathname).toBe('/api/v1/templates/t-1');
  });

  it('deletes a template', async () => {
    const { client, requests } = createTestClient({ body: { deleted: true } });

    const result = await client.templates.delete('t-1');

    expect(requests[0]?.method).toBe('DELETE');
    expect(result.deleted).toBe(true);
  });

  it('renders a template, defaulting data to an empty object', async () => {
    const { client, requests } = createTestClient({ body: { html: '<h1>Hi Greg</h1>' } });

    const rendered = await client.templates.render('t-1');

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url.pathname).toBe('/api/v1/templates/t-1/render');
    expect(requests[0]?.body).toEqual({ data: {} });
    expect(rendered.html).toBe('<h1>Hi Greg</h1>');
  });

  it('passes render data through', async () => {
    const { client, requests } = createTestClient({ body: { html: 'x' } });

    await client.templates.render('t-1', { data: { name: 'Greg' } });

    expect(requests[0]?.body).toEqual({ data: { name: 'Greg' } });
  });
});
