const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

export const isLocalhostOrigin = (origin) => localhostOriginPattern.test(String(origin || ""));

export const isAllowedRequestOrigin = ({ origin, protocol, host, allowedOrigins, isProduction }) =>
  !origin ||
  origin === `${protocol}://${host}` ||
  allowedOrigins.has(origin) ||
  (!isProduction && isLocalhostOrigin(origin));
