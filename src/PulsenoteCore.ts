/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { DomainsService } from './services/DomainsService';
import { NotificationsService } from './services/NotificationsService';
import { TemplatesService } from './services/TemplatesService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class PulsenoteCore {
    public readonly domains: DomainsService;
    public readonly notifications: NotificationsService;
    public readonly templates: TemplatesService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'https://pulsenote-api.sysgp.eu',
            VERSION: config?.VERSION ?? '1.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.domains = new DomainsService(this.request);
        this.notifications = new NotificationsService(this.request);
        this.templates = new TemplatesService(this.request);
    }
}

