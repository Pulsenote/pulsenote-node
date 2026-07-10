/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SendEmailResponseDto = {
    /**
     * ID of the queued notification.
     */
    id: string;
    /**
     * Status at time of acceptance (always QUEUED).
     */
    status: SendEmailResponseDto.status;
    /**
     * Resolved sender address the email will be sent from.
     */
    from: string;
};
export namespace SendEmailResponseDto {
    /**
     * Status at time of acceptance (always QUEUED).
     */
    export enum status {
        PENDING = 'PENDING',
        QUEUED = 'QUEUED',
        SENT = 'SENT',
        DELIVERED = 'DELIVERED',
        FAILED = 'FAILED',
        BOUNCED = 'BOUNCED',
    }
}

