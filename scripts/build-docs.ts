/**
 * Build the concatenated system-docs bundle (CLI).
 *
 * Reads every topic file in `docs/system/` (the numbered `NN-*.md` files, in
 * filename order) and writes a single `loyalty-platform-system-docs.md` bundle for
 * RAG ingestion. The per-file YAML frontmatter is replaced with a lightweight
 * `<!-- doc_id: ... -->` marker so each topic stays a clear chunk boundary in the
 * bundle. Edit the topic files, not the bundle. Run with: `npm run docs:build`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = join(process.cwd(), "docs", "system");
const OUTPUT = join(DOCS_DIR, "loyalty-platform-system-docs.md");
const OUTPUT_NAME = "loyalty-platform-system-docs.md";

/** Split leading YAML frontmatter (`---\n...\n---`) from the markdown body. */
function splitFrontmatter(source: string): { docId: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!match) return { docId: "", body: source.trim() };
  const docIdLine = /^doc_id:\s*(.+)$/m.exec(match[1]);
  return {
    docId: docIdLine ? docIdLine[1].trim() : "",
    body: source.slice(match[0].length).trim(),
  };
}

function main() {
  const files = readdirSync(DOCS_DIR)
    .filter((f) => /^\d{2}-.*\.md$/.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`✗ No topic files found in ${DOCS_DIR}`);
    process.exit(1);
  }

  const sections = files.map((file) => {
    const { docId, body } = splitFrontmatter(
      readFileSync(join(DOCS_DIR, file), "utf8"),
    );
    const marker = docId ? `<!-- doc_id: ${docId} -->\n` : "";
    return `${marker}${body}`;
  });

  const header =
    "<!-- GENERATED FILE — do not edit. Run `npm run docs:build` after editing the topic files in docs/system/. -->\n\n";
  writeFileSync(OUTPUT, header + sections.join("\n\n---\n\n") + "\n");

  console.log(`✓ Wrote ${OUTPUT_NAME} from ${files.length} topic files.`);
}

main();
