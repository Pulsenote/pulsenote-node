/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RenderedTemplateDto } from '../models/RenderedTemplateDto';
import type { RenderTemplateDto } from '../models/RenderTemplateDto';
import type { TemplateDto } from '../models/TemplateDto';
import type { UpsertTemplateDto } from '../models/UpsertTemplateDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TemplatesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List templates
     * Returns all templates. Optionally filter by locale.
     * @param locale Filter by locale (e.g. en, pl)
     * @returns TemplateDto Templates
     * @throws ApiError
     */
    public listTemplates(
        locale?: string,
    ): CancelablePromise<Array<TemplateDto>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/templates',
            query: {
                'locale': locale,
            },
        });
    }
    /**
     * Create template
     * Create a new template. Set locale to create a translated version.
     * @param requestBody
     * @returns TemplateDto Created
     * @throws ApiError
     */
    public createTemplate(
        requestBody: UpsertTemplateDto,
    ): CancelablePromise<TemplateDto> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/templates',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List all locale variants
     * Returns all locale versions of a template by slug.
     * @param slug
     * @returns TemplateDto Locale variants
     * @throws ApiError
     */
    public listTemplateLocales(
        slug: string,
    ): CancelablePromise<Array<TemplateDto>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/templates/slug/{slug}/locales',
            path: {
                'slug': slug,
            },
        });
    }
    /**
     * Get template by ID
     * @param id
     * @returns TemplateDto Template
     * @throws ApiError
     */
    public getTemplate(
        id: string,
    ): CancelablePromise<TemplateDto> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/templates/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Template not found`,
            },
        });
    }
    /**
     * Update template
     * @param id
     * @param requestBody
     * @returns TemplateDto Updated
     * @throws ApiError
     */
    public updateTemplate(
        id: string,
        requestBody: UpsertTemplateDto,
    ): CancelablePromise<TemplateDto> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/templates/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete template
     * @param id
     * @returns any Deleted
     * @throws ApiError
     */
    public deleteTemplate(
        id: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/templates/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Preview template
     * Render template with sample data for preview.
     * @param id
     * @param requestBody
     * @returns RenderedTemplateDto Rendered output
     * @throws ApiError
     */
    public renderTemplate(
        id: string,
        requestBody: RenderTemplateDto,
    ): CancelablePromise<RenderedTemplateDto> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/templates/{id}/render',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
