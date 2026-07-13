import { env } from "../../../config";

/** Base context shape with request for key generators. */
interface BaseContext {
  /** The incoming request. */
  request: Request;
}

/**
 * Normalizes IPv4-mapped IPv6 addresses to IPv4.
 * Prevents bypassing rate limits via different IP formats.
 * @param ip - The IP address to normalize.
 * @returns The normalized IP address.
 * @example
 * normalizeIP("::ffff:192.168.1.1") // "192.168.1.1"
 * normalizeIP("0:0:0:0:0:ffff:192.168.1.1") // "192.168.1.1"
 */
const normalizeIP = (ip: string): string => {
  // Handle IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  const ipv4Mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv4Mapped?.[1]) {
    return ipv4Mapped[1];
  }
  // Handle full IPv4-mapped format (0:0:0:0:0:ffff:x.x.x.x)
  const fullMapped = ip.match(
    /^0:0:0:0:0:ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
  );
  if (fullMapped?.[1]) {
    return fullMapped[1];
  }
  return ip.toLowerCase(); // Normalize IPv6 to lowercase
};

/**
 * Extracts client IP from request, respecting TRUST_PROXY setting.
 * Normalizes IPv4-mapped IPv6 addresses to prevent bypass.
 * @param request - The incoming request.
 * @returns The client IP address.
 */
export const getClientIP = (request: Request): string => {
  const trustProxy = env.TRUST_PROXY;
  let ip = "unknown";

  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      // Always take leftmost IP (original client)
      const firstIp = forwarded.split(",")[0];
      ip = firstIp?.trim() ?? "unknown";
    } else {
      const realIp = request.headers.get("x-real-ip");
      if (realIp) {
        ip = realIp;
      }
    }
  }

  // Normalize to prevent IPv4/IPv6 mapped address bypass
  return normalizeIP(ip);
};

/**
 * Key generator for global IP-based rate limiting.
 * Uses a distinct prefix to avoid sharing counters with route-specific rate limits.
 * @param ctx - The context with request.
 * @returns A rate limit key based on the client IP with global prefix.
 */
export const globalIpKeyGenerator = (ctx: BaseContext): string => {
  return `global-ip:${getClientIP(ctx.request)}`;
};

/**
 * Key generator for IP-based rate limiting (unauthenticated requests).
 * @param ctx - The context with request.
 * @returns A rate limit key based on the client IP.
 */
export const ipKeyGenerator = (ctx: BaseContext): string => {
  return `ip:${getClientIP(ctx.request)}`;
};

/** Context type with optional user property for authenticated requests. */
interface AuthenticatedContext extends BaseContext {
  /** The authenticated user, if present. */
  user?: { id: string };
}

/**
 * Key generator for user-based rate limiting (authenticated requests).
 * Falls back to IP if user not available.
 * @param ctx - The context with optional user.
 * @returns A rate limit key based on user ID or fallback to IP.
 */
export const userKeyGenerator = (ctx: AuthenticatedContext): string => {
  if (ctx.user?.id) {
    return `user:${ctx.user.id}`;
  }
  return ipKeyGenerator(ctx);
};
