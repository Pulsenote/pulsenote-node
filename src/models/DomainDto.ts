/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DnsRecordDto } from './DnsRecordDto';
export type DomainDto = {
    id: string;
    domain: string;
    /**
     * Verification status.
     */
    status: DomainDto.status;
    /**
     * Whether the SPF (MAIL FROM) record is verified.
     */
    spfVerified: boolean;
    /**
     * Whether DKIM signing is verified.
     */
    dkimVerified: boolean;
    /**
     * Whether a DMARC policy is present.
     */
    dmarcVerified: boolean;
    /**
     * Default from address for this domain.
     */
    fromEmail?: string;
    /**
     * Default display name.
     */
    fromName?: string;
    /**
     * Whether this is the tenant default sender domain.
     */
    isDefault: boolean;
    verifiedAt?: string;
    createdAt: string;
    updatedAt: string;
    /**
     * DNS records to publish (returned on add/verify).
     */
    dnsRecords?: Array<DnsRecordDto>;
};
export namespace DomainDto {
    /**
     * Verification status.
     */
    export enum status {
        PENDING = 'PENDING',
        VERIFYING = 'VERIFYING',
        VERIFIED = 'VERIFIED',
        FAILED = 'FAILED',
    }
}

