import { Resource } from "sst";

export namespace Email {
  export interface SendInput {
    from: string;
    fromName?: string;
    to: string[];
    replyTo?: string[];
    subject: string;
    html: string;
    text: string;
  }

  export async function send(input: SendInput) {
    const response = await fetch("https://opensend.anoma.ly/v1/emails/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Resource.OpensendApiKey.value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        fromName: input.fromName,
        to: input.to,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        kind: "transactional",
      }),
    });
    if (!response.ok)
      throw new Error(
        `opensend send failed ${response.status}: ${await response.text()}`,
      );
    return (await response.json()) as { id: string; status: string };
  }
}
