import type { IntrospectedSchema } from "../types/connection.js";

const MAX_DDL_LENGTH = 4000;

/**
 * Convert an IntrospectedSchema to a compact DDL-like string representation.
 * One line per table, showing column names, types, PK/FK annotations.
 *
 * Example output:
 *   links(id uuid PK, user_id uuid FK->user_profiles.id, url text, created_at timestamptz)
 *   click_logs(id uuid PK, link_id uuid FK->links.id, clicked_at timestamptz, country text)
 */
export function introspectedSchemaToDDL(schema: IntrospectedSchema): string {
  const lines = schema.tables.map((t) => {
    const cols = t.columns
      .map((c) => {
        let desc = `${c.name} ${c.dataType}`;
        if (c.isPrimaryKey) desc += " PK";
        if (c.isForeignKey && c.foreignTable && c.foreignColumn) {
          desc += ` FK->${c.foreignTable}.${c.foreignColumn}`;
        }
        return desc;
      })
      .join(", ");
    return `${t.name}(${cols})`;
  });

  const full = lines.join("\n");
  if (full.length <= MAX_DDL_LENGTH) return full;

  // Truncate: keep as many complete table lines as fit within the limit
  let result = "";
  for (const line of lines) {
    if (result.length + line.length + 1 > MAX_DDL_LENGTH) break;
    result += (result ? "\n" : "") + line;
  }
  return result;
}
