/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AddDomainDto = {
    /**
     * Domain to send from, e.g. mail.example.com.
     */
    domain: string;
    /**
     * Default from address for this domain. Defaults to noreply@<domain>.
     */
    fromEmail?: string;
    /**
     * Default display name for this domain.
     */
    fromName?: string;
};

