/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DnsRecordDto = {
    type: DnsRecordDto.type;
    /**
     * Record name/host.
     */
    name: string;
    /**
     * Record value.
     */
    value: string;
    /**
     * What this record is for.
     */
    purpose: string;
    /**
     * Priority (MX records only).
     */
    priority?: number;
};
export namespace DnsRecordDto {
    export enum type {
        CNAME = 'CNAME',
        MX = 'MX',
        TXT = 'TXT',
    }
}

