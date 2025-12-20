import { Client } from "@notionhq/client";

export type NotionClient = Client;

export type CreateNotionClientInput = {
  token: string;
  timeoutMs?: number;
};

export function createNotionClient(input: CreateNotionClientInput): NotionClient {
  const token = input.token?.trim();
  if (!token) throw new Error("NOTION token is required");

  return new Client({
    auth: token,
    // @notionhq/client uses undici/fetch under the hood; timeout is supported.
    // If unsupported in a future version, callers can wrap requests.
    timeoutMs: input.timeoutMs ?? 30_000,
  } as any);
}


