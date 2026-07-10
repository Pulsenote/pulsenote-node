/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationDto } from '../models/NotificationDto';
import type { NotificationListDto } from '../models/NotificationListDto';
import type { NotificationStatsDto } from '../models/NotificationStatsDto';
import type { SendEmailDto } from '../models/SendEmailDto';
import type { SendEmailResponseDto } from '../models/SendEmailResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class NotificationsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Send an email notification
     * Queues an email for delivery. Returns immediately with the notification ID.
     * @param requestBody
     * @returns SendEmailResponseDto Notification queued successfully
     * @throws ApiError
     */
    public sendNotification(
        requestBody: SendEmailDto,
    ): CancelablePromise<SendEmailResponseDto> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/notifications/send',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Invalid API key`,
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get notification statistics
     * Returns total counts by status, daily breakdown for last 30 days, and this month total.
     * @returns NotificationStatsDto Aggregate statistics
     * @throws ApiError
     */
    public getNotificationStats(): CancelablePromise<NotificationStatsDto> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/notifications/stats',
        });
    }
    /**
     * List notifications
     * Paginated list of sent notifications for this tenant.
     * @param page
     * @param limit
     * @param status
     * @returns NotificationListDto Paginated notifications
     * @throws ApiError
     */
    public listNotifications(
        page?: number,
        limit?: number,
        status?: 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED',
    ): CancelablePromise<NotificationListDto> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/notifications',
            query: {
                'page': page,
                'limit': limit,
                'status': status,
            },
        });
    }
    /**
     * Get notification by ID
     * Returns full details of a single notification including delivery status.
     * @param id
     * @returns NotificationDto Notification detail
     * @throws ApiError
     */
    public getNotification(
        id: string,
    ): CancelablePromise<NotificationDto> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/notifications/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Notification not found`,
            },
        });
    }
}
