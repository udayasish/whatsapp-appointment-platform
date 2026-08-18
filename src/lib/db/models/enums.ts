import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "patient",
  "doctor",
  "receptionist",
]);

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "booked",
  "completed",
  "cancelled",
  "noshow",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

// The patient booking-bot ladder (Phase 3), in order.
export const conversationStepEnum = pgEnum("conversation_step", [
  "idle",
  "select_language",
  "select_action",
  "select_doctor",
  "select_date",
  "select_slot",
  "enter_name",
  "enter_age",
  "enter_complaint",
  "confirm_booking",
  "completed",
  "cancelled",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "sent",
  "failed",
]);

export const slotStatusEnum = pgEnum("slot_status", [
  "available",
  "booked",
  "blocked",
  "cancelled",
]);

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "inactive",
  "suspended",
]);

export const blockedDateReasonEnum = pgEnum("blocked_date_reason", [
  "leave",
  "holiday",
  "emergency",
  "other",
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type DayOfWeek = (typeof dayOfWeekEnum.enumValues)[number];
export type AppointmentStatus = (typeof appointmentStatusEnum.enumValues)[number];
export type MessageDirection = (typeof messageDirectionEnum.enumValues)[number];
export type ConversationStep = (typeof conversationStepEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type SlotStatus = (typeof slotStatusEnum.enumValues)[number];
export type TenantStatus = (typeof tenantStatusEnum.enumValues)[number];
export type BlockedDateReason = (typeof blockedDateReasonEnum.enumValues)[number];
