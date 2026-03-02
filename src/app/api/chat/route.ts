import { NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";
import { nango, requireGoogleIntegrationId } from "@/lib/nango";
import {
  createCalendarEvent,
  sendGmailMessage,
} from "@/lib/google";
import { requireUser } from "@/lib/supabase/server";
import { getRequestId, logError, logWarn } from "@/lib/logging";
import { getMistralApiKey } from "@/lib/mistral";
import { extractAccountMetadata } from "@/lib/connected-account";

type ChatMessage = { role: string; content: string };

type PlannedAction =
  | {
      action: "send_email";
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    }
  | {
      action: "create_event";
      summary: string;
      description?: string;
      start: string;
      end: string;
      timeZone?: string;
    }
  | { action: "clarify"; question: string }
  | { action: "respond"; message: string };

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (chunk && typeof chunk === "object" && "text" in chunk) {
          const text = (chunk as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function parsePlannedAction(text: string): PlannedAction | null {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as PlannedAction;
  } catch {
    return null;
  }
}

function toTextResponse(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const requestId = getRequestId();
  const mistralApiKey = getMistralApiKey();
  if (!mistralApiKey) {
    return NextResponse.json(
      { error: "Missing MISTRAL_API (or MISTRAL_API_KEY)" },
      { status: 500 },
    );
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  const { supabase, user } = await requireUser();
  if (!user) {
    logWarn("chat.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("nango_connection_id, created_at")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1);

  const integrationId = requireGoogleIntegrationId();
  if (!integrationId) {
    logError("chat.missing_integration", { requestId, userId: user.id });
    return NextResponse.json({ error: "Missing GMAIL_INTEGRATION_ID" }, { status: 500 });
  }

  let connectionId = accounts?.[0]?.nango_connection_id;
  if (!connectionId) {
    try {
      const listed = await nango.listConnections({
        userId: user.id,
        integrationId,
      });
      const fallback = listed.connections?.[0];
      if (fallback?.connection_id) {
        connectionId = fallback.connection_id;
        let metadata = { email: null as string | null, name: null as string | null, scopes: null as string[] | null };
        try {
          const full = await nango.getConnection(integrationId, connectionId);
          metadata = extractAccountMetadata(full);
        } catch {
          // Best-effort metadata enrichment.
        }

        await supabase.from("connected_accounts").upsert(
          {
            user_id: user.id,
            provider: "google",
            nango_connection_id: connectionId,
            account_email: metadata.email,
            account_display_name: metadata.name,
            scopes: metadata.scopes,
            status: "connected",
          },
          { onConflict: "user_id,provider,nango_connection_id" },
        );
      }
    } catch (error) {
      logWarn("chat.connection_sync_failed", { requestId, userId: user.id, error });
    }
  }

  if (!connectionId) {
    logWarn("chat.no_connection", { requestId, userId: user.id });
    return NextResponse.json(
      {
        error:
          "Google is not connected. Click 'Connect with Google' on the AI page, complete OAuth, then retry.",
      },
      { status: 401 },
    );
  }

  const mistral = new Mistral({ apiKey: mistralApiKey });

  const result = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "system",
        content:
          "You are an action assistant for Gmail and Google Calendar. " +
          "When the user asks to send an email, create subject/body in natural language and fill details accordingly. " +
          "When the user asks to add an exam to calendar, create ISO datetime values for start/end. " +
          "Return ONLY valid JSON with one of these formats: " +
          '{"action":"send_email","to":"...","subject":"...","body":"...","cc":"...","bcc":"..."} or ' +
          '{"action":"create_event","summary":"...","description":"...","start":"...","end":"...","timeZone":"..."} or ' +
          '{"action":"clarify","question":"..."} or ' +
          '{"action":"respond","message":"..."}.',
      },
      {
        role: "user",
        content:
          [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "",
      },
    ],
    temperature: 0.2,
  });

  const modelText = extractTextContent(result.choices?.[0]?.message?.content);
  const plan = parsePlannedAction(modelText);

  if (!plan) {
    return toTextResponse(
      "I could not understand that request. Try: 'Send email to name@example.com subject ... body ...'",
    );
  }

  if (plan.action === "clarify") {
    return toTextResponse(plan.question || "Please share missing details.");
  }

  if (plan.action === "respond") {
    return toTextResponse(plan.message || "Done.");
  }

  if (plan.action === "send_email") {
    if (!plan.to || !plan.subject || !plan.body) {
      return toTextResponse("Please provide recipient, subject, and body for the email.");
    }

    try {
      await sendGmailMessage(integrationId, connectionId, {
        to: plan.to,
        subject: plan.subject,
        body: plan.body,
        cc: plan.cc,
        bcc: plan.bcc,
      });
      return toTextResponse(`Email sent to ${plan.to} with subject \"${plan.subject}\".`);
    } catch (error) {
      logError("chat.send_email_failed", { requestId, userId: user.id, error });
      return toTextResponse("Failed to send email. Check Gmail integration scopes and try again.", 500);
    }
  }

  if (plan.action === "create_event") {
    if (!plan.summary || !plan.start || !plan.end) {
      return toTextResponse("Please provide event title, start time, and end time.");
    }

    try {
      await createCalendarEvent(integrationId, connectionId, {
        summary: plan.summary,
        description: plan.description,
        start: plan.start,
        end: plan.end,
        timeZone: plan.timeZone,
      });
      return toTextResponse(`Calendar event created: ${plan.summary}.`);
    } catch (error) {
      logError("chat.create_event_failed", { requestId, userId: user.id, error });
      return toTextResponse("Failed to create calendar event. Check Calendar scopes and try again.", 500);
    }
  }

  return toTextResponse("Action not supported.", 400);
}
