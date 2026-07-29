import type { RequestOverrides, Transport } from '../http.js';
import type {
  CreateTemplateParams,
  DeletedResult,
  ListTemplatesParams,
  RenderTemplateParams,
  RenderedTemplate,
  Template,
  UpdateTemplateParams,
} from '../types.js';
import { pathSegment } from './shared.js';

/** Reusable email templates with variable interpolation, one variant per locale. */
export class Templates {
  constructor(private readonly transport: Transport) {}

  /** List templates, optionally narrowed to a single locale. */
  async list(params: ListTemplatesParams = {}, options: RequestOverrides = {}): Promise<Template[]> {
    const { data } = await this.transport.request<Template[]>({
      method: 'GET',
      path: '/api/v1/templates',
      query: { locale: params.locale },
      ...options,
    });
    return data;
  }

  /** Fetch a single template by ID. */
  async retrieve(id: string, options: RequestOverrides = {}): Promise<Template> {
    const { data } = await this.transport.request<Template>({
      method: 'GET',
      path: `/api/v1/templates/${pathSegment(id, 'id')}`,
      ...options,
    });
    return data;
  }

  /** List every locale variant that shares a slug. */
  async listLocales(slug: string, options: RequestOverrides = {}): Promise<Template[]> {
    const { data } = await this.transport.request<Template[]>({
      method: 'GET',
      path: `/api/v1/templates/slug/${pathSegment(slug, 'slug')}/locales`,
      ...options,
    });
    return data;
  }

  /**
   * Create a template. `slug` must be unique per tenant and locale, so the same
   * slug with a different `locale` creates a translation rather than a clash.
   */
  async create(params: CreateTemplateParams, options: RequestOverrides = {}): Promise<Template> {
    const { data } = await this.transport.request<Template>({
      method: 'POST',
      path: '/api/v1/templates',
      body: params,
      ...options,
    });
    return data;
  }

  /**
   * Replace a template.
   *
   * The API assigns the whole payload onto the record, so send the full
   * template — omitted fields keep their previous value rather than being
   * cleared, but `name`, `slug` and `body` are always required.
   */
  async update(
    id: string,
    params: UpdateTemplateParams,
    options: RequestOverrides = {},
  ): Promise<Template> {
    const { data } = await this.transport.request<Template>({
      method: 'PUT',
      path: `/api/v1/templates/${pathSegment(id, 'id')}`,
      body: params,
      ...options,
    });
    return data;
  }

  /** Delete a template. */
  async delete(id: string, options: RequestOverrides = {}): Promise<DeletedResult> {
    const { data } = await this.transport.request<DeletedResult>({
      method: 'DELETE',
      path: `/api/v1/templates/${pathSegment(id, 'id')}`,
      ...options,
    });
    return data;
  }

  /**
   * Render a template with sample data, without sending anything.
   *
   * Read-only, so it is retried like a `GET` despite being a `POST`.
   */
  async render(
    id: string,
    params: RenderTemplateParams = {},
    options: RequestOverrides = {},
  ): Promise<RenderedTemplate> {
    const { data } = await this.transport.request<RenderedTemplate>({
      method: 'POST',
      path: `/api/v1/templates/${pathSegment(id, 'id')}/render`,
      body: { data: params.data ?? {} },
      idempotent: true,
      ...options,
    });
    return data;
  }
}
