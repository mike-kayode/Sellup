import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";

export const maintenanceSettingsSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().min(1).max(500),
    scheduledStart: z.string().max(40).default(""),
    scheduledEnd: z.string().max(40).default(""),
    allowAdminAccess: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [field, date] of [
      ["scheduledStart", value.scheduledStart],
      ["scheduledEnd", value.scheduledEnd],
    ] as const) {
      if (date && !Number.isFinite(Date.parse(date))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Must be a valid date and time",
        });
      }
    }
    if (
      value.scheduledStart &&
      value.scheduledEnd &&
      Date.parse(value.scheduledEnd) <= Date.parse(value.scheduledStart)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledEnd"],
        message: "Must be after the scheduled start",
      });
    }
  });

export type MaintenanceSettings = z.infer<typeof maintenanceSettingsSchema>;

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  enabled: false,
  message: "We are currently performing maintenance. Please check back soon.",
  scheduledStart: "",
  scheduledEnd: "",
  allowAdminAccess: true,
};

export async function readMaintenanceSettings(): Promise<MaintenanceSettings> {
  const [record] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, "maintenance"))
    .limit(1);
  if (!record) return DEFAULT_MAINTENANCE_SETTINGS;

  const parsed = maintenanceSettingsSchema.safeParse(record.value);
  if (!parsed.success) {
    throw new Error("Stored maintenance settings are invalid");
  }
  return parsed.data;
}

export function isMaintenanceActive(
  settings: MaintenanceSettings,
  now = Date.now()
) {
  if (!settings.enabled) return false;
  if (
    settings.scheduledStart &&
    now < Date.parse(settings.scheduledStart)
  ) {
    return false;
  }
  if (settings.scheduledEnd && now >= Date.parse(settings.scheduledEnd)) {
    return false;
  }
  return true;
}
