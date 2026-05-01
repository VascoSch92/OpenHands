import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  extractBaseHost,
  extractPathPrefix,
  buildHttpBaseUrl,
} from "#/utils/websocket-url";

describe("websocket-url utilities", () => {
  beforeEach(() => {
    vi.stubGlobal("location", {
      host: "localhost:3001",
      protocol: "https:",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("extractBaseHost", () => {
    it("should extract host from a standard URL", () => {
      const result = extractBaseHost(
        "https://example.com/api/conversations/123",
      );
      expect(result).toBe("example.com");
    });

    it("should extract host with port from URL", () => {
      const result = extractBaseHost(
        "http://localhost:3000/api/conversations/123",
      );
      expect(result).toBe("localhost:3000");
    });

    it("should extract host from proxy deployment URL", () => {
      const result = extractBaseHost(
        "https://openhands.example.com/runtime/55313/api/conversations/abc123",
      );
      expect(result).toBe("openhands.example.com");
    });

    it("should return window.location.host for relative URLs", () => {
      const result = extractBaseHost("/api/conversations/123");
      expect(result).toBe("localhost:3001");
    });

    it("should return window.location.host for null, undefined, or invalid URL", () => {
      expect(extractBaseHost(null)).toBe("localhost:3001");
      expect(extractBaseHost(undefined)).toBe("localhost:3001");
      expect(extractBaseHost("not-a-valid-url")).toBe("localhost:3001");
    });
  });

  describe("extractPathPrefix", () => {
    it("should return empty string for URL without path prefix", () => {
      const result = extractPathPrefix(
        "https://example.com/api/conversations/123",
      );
      expect(result).toBe("");
    });

    it("should extract path prefix from proxy deployment URL", () => {
      const result = extractPathPrefix(
        "https://openhands.example.com/runtime/55313/api/conversations/abc123",
      );
      expect(result).toBe("/runtime/55313");
    });

    it("should handle multiple path segments before /api/conversations", () => {
      const result = extractPathPrefix(
        "https://example.com/prefix/sub/path/api/conversations/123",
      );
      expect(result).toBe("/prefix/sub/path");
    });

    it("should remove trailing slash from path prefix", () => {
      // This test ensures the function handles URLs where the path ends with /
      const result = extractPathPrefix(
        "https://example.com/runtime/55313/api/conversations/123",
      );
      expect(result).not.toMatch(/\/$/);
    });

    it("should return empty string for relative URLs, null, undefined, or invalid URL", () => {
      expect(extractPathPrefix("/api/conversations/123")).toBe("");
      expect(extractPathPrefix(null)).toBe("");
      expect(extractPathPrefix(undefined)).toBe("");
      expect(extractPathPrefix("not-a-valid-url")).toBe("");
    });
  });

  describe("buildHttpBaseUrl", () => {
    it("should build HTTP URL without path prefix", () => {
      const result = buildHttpBaseUrl(
        "https://example.com/api/conversations/123",
      );
      expect(result).toBe("https://example.com");
    });

    it("should build HTTP URL with path prefix for proxy deployment", () => {
      const result = buildHttpBaseUrl(
        "https://openhands.example.com/runtime/55313/api/conversations/abc123",
      );
      expect(result).toBe("https://openhands.example.com/runtime/55313");
    });

    it("should use http protocol when window.location.protocol is http:", () => {
      vi.stubGlobal("location", {
        host: "localhost:3001",
        protocol: "http:",
      });

      const result = buildHttpBaseUrl(
        "http://localhost:3000/api/conversations/123",
      );
      expect(result).toBe("http://localhost:3000");
    });

    it("should fallback to window.location for null URL", () => {
      const result = buildHttpBaseUrl(null);
      expect(result).toBe("https://localhost:3001");
    });
  });
});
