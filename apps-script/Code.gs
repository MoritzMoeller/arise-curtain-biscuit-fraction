/** @OnlyCurrentDoc */
/**
 * Backend for the card: a Google Sheet + this script, deployed as a web app.
 * All content lives in the sheet; nothing is returned without a valid code.
 *
 * Tabs (row 1 = headers):
 *   Gäste          A code | B Anrede | C Personen (comma separated) | D Telefon | E Link | F WhatsApp
 *                  (you fill B–D; the menu fills A, E, F)
 *   Inhalt         A Seite | B Art | C Text | D Extra   – one row per block on the card
 *   Einstellungen  A key | B value
 *   Antworten      written by this script, one row per person
 */

const GUESTS = "Gäste";
const CONTENT = "Inhalt";
const SETTINGS = "Einstellungen";
const ANSWERS = "Antworten";
const SERVER_ONLY = ["siteUrl", "whatsappText"]; // settings not sent to the page

// ---------- web app ----------

function doGet(e) {
  const code = String(e.parameter.code || "").trim();
  const guest = findGuest(code);
  if (!guest) return json({ guest: null });

  const settings = readSettings();
  SERVER_ONLY.forEach((k) => delete settings[k]);
  return json({ guest, rsvp: findAnswer(code), content: readContent(), settings });
}

function doPost(e) {
  const { code, rsvp } = JSON.parse(e.postData.contents);
  const guest = findGuest(code);
  if (!guest) return json({ ok: false, error: "unknown code" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // answers are final: if there already is one, return it unchanged
    const existing = findAnswer(code);
    if (existing) return json({ ok: true, rsvp: existing });

    const options = optionList();
    // only trust names and option count from the sheet, not from the request
    const clean = {
      people: guest.people.map((name, i) => ({
        name,
        choices: options.map((_, j) => !!(rsvp.people[i] && rsvp.people[i].choices && rsvp.people[i].choices[j])),
      })),
      diet: String(rsvp.diet || "").slice(0, 500),
      savedAt: new Date().toISOString(),
    };
    const sheet = answersSheet(options);
    clean.people.forEach((p, i) =>
      sheet.appendRow([code, new Date(clean.savedAt), p.name, ...p.choices.map((c) => (c ? "ja" : "nein")),
        clean.diet, i === 0 ? JSON.stringify(clean) : ""]));
    return json({ ok: true, rsvp: clean });
  } finally {
    lock.releaseLock();
  }
}

// ---------- menu: create codes and links ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Gäste").addItem("Codes & Links erzeugen", "createLinks").addToUi();
}

function createLinks() {
  const settings = readSettings();
  if (!settings.siteUrl) throw new Error('Bitte "siteUrl" im Tab Einstellungen eintragen.');
  const sheet = tab(GUESTS);
  const rows = sheet.getDataRange().getValues();
  const used = new Set(rows.map((r) => String(r[0])));
  for (let i = 1; i < rows.length; i++) {
    const [code, greeting, , phone] = rows[i];
    if (!greeting) continue;
    let c = String(code).trim();
    if (!c) {
      do c = randomCode(); while (used.has(c));
      used.add(c);
      sheet.getRange(i + 1, 1).setNumberFormat("@").setValue(c); // plain text, so "4e5678" stays a code
    }
    const link = settings.siteUrl + "?g=" + c;
    const text = (settings.whatsappText || "{anrede},\n{link}").replace(/\{anrede\}/g, greeting).replace(/\{link\}/g, link);
    const digits = String(phone || "").replace(/[^\d]/g, "").replace(/^00/, "");
    sheet.getRange(i + 1, 5).setValue(link);
    sheet.getRange(i + 1, 6).setValue(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`);
  }
}

function randomCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (l/1, o/0)
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ---------- helpers ----------

// Find a tab by name, ignoring case, spaces and how the umlaut is encoded.
function findTab(name) {
  const norm = (s) => s.normalize("NFC").trim().toLowerCase();
  return SpreadsheetApp.getActive().getSheets().find((s) => norm(s.getName()) === norm(name)) || null;
}

function tab(name) {
  const sheet = findTab(name);
  if (!sheet) {
    const names = SpreadsheetApp.getActive().getSheets().map((s) => `"${s.getName()}"`).join(", ");
    throw new Error(`Tab "${name}" fehlt. Vorhanden: ${names}`);
  }
  return sheet;
}

function readSettings() {
  const out = {};
  tab(SETTINGS).getDataRange().getValues().slice(1)
    .forEach(([key, value]) => { if (key) out[String(key).trim()] = String(value); });
  return out;
}

function readContent() {
  return tab(CONTENT).getDataRange().getDisplayValues().slice(1)
    .filter((r) => r[0] && r[1])
    .map(([page, type, text, extra]) => [Number(page), String(type).trim().toLowerCase(), text, extra]);
}

function optionList() {
  return String(readSettings().options || "").split(",").map((s) => s.trim()).filter(String);
}

function findGuest(code) {
  if (!code) return null;
  const row = tab(GUESTS).getDataRange().getValues().slice(1).find((r) => String(r[0]).trim() === code);
  if (!row) return null;
  return { greeting: String(row[1]), people: String(row[2]).split(",").map((s) => s.trim()).filter(String) };
}

function findAnswer(code) {
  const sheet = findTab(ANSWERS);
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  const jsonCol = rows[0].length - 1;
  const row = rows.find((r) => r[0] === code && r[jsonCol]);
  return row ? JSON.parse(row[jsonCol]) : null;
}

function answersSheet(options) {
  const ss = SpreadsheetApp.getActive();
  let sheet = findTab(ANSWERS);
  if (!sheet) {
    sheet = ss.insertSheet(ANSWERS);
    sheet.appendRow(["code", "gespeichert", "Person", ...options, "Sonstiges", "json"]);
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
