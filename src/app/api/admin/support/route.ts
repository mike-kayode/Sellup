import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, desc, eq, inArray, min, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminMemberships,
  auditLogs,
  supportTicketMessages,
  supportTickets,
  stores,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import { EmailTemplate, sendEmail } from "@/lib/email";

const SLA_TARGET_HOURS = {
  urgent: 1,
  high: 4,
  normal: 24,
  low: 72,
} as const;

function getTicketSla(
  ticket: { id: string; createdAt: Date; priority: string },
  firstResponseAt: Date | null
) {
  const targetHours = SLA_TARGET_HOURS[ticket.priority as keyof typeof SLA_TARGET_HOURS] ?? 24;
  const dueAt = new Date(ticket.createdAt.getTime() + targetHours * 60 * 60 * 1000);
  const status = firstResponseAt
    ? firstResponseAt <= dueAt ? "met" : "breached"
    : Date.now() > dueAt.getTime() ? "overdue" : "on_track";
  return { targetHours, dueAt, firstResponseAt, status };
}

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(10_000),
  isInternal: z.boolean().default(false),
}).strict();

const updateSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(1).max(500),
}).strict().refine(
  ({ ticketId: _id, reason: _reason, ...changes }) => Object.keys(changes).length > 0,
  "At least one ticket field must be changed"
);

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const ticketId = url.searchParams.get("ticketId");
    if (ticketId) {
      if (!z.string().uuid().safeParse(ticketId).success) {
        return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
      }
      const [ticket] = await db.select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        message: supportTickets.message,
        status: supportTickets.status,
        priority: supportTickets.priority,
        assignedTo: supportTickets.assignedTo,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        storeId: supportTickets.storeId,
        storeName: stores.storeName,
        userId: supportTickets.userId,
        userName: users.fullName,
        userEmail: users.email,
      }).from(supportTickets)
        .innerJoin(stores, eq(stores.id, supportTickets.storeId))
        .innerJoin(users, eq(users.id, supportTickets.userId))
        .where(eq(supportTickets.id, ticketId))
        .limit(1);
      if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      const messages = await db.select({
        id: supportTicketMessages.id,
        body: supportTicketMessages.body,
        isInternal: supportTicketMessages.isInternal,
        createdAt: supportTicketMessages.createdAt,
        actorName: users.fullName,
      }).from(supportTicketMessages)
        .leftJoin(users, eq(users.id, supportTicketMessages.actorId))
        .where(eq(supportTicketMessages.ticketId, ticketId))
        .orderBy(asc(supportTicketMessages.createdAt), asc(supportTicketMessages.id));
      const [response] = await db.select({
        firstResponseAt: min(supportTicketMessages.createdAt),
      }).from(supportTicketMessages)
        .innerJoin(adminMemberships, eq(adminMemberships.userId, supportTicketMessages.actorId))
        .where(and(
          eq(supportTicketMessages.ticketId, ticketId),
          eq(supportTicketMessages.isInternal, false)
        ));
      return NextResponse.json({
        ticket: { ...ticket, sla: getTicketSla(ticket, response?.firstResponseAt ?? null) },
        messages,
      });
    }

    const status = url.searchParams.get("status") || "all";
    const priority = url.searchParams.get("priority") || "all";
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const filters = [];
    if (status !== "all") filters.push(eq(supportTickets.status, status));
    if (priority !== "all") filters.push(eq(supportTickets.priority, priority));
    if (search) filters.push(sql`lower(${supportTickets.subject}) LIKE ${`${search.toLowerCase()}%`}`);
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, rows, assignees] = await Promise.all([
      db.select({ total: count() }).from(supportTickets).where(where),
      db.select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        assignedTo: supportTickets.assignedTo,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        storeId: supportTickets.storeId,
        storeName: stores.storeName,
        userId: supportTickets.userId,
        userName: users.fullName,
        userEmail: users.email,
      }).from(supportTickets)
        .innerJoin(stores, eq(stores.id, supportTickets.storeId))
        .innerJoin(users, eq(users.id, supportTickets.userId))
        .where(where)
        .orderBy(desc(supportTickets.createdAt), desc(supportTickets.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ id: users.id, fullName: users.fullName, email: users.email })
        .from(adminMemberships)
        .innerJoin(users, eq(users.id, adminMemberships.userId))
        .where(and(eq(adminMemberships.isActive, true), eq(users.isActive, true)))
        .orderBy(users.fullName)
        .limit(100),
    ]);

    const responseTimes = rows.length
      ? await db.select({
        ticketId: supportTicketMessages.ticketId,
        firstResponseAt: min(supportTicketMessages.createdAt),
      }).from(supportTicketMessages)
        .innerJoin(adminMemberships, eq(adminMemberships.userId, supportTicketMessages.actorId))
        .where(and(
          inArray(supportTicketMessages.ticketId, rows.map((row) => row.id)),
          eq(supportTicketMessages.isInternal, false)
        ))
        .groupBy(supportTicketMessages.ticketId)
      : [];
    const responseTimeByTicket = new Map(responseTimes.map((row) => [row.ticketId, row.firstResponseAt]));
    return NextResponse.json({
      tickets: rows.map((ticket) => ({
        ...ticket,
        sla: getTicketSla(ticket, responseTimeByTicket.get(ticket.id) ?? null),
      })),
      assignees,
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin support list error:", error);
    return NextResponse.json({ error: "Failed to load support tickets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticket reply", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx.select({
        id: supportTickets.id,
        storeId: supportTickets.storeId,
        subject: supportTickets.subject,
        userName: users.fullName,
        userEmail: users.email,
      }).from(supportTickets)
        .innerJoin(users, eq(users.id, supportTickets.userId))
        .where(eq(supportTickets.id, parsed.data.ticketId)).limit(1);
      if (!ticket) return null;
      const [message] = await tx.insert(supportTicketMessages).values({
        ticketId: ticket.id,
        actorId: user.id,
        body: parsed.data.body,
        isInternal: parsed.data.isInternal,
      }).returning();
      await tx.update(supportTickets).set({ updatedAt: new Date() })
        .where(eq(supportTickets.id, ticket.id));
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: parsed.data.isInternal ? "support.internal_note_added" : "support.reply_added",
        resourceType: "support_ticket",
        resourceId: ticket.id,
        storeId: ticket.storeId,
        newValue: { messageId: message.id, isInternal: message.isInternal },
        ipAddress,
        userAgent,
      });
      return { message, ticket };
    });
    if (!result) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const emailSent = !parsed.data.isInternal && await sendEmail({
      to: result.ticket.userEmail,
      subject: `Support reply: ${result.ticket.subject}`,
      template: EmailTemplate.SUPPORT_REPLY,
      data: {
        customerName: result.ticket.userName,
        subject: result.ticket.subject,
        reply: result.message.body,
      },
    });
    return NextResponse.json({ message: result.message, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Admin support reply error:", error);
    return NextResponse.json({ error: "Failed to add ticket reply" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticket update", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(supportTickets)
        .where(eq(supportTickets.id, parsed.data.ticketId)).limit(1);
      if (!existing) return null;
      if (parsed.data.assignedTo) {
        const [assignee] = await tx.select({ userId: adminMemberships.userId })
          .from(adminMemberships)
          .innerJoin(users, eq(users.id, adminMemberships.userId))
          .where(and(
            eq(adminMemberships.userId, parsed.data.assignedTo),
            eq(adminMemberships.isActive, true),
            eq(users.isActive, true)
          )).limit(1);
        if (!assignee) throw new Error("Assignee is not an active staff member");
      }
      const [saved] = await tx.update(supportTickets)
        .set({
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
          ...(parsed.data.assignedTo !== undefined ? { assignedTo: parsed.data.assignedTo } : {}),
          ...(parsed.data.status === "resolved" || parsed.data.status === "closed" ? { resolvedAt: new Date() } : {}),
          ...(parsed.data.status === "open" || parsed.data.status === "in_progress" ? { resolvedAt: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, parsed.data.ticketId))
        .returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "support.ticket_updated",
        resourceType: "support_ticket",
        resourceId: existing.id,
        storeId: existing.storeId,
        previousValue: existing,
        newValue: { ...saved, reason: parsed.data.reason },
        ipAddress,
        userAgent,
      });
      return saved;
    });
    if (!updated) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    return NextResponse.json({ ticket: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Assignee is not an active staff member") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Admin support update error:", error);
    return NextResponse.json({ error: "Failed to update support ticket" }, { status: 500 });
  }
}
