import assert from "node:assert/strict";
import { DOCUMENT_CANDIDATES, documentUrlKey } from "../lib/news/document-candidates";
import { extractDocumentSnapshot } from "../lib/news/document-extract";

const candidate = { ...DOCUMENT_CANDIDATES[0], bodySelector: "article", hold: undefined,
  sections: [{ start: "concept", end: "next" }] };
const page = '<html lang="en"><body><h1>Lesson</h1><article><h2 id="intro">Omit intro</h2><p>Outside scope</p><h2 id="concept">Querying</h2><p>Use <code>SELECT</code> and <code>WHERE</code>.</p><pre>SELECT * FROM weather;</pre><table><tr><th>City</th><th>Temperature</th></tr><tr><td>Seoul</td><td>20</td></tr></table><h2 id="next">Next topic</h2><p>Omit next</p></article></body></html>';
const result = extractDocumentSnapshot(page, candidate);
assert.match(result.text, /Use SELECT and WHERE/);
assert.match(result.text, /SELECT \* FROM weather;/);
assert.match(result.text, /City \| Temperature/);
assert.match(result.text, /Seoul \| 20/);
assert.doesNotMatch(result.text, /Outside scope|Next topic|Omit/);
assert.throws(() => extractDocumentSnapshot(page.replace('id="next"', 'id="renamed"'), candidate), /missing-or-duplicate-section/);
assert.throws(() => extractDocumentSnapshot(page.replace('lang="en"', 'lang="es"'), candidate), /unexpected-language/);
assert.throws(() => extractDocumentSnapshot(page, { ...candidate, sections: [{ start: "next", end: "concept" }] }), /invalid-section-order/);
assert.throws(() => extractDocumentSnapshot(page, { ...candidate, sections: [...candidate.sections, ...candidate.sections] }), /overlapping-sections/);
assert.throws(() => extractDocumentSnapshot(page.replace('<p>Outside scope', '<h3 id="concept">Duplicate</h3><p>Outside scope'), candidate), /missing-or-duplicate-section/);
const visual = extractDocumentSnapshot(page.replace('Use <code>', '<img alt="meaningful diagram" src="example.png">Use <code>'), candidate);
assert.equal(visual.dependencies.figures, 1);
assert.match(visual.text, /meaningful diagram/);
assert.equal(documentUrlKey('https://cloud.google.com/storage/docs/objects/?hl=es&amp;utm_source=rss#objects'), documentUrlKey('https://docs.cloud.google.com/storage/docs/objects'));
assert.notEqual(documentUrlKey('https://www.postgresql.org/docs/18/tutorial-select.html'), documentUrlKey('https://www.postgresql.org/docs/17/tutorial-select.html'));
assert.notEqual(documentUrlKey('https://example.com/doc?version=1'), documentUrlKey('https://example.com/doc?version=2'));
assert.equal(new Set(DOCUMENT_CANDIDATES.map(row => documentUrlKey(row.url))).size, DOCUMENT_CANDIDATES.length);
console.log("Document acquisition: scoped extraction, semantic preservation, fail-closed boundaries/language, visual detection and URL identity passed.");
