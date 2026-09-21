export const contactsSource =
  "https://raw.githubusercontent.com/Adamekka/contacts/main/contacts.md";

export function renderContacts(markdown) {
  const escape = (value) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  const contacts = [];
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^<!--.*-->$/.test(trimmed)) continue;

    // The source uses one icon-prefixed contact per line. Reject format changes
    // instead of silently publishing an incomplete contact list or remote HTML.
    const entry = trimmed.match(/^<img\s[^>]*>\s*(.+)$/);
    if (!entry) throw new Error(`Unsupported contacts row: ${trimmed}`);

    const link = entry[1].match(/^<a href="([^"]+)">([^<>]+)<\/a>$/);
    if (link) {
      const url = new URL(link[1]);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Contact links must use HTTPS without credentials.");
      }
      contacts.push(`<li><a href="${escape(url.href)}">${escape(link[2])}</a></li>`);
      continue;
    }

    const username = entry[1].match(/^([^<>:]+):\s+([^<>]+)$/);
    if (!username) throw new Error(`Unsupported contact: ${entry[1]}`);
    contacts.push(
      `<li>${escape(username[1])}<span class="username">: ${escape(username[2])}</span></li>`,
    );
  }

  if (contacts.length === 0) throw new Error("The contacts document is empty.");
  return contacts.join("\n");
}

export async function fetchContacts() {
  try {
    const response = await fetch(contactsSource, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    return renderContacts(await response.text());
  } catch (cause) {
    throw new Error(
      `Could not sync contacts from ${contactsSource}. Check the connection and source document, then rebuild.`,
      { cause },
    );
  }
}
