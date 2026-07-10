/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type NotificationStatsDto = {
    /**
     * Total notifications across all statuses.
     */
    total: number;
    /**
     * Count keyed by status.
     */
    counts: Record<string, number>;
    /**
     * Total notifications sent this calendar month.
     */
    thisMonth: number;
    /**
     * Per-day counts by status for the last 30 days.
     */
    daily: Array<Record<string, any>>;
};

