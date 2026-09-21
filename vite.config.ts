import assert from "node:assert/strict";
import { defineConfig } from "vite-plus";
import { fetchContacts } from "./scripts/contacts.js";

export default defineConfig(() => {
  let contacts: Promise<string> | undefined;
  return {
    // Keep this standalone project's tooling from inheriting parent configs.
    fmt: {},
    lint: {},
    plugins: [
      {
        name: "build-time-contacts",
        async transformIndexHtml(html) {
          const marker = "<!-- CONTACTS -->";
          assert.equal(
            html.split(marker).length,
            2,
            "The page must contain exactly one contacts marker.",
          );
          // Reuse the fetch during development; a new build or server restart
          // gets fresh contacts without making requests in the visitor's browser.
          contacts ??= fetchContacts().catch((error) => {
            // Let a browser reload retry after a temporary network failure.
            contacts = undefined;
            throw error;
          });
          const contactsHtml = await contacts;
          return html.replace(marker, () => contactsHtml);
        },
      },
    ],
  };
});
