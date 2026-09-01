import type { RequestOverrides, Transport } from '../http.js';
import type { AddDomainParams,
  UpdateDomainParams, DeletedResult, Domain, DomainDnsRecords } from '../types.js';
import { pathSegment } from './shared.js';

/**
 * Sender domains.
 *
 * You can only send from a domain in `VERIFIED` state, so the usual flow is
 * {@link add} → publish the returned DNS records → {@link verify}.
 */
export class Domains {
  constructor(private readonly transport: Transport) {}

  /** List every sender domain registered for the tenant. */
  async list(options: RequestOverrides = {}): Promise<Domain[]> {
    const { data } = await this.transport.request<Domain[]>({
      method: 'GET',
      path: '/api/v1/domains',
      ...options,
    });
    return data;
  }

  /**
   * Register a sender domain with SES.
   *
   * The response carries `dnsRecords` — publish all of them, then call
   * {@link verify}.
   *
   * @throws {ConflictError} when the domain is already registered.
   */
  async add(params: AddDomainParams, options: RequestOverrides = {}): Promise<Domain> {
    const { data } = await this.transport.request<Domain>({
      method: 'POST',
      path: '/api/v1/domains',
      body: params,
      ...options,
    });
    return data;
  }

  /** The DNS records to publish, plus per-record verification state. */
  /**
   * Change the sender identity of a domain you already added.
   *
   * Useful when one account sends under several brands: give each domain its
   * own {@link UpdateDomainParams.fromName} and recipients see the right one
   * per domain instead of the account name everywhere.
   *
   * The domain name itself is not editable — that is a different provider
   * identity with different DNS records, so it is an {@link add} plus a
   * {@link delete}.
   *
   * @throws {BadRequestError} when `fromEmail` is not on this domain. The
   * provider only signs mail for the identity it verified.
   */
  async update(
    id: string,
    params: UpdateDomainParams,
    options: RequestOverrides = {},
  ): Promise<Domain> {
    const { data } = await this.transport.request<Domain>({
      method: 'PATCH',
      path: `/api/v1/domains/${pathSegment(id, 'id')}`,
      body: params,
      idempotent: true,
      ...options,
    });
    return data;
  }

  async dnsRecords(id: string, options: RequestOverrides = {}): Promise<DomainDnsRecords> {
    const { data } = await this.transport.request<DomainDnsRecords>({
      method: 'GET',
      path: `/api/v1/domains/${pathSegment(id, 'id')}/dns-records`,
      ...options,
    });
    return data;
  }

  /** The same records as a ready-to-import BIND zone file. */
  async zoneFile(id: string, options: RequestOverrides = {}): Promise<string> {
    const { data } = await this.transport.request<string>({
      method: 'GET',
      path: `/api/v1/domains/${pathSegment(id, 'id')}/zone-file`,
      responseType: 'text',
      ...options,
    });
    return data;
  }

  /**
   * Re-check SES and DNS state and update the domain's status.
   *
   * Safe to call repeatedly, so it is retried like a `GET` despite being a `POST`.
   */
  async verify(id: string, options: RequestOverrides = {}): Promise<Domain> {
    const { data } = await this.transport.request<Domain>({
      method: 'POST',
      path: `/api/v1/domains/${pathSegment(id, 'id')}/verify`,
      idempotent: true,
      ...options,
    });
    return data;
  }

  /** Remove the domain from Pulsenote and delete its SES identity. */
  async delete(id: string, options: RequestOverrides = {}): Promise<DeletedResult> {
    const { data } = await this.transport.request<DeletedResult>({
      method: 'DELETE',
      path: `/api/v1/domains/${pathSegment(id, 'id')}`,
      ...options,
    });
    return data;
  }
}
