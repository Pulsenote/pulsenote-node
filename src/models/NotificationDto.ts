/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type NotificationDto = {
    id: string;
    /**
     * Recipient email address.
     */
    recipient: string;
    /**
     * Email subject line.
     */
    subject?: string;
    /**
     * ID of the template used, if any.
     */
    templateId?: string;
    /**
     * Current delivery status.
     */
    status: NotificationDto.status;
    /**
     * Upstream provider (SES) message ID.
     */
    providerMessageId?: string;
    /**
     * When the email was handed to the provider.
     */
    sentAt?: string;
    /**
     * When delivery was confirmed.
     */
    deliveredAt?: string;
    /**
     * When the send failed.
     */
    failedAt?: string;
    /**
     * Reason for failure, if failed or bounced.
     */
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
};
export namespace NotificationDto {
    /**
     * Current delivery status.
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

