import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNote, serializeNote } from "./frontmatter";

test("parseNote() reads title and tags out of frontmatter", () => {
  const raw = "---\ntitle: Meeting Notes\ntags: [work, standup]\n---\n# Agenda\n\n- item one";
  const parsed = parseNote(raw, "fallback");
  assert.equal(parsed.title, "Meeting Notes");
  assert.deepEqual(parsed.tags, ["work", "standup"]);
  assert.equal(parsed.body, "# Agenda\n\n- item one");
});

test("parseNote() falls back to the given title when there's no frontmatter", () => {
  const parsed = parseNote("just plain text, no frontmatter", "untitled");
  assert.equal(parsed.title, "untitled");
  assert.deepEqual(parsed.tags, []);
  assert.equal(parsed.body, "just plain text, no frontmatter");
});

test("parseNote() handles empty tags", () => {
  const raw = "---\ntitle: Solo\ntags: []\n---\nbody text";
  const parsed = parseNote(raw, "fallback");
  assert.deepEqual(parsed.tags, []);
});

test("serializeNote() round-trips through parseNote()", () => {
  const note = { title: "Round Trip", tags: ["a", "b"], body: "Some **markdown** body." };
  const serialized = serializeNote(note);
  const reparsed = parseNote(serialized, "fallback");
  assert.deepEqual(reparsed, note);
});

test("serializeNote() produces well-formed frontmatter with no tags", () => {
  const serialized = serializeNote({ title: "No Tags", tags: [], body: "body" });
  assert.equal(serialized, "---\ntitle: No Tags\ntags: []\n---\nbody");
});
