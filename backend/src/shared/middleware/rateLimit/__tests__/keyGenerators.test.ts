import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { env } from "../../../../config";
import {
  getClientIP,
  ipKeyGenerator,
  otpRequestKeyGenerator,
  otpVerifyKeyGenerator,
  userKeyGenerator,
} from "../keyGenerators";

describe("shared/middleware/rateLimit/keyGenerators.ts", () => {
  // Store original TRUST_PROXY value
  let originalTrustProxy: boolean;

  beforeAll(() => {
    originalTrustProxy = env.TRUST_PROXY;
  });

  afterAll(() => {
    // Restore original value
    (env as { TRUST_PROXY: boolean }).TRUST_PROXY = originalTrustProxy;
  });

  describe("getClientIP()", () => {
    describe("when TRUST_PROXY is false", () => {
      beforeAll(() => {
        (env as { TRUST_PROXY: boolean }).TRUST_PROXY = false;
      });

      test("returns 'unknown' when no proxy headers", () => {
        const request = new Request("http://localhost/test");
        const ip = getClientIP(request);
        expect(ip).toBe("unknown");
      });

      test("ignores x-forwarded-for header", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("unknown");
      });

      test("ignores x-real-ip header", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-real-ip": "1.2.3.4" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("unknown");
      });
    });

    describe("when TRUST_PROXY is true", () => {
      beforeAll(() => {
        (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
      });

      test("extracts IP from x-forwarded-for header", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("1.2.3.4");
      });

      test("extracts first IP from multi-hop x-forwarded-for", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("1.2.3.4");
      });

      test("trims whitespace from x-forwarded-for", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "  1.2.3.4  ,  5.6.7.8  " },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("1.2.3.4");
      });

      test("falls back to x-real-ip when x-forwarded-for is absent", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-real-ip": "10.20.30.40" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("10.20.30.40");
      });

      test("prefers x-forwarded-for over x-real-ip", () => {
        const request = new Request("http://localhost/test", {
          headers: {
            "x-forwarded-for": "1.2.3.4",
            "x-real-ip": "10.20.30.40",
          },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("1.2.3.4");
      });

      test("returns 'unknown' when no proxy headers provided", () => {
        const request = new Request("http://localhost/test");
        const ip = getClientIP(request);
        expect(ip).toBe("unknown");
      });
    });

    describe("IPv6 normalization", () => {
      beforeAll(() => {
        (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
      });

      test("normalizes ::ffff:x.x.x.x to x.x.x.x", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "::ffff:192.168.1.1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("192.168.1.1");
      });

      test("normalizes 0:0:0:0:0:ffff:x.x.x.x to x.x.x.x", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "0:0:0:0:0:ffff:10.0.0.1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("10.0.0.1");
      });

      test("normalizes IPv6 addresses to lowercase", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "2001:DB8::1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("2001:db8::1");
      });

      test("handles case-insensitive IPv4-mapped matching", () => {
        const request = new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "::FFFF:127.0.0.1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("127.0.0.1");
      });
    });
  });

  describe("ipKeyGenerator()", () => {
    beforeAll(() => {
      (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
    });

    test("generates key with ip: prefix", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
      };
      const key = ipKeyGenerator(ctx);
      expect(key).toBe("ip:1.2.3.4");
    });
  });

  describe("userKeyGenerator()", () => {
    beforeAll(() => {
      (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
    });

    test("generates user-based key when user is present", () => {
      const ctx = {
        request: new Request("http://localhost/test"),
        user: { id: "user-123" },
      };
      const key = userKeyGenerator(ctx);
      expect(key).toBe("user:user-123");
    });

    test("falls back to IP when user is not present", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "5.6.7.8" },
        }),
      };
      const key = userKeyGenerator(ctx);
      expect(key).toBe("ip:5.6.7.8");
    });

    test("falls back to IP when user.id is undefined", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "5.6.7.8" },
        }),
        user: {},
      };
      const key = userKeyGenerator(
        ctx as Parameters<typeof userKeyGenerator>[0],
      );
      expect(key).toBe("ip:5.6.7.8");
    });
  });

  describe("otpRequestKeyGenerator()", () => {
    beforeAll(() => {
      (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
    });

    test("generates key with IP and phone when both present", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
        body: { phone: "+5511999999999" },
      };
      const key = otpRequestKeyGenerator(ctx);
      expect(key).toBe("otp-req:1.2.3.4:+5511999999999");
    });

    test("generates key with IP only when phone is not present", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
        body: {},
      };
      const key = otpRequestKeyGenerator(ctx);
      expect(key).toBe("otp-req:1.2.3.4");
    });

    test("generates key with IP only when body is undefined", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
      };
      const key = otpRequestKeyGenerator(ctx);
      expect(key).toBe("otp-req:1.2.3.4");
    });
  });

  describe("otpVerifyKeyGenerator()", () => {
    beforeAll(() => {
      (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
    });

    test("generates key with IP and phone", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
        body: { phone: "+5511999999999", code: "123456" },
      };
      const key = otpVerifyKeyGenerator(ctx);
      expect(key).toBe("otp-verify:1.2.3.4:+5511999999999");
    });

    test("uses 'unknown' when phone is not present", () => {
      const ctx = {
        request: new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
        body: { code: "123456" },
      };
      const key = otpVerifyKeyGenerator(ctx);
      expect(key).toBe("otp-verify:1.2.3.4:unknown");
    });
  });
});
