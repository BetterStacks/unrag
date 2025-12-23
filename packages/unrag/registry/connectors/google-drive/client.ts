import type { GoogleDriveAuth } from "./types";

export const DEFAULT_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
] as const;

type NormalizedAuth =
  | { kind: "oauth_client"; oauthClient: unknown }
  | {
      kind: "oauth_config";
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      refreshToken: string;
      accessToken?: string;
    }
  | {
      kind: "service_account";
      credentials: Record<string, any>;
      subject?: string;
    }
  | { kind: "google_auth"; auth: unknown };

export function normalizeGoogleDriveAuth(auth: GoogleDriveAuth): NormalizedAuth {
  if (!auth || typeof auth !== "object") {
    throw new Error("Google Drive auth is required");
  }

  const kind = (auth as any).kind;
  if (kind !== "oauth" && kind !== "service_account" && kind !== "google_auth") {
    throw new Error(`Unknown Google Drive auth kind: ${String(kind)}`);
  }

  if (kind === "google_auth") {
    const a = (auth as any).auth;
    if (!a) throw new Error('Google Drive auth.kind="google_auth" requires auth');
    return { kind: "google_auth", auth: a };
  }

  if (kind === "service_account") {
    const raw = (auth as any).credentialsJson;
    if (!raw) {
      throw new Error(
        'Google Drive auth.kind="service_account" requires credentialsJson'
      );
    }
    const credentials =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, any>) : (raw as any);
    if (!credentials?.client_email || !credentials?.private_key) {
      throw new Error(
        'Google Drive service account credentials must include "client_email" and "private_key".'
      );
    }
    return {
      kind: "service_account",
      credentials,
      subject: (auth as any).subject ? String((auth as any).subject) : undefined,
    };
  }

  // oauth
  if ((auth as any).oauthClient) {
    return { kind: "oauth_client", oauthClient: (auth as any).oauthClient };
  }

  const { clientId, clientSecret, redirectUri, refreshToken, accessToken } = auth as any;
  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error(
      'Google Drive auth.kind="oauth" requires either oauthClient or { clientId, clientSecret, redirectUri, refreshToken }'
    );
  }
  return {
    kind: "oauth_config",
    clientId: String(clientId),
    clientSecret: String(clientSecret),
    redirectUri: String(redirectUri),
    refreshToken: String(refreshToken),
    ...(accessToken ? { accessToken: String(accessToken) } : {}),
  };
}

const asMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
};

/**
 * Creates a Google Drive API client from a plug-and-play auth input.
 *
 * Note: This uses dynamic imports so the core Unrag package does not require
 * Google dependencies unless the connector is installed into a user project.
 */
export async function createGoogleDriveClient(args: {
  auth: GoogleDriveAuth;
  scopes?: string[];
}): Promise<{ drive: any; authClient: any }> {
  const normalized = normalizeGoogleDriveAuth(args.auth);
  const scopes = (args.scopes?.length ? args.scopes : DEFAULT_DRIVE_SCOPES) as string[];

  let authClient: any;

  try {
    if (normalized.kind === "oauth_client") {
      authClient = normalized.oauthClient;
    } else if (normalized.kind === "google_auth") {
      authClient = normalized.auth;
    } else {
      // google-auth-library (dynamic)
      const gal: any = await import("google-auth-library");

      if (normalized.kind === "oauth_config") {
        const OAuth2Client = gal.OAuth2Client ?? gal.OAuth2;
        if (!OAuth2Client) {
          throw new Error("OAuth2Client not found in google-auth-library");
        }
        const client = new OAuth2Client(
          normalized.clientId,
          normalized.clientSecret,
          normalized.redirectUri
        );
        client.setCredentials({
          refresh_token: normalized.refreshToken,
          ...(normalized.accessToken ? { access_token: normalized.accessToken } : {}),
        });
        authClient = client;
      } else {
        const JWT = gal.JWT;
        if (!JWT) {
          throw new Error("JWT not found in google-auth-library");
        }
        const c = normalized.credentials;
        authClient = new JWT({
          email: c.client_email,
          key: c.private_key,
          scopes,
          ...(normalized.subject ? { subject: normalized.subject } : {}),
        });
      }
    }

    const { google }: any = await import("googleapis");
    if (!google?.drive) {
      throw new Error("googleapis.google.drive not found");
    }

    const drive = google.drive({
      version: "v3",
      auth: authClient,
    });

    return { drive, authClient };
  } catch (err) {
    const msg = asMessage(err);
    if (
      msg.includes("Cannot find module") &&
      (msg.includes("googleapis") || msg.includes("google-auth-library"))
    ) {
      throw new Error(
        `Missing Google Drive connector dependencies. Ensure you've installed the connector via \`unrag add google-drive\` (which adds "googleapis" and "google-auth-library"). Original error: ${msg}`
      );
    }
    throw err;
  }
}


