export type GlossaryItem = { id: string; term: string; definition: string };

/**
 * 용어 목록을 본문 첫 등장 순서대로 낸다. 본문에 표시가 없는 항목은 키 순서로 뒤에 붙이고,
 * 항목 없는 표시와 중복은 버린다. 목록이 본문과 어긋나도 깨지지 않고 순서가 늘 같다.
 */
export function glossaryInOrder(
  contentHtml: string,
  glossary: Record<string, { term: string; definition: string }>,
): GlossaryItem[] {
  const seen = new Set<string>();
  const items: GlossaryItem[] = [];
  const add = (id: string) => {
    const entry = Object.hasOwn(glossary, id) ? glossary[id] : undefined;
    if (!entry || seen.has(id)) return;
    seen.add(id);
    items.push({ id, term: entry.term, definition: entry.definition });
  };
  for (const match of contentHtml.matchAll(/data-w=(?:"([^"]*)"|'([^']*)')/g)) add(match[1] ?? match[2]);
  for (const id of Object.keys(glossary)) add(id);
  return items;
}
