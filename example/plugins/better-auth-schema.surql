DEFINE TABLE user SCHEMALESS;
DEFINE FIELD name ON TABLE user TYPE string;
DEFINE FIELD email ON TABLE user TYPE string;
DEFINE INDEX userUserUnique ON TABLE user COLUMNS email UNIQUE;
DEFINE FIELD emailVerified ON TABLE user TYPE bool;
DEFINE FIELD image ON TABLE user TYPE option<string>;
DEFINE FIELD createdAt ON TABLE user TYPE datetime;
DEFINE FIELD updatedAt ON TABLE user TYPE datetime;

DEFINE TABLE session SCHEMALESS;
DEFINE FIELD expiresAt ON TABLE session TYPE datetime;
DEFINE FIELD token ON TABLE session TYPE string;
DEFINE INDEX sessionSessionUnique ON TABLE session COLUMNS token UNIQUE;
DEFINE FIELD createdAt ON TABLE session TYPE datetime;
DEFINE FIELD updatedAt ON TABLE session TYPE datetime;
DEFINE FIELD ipAddress ON TABLE session TYPE option<string>;
DEFINE FIELD userAgent ON TABLE session TYPE option<string>;
DEFINE FIELD userId ON TABLE session TYPE record<user>;

DEFINE TABLE account SCHEMALESS;
DEFINE FIELD accountId ON TABLE account TYPE string;
DEFINE FIELD providerId ON TABLE account TYPE string;
DEFINE FIELD userId ON TABLE account TYPE record<user>;
DEFINE FIELD accessToken ON TABLE account TYPE option<string>;
DEFINE FIELD refreshToken ON TABLE account TYPE option<string>;
DEFINE FIELD idToken ON TABLE account TYPE option<string>;
DEFINE FIELD accessTokenExpiresAt ON TABLE account TYPE option<datetime>;
DEFINE FIELD refreshTokenExpiresAt ON TABLE account TYPE option<datetime>;
DEFINE FIELD scope ON TABLE account TYPE option<string>;
DEFINE FIELD password ON TABLE account TYPE option<string>;
DEFINE FIELD createdAt ON TABLE account TYPE datetime;
DEFINE FIELD updatedAt ON TABLE account TYPE datetime;

DEFINE TABLE verification SCHEMALESS;
DEFINE FIELD identifier ON TABLE verification TYPE string;
DEFINE FIELD value ON TABLE verification TYPE string;
DEFINE FIELD expiresAt ON TABLE verification TYPE datetime;
DEFINE FIELD createdAt ON TABLE verification TYPE option<datetime>;
DEFINE FIELD updatedAt ON TABLE verification TYPE option<datetime>;
