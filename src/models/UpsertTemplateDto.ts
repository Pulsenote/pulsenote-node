/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpsertTemplateDto = {
    /**
     * Human-readable template name.
     */
    name: string;
    /**
     * URL-safe identifier, unique per tenant + locale.
     */
    slug: string;
    /**
     * Subject line. Supports template variables.
     */
    subject?: string;
    /**
     * Template body (HTML). Supports variable interpolation.
     */
    body: string;
    /**
     * Locale of this variant (e.g. en, pl). Defaults to en.
     */
    locale?: string;
    /**
     * Arbitrary template metadata.
     */
    metadata?: Record<string, any>;
};

