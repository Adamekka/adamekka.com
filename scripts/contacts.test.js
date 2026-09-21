import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { contactsSource, fetchContacts, renderContacts } from "./contacts.js";
import config from "../vite.config.ts";

afterEach(() => vi.unstubAllGlobals());

describe("contact sync", () => {
  it("retries a failed development fetch and reuses the successful result", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network unavailable"))
      .mockResolvedValueOnce(new Response('<img src="icon.svg"> Service: username'));
    vi.stubGlobal("fetch", request);
    const { plugins } = config({ command: "serve", mode: "development" });
    const transform = plugins.find(
      (plugin) => plugin.name === "build-time-contacts",
    ).transformIndexHtml;
    await expect(transform("<!-- CONTACTS -->")).rejects.toThrow("Could not sync contacts");
    expect(await transform("<!-- CONTACTS -->")).toContain("Service");
    expect(await transform("<!-- CONTACTS -->")).toContain("Service");
    expect(request).toHaveBeenCalledTimes(2);
    await expect(transform("missing marker")).rejects.toThrow("exactly one contacts marker");
    await expect(transform("<!-- CONTACTS --><!-- CONTACTS -->")).rejects.toThrow(
      "exactly one contacts marker",
    );
  });
  it("renders links and plain usernames without copying remote markup", () => {
    const result = renderContacts(`<!-- markdownlint-disable MD033 MD041 -->
<img src="icon.svg" alt=""> Discord: test-user
<img src="icon.svg" alt=""> <a href="https://example.com/#contact">Example</a>`);
    expect(result).toContain('Discord<span class="username">: test-user</span>');
    expect(result).toContain('<a href="https://example.com/#contact">Example</a>');
    expect(result).not.toContain("<img");
  });

  it("escapes text and URL characters before writing HTML", () => {
    expect(
      renderContacts('<img src="icon.svg"> <a href="https://example.com/?a=1&b=2">A & B</a>'),
    ).toContain('href="https://example.com/?a=1&amp;b=2">A &amp; B</a>');
  });

  it.each([
    "",
    '<img src="icon.svg"> <a href="javascript:alert(1)">Bad</a>',
    '<img src="icon.svg"> <a href="https://user:pass@example.com">Bad</a>',
    '<img src="icon.svg"> <script>alert(1)</script>',
    "Unexpected source format",
  ])("rejects empty, unsafe, or unrecognized source content: %s", (source) => {
    expect(() => renderContacts(source)).toThrow();
  });

  it("fetches and renders the configured source", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response('<img src="icon.svg"> Service: username'));
    vi.stubGlobal("fetch", request);
    expect(await fetchContacts()).toContain("Service");
    expect(request).toHaveBeenCalledWith(contactsSource, { signal: expect.any(AbortSignal) });
  });

  it("fails with an actionable diagnostic on HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    await expect(fetchContacts()).rejects.toThrow(
      "Check the connection and source document, then rebuild.",
    );
  });

  it("fails on network errors instead of returning cached or empty contacts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")));
    await expect(fetchContacts()).rejects.toThrow("Could not sync contacts");
  });
});
