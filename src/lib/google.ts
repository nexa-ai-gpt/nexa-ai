import { nango } from "@/lib/nango";

type GoogleMessage = {
  id: string;
  threadId?: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
};

function headerValue(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function listGmailMessages(
  providerConfigKey: string,
  connectionId: string,
  query: string,
  maxResults = 5,
): Promise<GoogleMessage[]> {
  const list = await nango.get<{
    messages?: Array<{ id: string; threadId?: string }>;
  }>({
    endpoint: `/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(
      query,
    )}`,
    providerConfigKey,
    connectionId,
  });

  const messages = list.data.messages ?? [];
  const results: GoogleMessage[] = [];

  for (const msg of messages) {
    const detail = await nango.get<{
      id: string;
      threadId?: string;
      snippet?: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    }>({
      endpoint: `/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
      providerConfigKey,
      connectionId,
    });

    const headers = detail.data.payload?.headers ?? [];
    results.push({
      id: detail.data.id,
      threadId: detail.data.threadId,
      snippet: detail.data.snippet,
      subject: headerValue(headers, "Subject"),
      from: headerValue(headers, "From"),
      date: headerValue(headers, "Date"),
    });
  }

  return results;
}

export async function sendGmailMessage(
  providerConfigKey: string,
  connectionId: string,
  input: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
  },
) {
  const lines = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : "",
    input.bcc ? `Bcc: ${input.bcc}` : "",
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    `Subject: ${input.subject}`,
    "",
    input.body,
  ].filter(Boolean);

  const raw = toBase64Url(lines.join("\r\n"));

  return nango.post<{ id: string; threadId: string }>({
    endpoint: "/gmail/v1/users/me/messages/send",
    providerConfigKey,
    connectionId,
    data: { raw },
  });
}

export async function listCalendarEvents(
  providerConfigKey: string,
  connectionId: string,
  timeMin: string,
  timeMax?: string,
  maxResults = 10,
) {
  const params = new URLSearchParams({
    timeMin,
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });
  if (timeMax) params.set("timeMax", timeMax);

  return nango.get<{
    items?: Array<{
      id: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      htmlLink?: string;
    }>;
  }>({
    endpoint: `/calendar/v3/calendars/primary/events?${params.toString()}`,
    providerConfigKey,
    connectionId,
  });
}

export async function createCalendarEvent(
  providerConfigKey: string,
  connectionId: string,
  input: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    timeZone?: string;
  },
) {
  return nango.post({
    endpoint: "/calendar/v3/calendars/primary/events",
    providerConfigKey,
    connectionId,
    data: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start, timeZone: input.timeZone },
      end: { dateTime: input.end, timeZone: input.timeZone },
    },
  });
}

export async function getGoogleDoc(
  providerConfigKey: string,
  connectionId: string,
  documentId: string,
) {
  return nango.get({
    endpoint: `/v1/documents/${encodeURIComponent(documentId)}`,
    providerConfigKey,
    connectionId,
  });
}
