import type { DriveClient, AuthClient } from "./_api-types";
import type {
  GoogleDriveAuth,
  GoogleDriveOAuthAuth,
  GoogleDriveServiceAccountAuth,
  GoogleDriveGoogleAuthAuth,
  ServiceAccountCredentials,
} from "./types";

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
      credentials: ServiceAccountCredentials;
      subject?: string;
    }
  | { kind: "google_auth"; auth: unknown };

/**
 * Type guard for service account auth.
 */
function isServiceAccountAuth(auth: GoogleDriveAuth): auth is GoogleDriveServiceAccountAuth {
  return auth.kind === "service_account";
}

/**
 * Type guard for google auth.
 */
function isGoogleAuth(auth: GoogleDriveAuth): auth is GoogleDriveGoogleAuthAuth {
  return auth.kind === "google_auth";
}

/**
 * Type guard for oauth.
 */
function isOAuthAuth(auth: GoogleDriveAuth): auth is GoogleDriveOAuthAuth {
  return auth.kind === "oauth";
}

export function normalizeGoogleDriveAuth(auth: GoogleDriveAuth): NormalizedAuth {
  if (!auth || typeof auth !== "object") {
    throw new Error("Google Drive auth is required");
  }

  if (isGoogleAuth(auth)) {
    if (!auth.auth) throw new Error('Google Drive auth.kind="google_auth" requires auth');
    return { kind: "google_auth", auth: auth.auth };
  }

  if (isServiceAccountAuth(auth)) {
    const raw = auth.credentialsJson;
    if (!raw) {
      throw new Error(
        'Google Drive auth.kind="service_account" requires credentialsJson'
      );
    }
    const credentials: ServiceAccountCredentials =
      typeof raw === "string" ? (JSON.parse(raw) as ServiceAccountCredentials) : raw;
    if (!credentials?.client_email || !credentials?.private_key) {
      throw new Error(
        'Google Drive service account credentials must include "client_email" and "private_key".'
      );
    }
    return {
      kind: "service_account",
      credentials,
      subject: auth.subject ? String(auth.subject) : undefined,
    };
  }

  if (isOAuthAuth(auth)) {
    // oauth
    if (auth.oauthClient) {
      return { kind: "oauth_client", oauthClient: auth.oauthClient };
    }

    const { clientId, clientSecret, redirectUri, refreshToken, accessToken } = auth;
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

  throw new Error(`Unknown Google Drive auth kind: ${String((auth as Record<string, unknown>).kind)}`);
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
 * Google Auth Library module shape for dynamic import.
 */
interface GoogleAuthLibraryModule {
  OAuth2Client?: new (
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ) => {
    setCredentials(credentials: Record<string, string>): void;
  };
  OAuth2?: new (
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ) => {
    setCredentials(credentials: Record<string, string>): void;
  };
  JWT?: new (options: {
    email: string;
    key: string;
    scopes: string[];
    subject?: string;
  }) => unknown;
}

/**
 * Googleapis module shape for dynamic import.
 */
interface GoogleApisModule {
  google: {
    drive(options: { version: string; auth: unknown }): DriveClient;
  };
}

/**
 * Creates a Google Drive API client from a plug-and-play auth input.
 *
 * Note: This uses dynamic imports so the core Unrag package does not require
 * Google dependencies unless the connector is installed into a user project.
 */
export async function createGoogleDriveClient(args: {
  auth: GoogleDriveAuth;
  scopes?: string[];
}): Promise<{ drive: DriveClient; authClient: AuthClient }> {
  const normalized = normalizeGoogleDriveAuth(args.auth);
  const scopes = (args.scopes?.length ? args.scopes : DEFAULT_DRIVE_SCOPES) as string[];

  let authClient: unknown;

  try {
    if (normalized.kind === "oauth_client") {
      authClient = normalized.oauthClient;
    } else if (normalized.kind === "google_auth") {
      authClient = normalized.auth;
    } else {
      // google-auth-library (dynamic)
      const gal = (await import("google-auth-library")) as GoogleAuthLibraryModule;

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

    const { google } = (await import("googleapis")) as GoogleApisModule;
    if (!google?.drive) {
      throw new Error("googleapis.google.drive not found");
    }

    const drive = google.drive({
      version: "v3",
      auth: authClient,
    });

    return { drive, authClient: authClient as AuthClient };
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


