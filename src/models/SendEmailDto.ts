/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SendEmailDto = {
    /**
     * Recipient email address.
     */
    to: string;
    /**
     * Sender address on a verified domain. Defaults to the tenant default sender.
     */
    from?: string;
    /**
     * Email subject line. Ignored when a template supplies its own subject.
     */
    subject?: string;
    /**
     * Send using a stored template by ID.
     */
    templateId?: string;
    /**
     * Send using a stored template by slug.
     */
    templateSlug?: string;
    /**
     * Locale of the template variant to use (e.g. en, pl).
     */
    locale?: string;
    /**
     * Variables interpolated into the template.
     */
    templateData?: Record<string, any>;
    /**
     * Raw HTML body (when not using a template).
     */
    html?: string;
    /**
     * Plain-text body.
     */
    text?: string;
};

