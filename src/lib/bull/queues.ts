import { createQueue } from "./index.js";

export interface ReminderJobData {
  appointmentId: string;
}

export interface ReportJobData {
  reportId: string;
}

export interface MorningSummaryJobData {
  tenantId: string;
}

export interface BookingAlertJobData {
  appointmentId: string;
}

export type NotificationJobData = MorningSummaryJobData | BookingAlertJobData;

export const reminderQueue = createQueue<ReminderJobData>("reminder_queue");
export const reportQueue = createQueue<ReportJobData>("report_queue");
export const notificationQueue = createQueue<NotificationJobData>("notification_queue");
