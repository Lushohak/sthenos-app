type MailpitAddress = {
  Address?: string;
};

type MailpitSummary = {
  ID: string;
  To?: MailpitAddress[];
};

type MailpitList = {
  messages?: MailpitSummary[];
};

type MailpitMessage = {
  Subject?: string;
  HTML?: string;
  Text?: string;
};

function getMailpitUrl() {
  return process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
}

export async function clearMailpit() {
  await fetch(`${getMailpitUrl()}/api/v1/messages`, { method: "DELETE" });
}

export async function waitForEmail(recipient: string) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${getMailpitUrl()}/api/v1/messages`);
    if (response.ok) {
      const data = (await response.json()) as MailpitList;
      const summary = data.messages?.find((message) =>
        message.To?.some(
          (address) => address.Address?.toLowerCase() === recipient.toLowerCase()
        )
      );

      if (summary) {
        const messageResponse = await fetch(
          `${getMailpitUrl()}/api/v1/message/${summary.ID}`
        );
        if (messageResponse.ok) {
          return (await messageResponse.json()) as MailpitMessage;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No local email arrived for ${recipient}.`);
}

export function getSupabaseActionLink(message: MailpitMessage) {
  const content = `${message.HTML ?? ""}\n${message.Text ?? ""}`
    .replaceAll("&amp;", "&")
    .replaceAll("&#x2F;", "/")
    .replaceAll("&#x3D;", "=");
  const urls = content.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  const actionLink = urls.find((url) => url.includes("/auth/v1/verify"));

  if (!actionLink) {
    throw new Error("The Supabase action link was not found in the local email.");
  }

  return actionLink;
}
