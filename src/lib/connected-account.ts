export type NangoConnection = {
  credentials?: {
    raw?: {
      email?: string;
      name?: string;
      scope?: string;
    };
  };
  connection?: {
    end_user_email?: string;
    end_user_display_name?: string;
  };
};

export function extractAccountMetadata(connection: NangoConnection) {
  const email =
    connection.credentials?.raw?.email ??
    connection.connection?.end_user_email ??
    null;
  const name =
    connection.credentials?.raw?.name ??
    connection.connection?.end_user_display_name ??
    null;
  const scopes = connection.credentials?.raw?.scope
    ? connection.credentials.raw.scope.split(" ")
    : null;

  return { email, name, scopes };
}
