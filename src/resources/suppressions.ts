import type { RequestOverrides, Transport } from '../http.js';
import type {
  AddSuppressionParams,
  AddedSuppression,
  Suppression,
  SuppressionRemoved,
} from '../types.js';
import { pathSegment } from './shared.js';

/**
 * Addresses this tenant will not send to.
 *
 * Entries appear here automatically when a provider reports a hard bounce or a
 * spam complaint — you do not have to manage those. {@link add} is for the ones
 * you decide yourself.
 *
 * Suppression is per {@link Suppression.stream}: blocking someone on
 * `broadcast` still lets a `transactional` password reset through, which is
 * usually what you want and occasionally a surprise.
 */
export class Suppressions {
  constructor(private readonly transport: Transport) {}

  /** Suppressed recipients, newest first. Capped at 500 by the API. */
  async list(options: RequestOverrides = {}): Promise<Suppression[]> {
    const { data } = await this.transport.request<Suppression[]>({
      method: 'GET',
      path: '/api/v1/suppressions',
      ...options,
    });
    return data;
  }

  /**
   * Suppress an address by hand.
   *
   * Idempotent per address and stream — adding one that is already suppressed
   * refreshes the existing entry rather than failing, so this is safe to retry
   * and safe to call from a loop you are not sure you have run before.
   */
  async add(
    params: AddSuppressionParams,
    options: RequestOverrides = {},
  ): Promise<AddedSuppression> {
    const { data } = await this.transport.request<AddedSuppression>({
      method: 'POST',
      path: '/api/v1/suppressions',
      body: params,
      idempotent: true,
      ...options,
    });
    return data;
  }

  /**
   * Remove a suppression, allowing sending to that address again.
   *
   * @throws {NotFoundError} when no suppression with that id belongs to this
   * tenant. Ids are tenant-scoped, so an id that never existed and one that
   * belongs to somebody else are indistinguishable from here — both 404.
   */
  async remove(id: string, options: RequestOverrides = {}): Promise<SuppressionRemoved> {
    const { data } = await this.transport.request<SuppressionRemoved>({
      method: 'DELETE',
      path: `/api/v1/suppressions/${pathSegment(id, 'id')}`,
      ...options,
    });
    return data;
  }
}
