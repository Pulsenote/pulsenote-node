/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DnsRecordDto } from './DnsRecordDto';
export type DomainDnsRecordsDto = {
    domain: string;
    status: DomainDnsRecordsDto.status;
    records: Array<DnsRecordDto>;
    spfVerified: boolean;
    dkimVerified: boolean;
    dmarcVerified: boolean;
};
export namespace DomainDnsRecordsDto {
    export enum status {
        PENDING = 'PENDING',
        VERIFYING = 'VERIFYING',
        VERIFIED = 'VERIFIED',
        FAILED = 'FAILED',
    }
}

