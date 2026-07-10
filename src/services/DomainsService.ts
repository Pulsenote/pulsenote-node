/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddDomainDto } from '../models/AddDomainDto';
import type { DomainDnsRecordsDto } from '../models/DomainDnsRecordsDto';
import type { DomainDto } from '../models/DomainDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DomainsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List sender domains
     * @returns DomainDto Domains
     * @throws ApiError
     */
    public listDomains(): CancelablePromise<Array<DomainDto>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/domains',
        });
    }
    /**
     * Add a sender domain
     * Registers the domain with SES and returns the DNS records to publish.
     * @param requestBody
     * @returns DomainDto Domain registered
     * @throws ApiError
     */
    public addDomain(
        requestBody: AddDomainDto,
    ): CancelablePromise<DomainDto> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/domains',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                409: `Domain already registered`,
            },
        });
    }
    /**
     * Get DNS records
     * Returns the DNS records to publish and per-record verification state.
     * @param id
     * @returns DomainDnsRecordsDto DNS records
     * @throws ApiError
     */
    public getDomainDnsRecords(
        id: string,
    ): CancelablePromise<DomainDnsRecordsDto> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/domains/{id}/dns-records',
            path: {
                'id': id,
            },
            errors: {
                404: `Domain not found`,
            },
        });
    }
    /**
     * Download BIND zone file
     * Returns a ready-to-import BIND zone file with all required DNS records.
     * @param id
     * @returns any Zone file (text/plain attachment)
     * @throws ApiError
     */
    public getDomainZoneFile(
        id: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/domains/{id}/zone-file',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Trigger domain verification
     * Re-checks SES + DNS state and updates the domain status.
     * @param id
     * @returns DomainDto Verification result
     * @throws ApiError
     */
    public verifyDomain(
        id: string,
    ): CancelablePromise<DomainDto> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/domains/{id}/verify',
            path: {
                'id': id,
            },
            errors: {
                404: `Domain not found`,
            },
        });
    }
    /**
     * Delete a sender domain
     * Removes the domain from SES and Pulsenote.
     * @param id
     * @returns any Deleted
     * @throws ApiError
     */
    public deleteDomain(
        id: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/domains/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Domain not found`,
            },
        });
    }
}
