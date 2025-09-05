import {
  type AdapterDebugLogs,
  type CleanedWhere,
  type CreateCustomAdapter,
  createAdapter,
} from "better-auth/adapters";
import { APIError } from "better-auth/api";
import type { FieldAttribute, FieldType } from "better-auth/db";
import Surreal, {
  type ConnectOptions,
  type Engines,
  escapeIdent,
  RecordId,
  type RecordIdValue,
  surql,
  Table,
} from "surrealdb";

interface SurrealAdapterOptions extends ConnectOptions {
  engines?: Engines;
  endpoint: string;
  debugLogs?: AdapterDebugLogs;
  usePlural?: boolean;
}

export function surrealAdapter(options?: SurrealAdapterOptions) {
  const { engines, endpoint, debugLogs, usePlural, ...connectOptions } =
    options || {};

  const surreal = new Surreal(engines ? { engines } : undefined);

  if (!endpoint) {
    throw new Error("SurrealDB endpoint is required");
  }

  const ensureConnection = async () => {
    if (surreal.status === "disconnected") {
      await surreal.connect(endpoint, connectOptions);
    }

    return surreal;
  };

  return createAdapter({
    config: {
      adapterId: "surrealdb",
      debugLogs,
      usePlural,
      supportsBooleans: true,
      supportsDates: true,
      supportsJSON: true,
      supportsNumericIds: false,
      customTransformOutput: (props) => {
        if (props.field === "id") {
          return props.data
            .replace(`${escapeIdent(props.model)}:`, "")
            .replace(/(^⟨|⟩$)/g, "")
            .replace(/\\⟩$/, "⟩");
        }

        if (props.fieldAttributes?.references) {
          return props.data
            .replace(
              `${escapeIdent(props.fieldAttributes?.references?.model)}:`,
              "",
            )
            .replace(/(^⟨|⟩$)/g, "")
            .replace(/\\⟩$/, "⟩");
        }

        return props.data;
      },
    },
    adapter: (context) => ({
      count: async ({ model, where }) => {
        const db = await ensureConnection();
        const query = generateSurrealQL(
          {
            method: "count",
            model,
            where,
          },
          context,
        );
        const [result] = await db.query<number[]>(query);
        return result || 0;
      },
      findOne: async <T>({
        model,
        where,
        select,
      }: Omit<FindOneParams, "method" | "context">) => {
        const db = await ensureConnection();
        const query = generateSurrealQL(
          {
            method: "findOne",
            model,
            where,
            select,
          },
          context,
        );
        const [[result] = []] = await db.query<T[][]>(query);
        return result || null;
      },
      findMany: async <T>({
        model,
        where,
        limit,
        sortBy,
        offset,
      }: Omit<FindManyParams, "method">) => {
        const db = await ensureConnection();
        const query = generateSurrealQL(
          {
            method: "findMany",
            model,
            where,
            limit,
            sortBy,
            offset,
          },
          context,
        );
        const [result] = await db.query<T[][]>(query);
        return result || [];
      },
      create: async <T extends Record<string, unknown>>({
        data,
        model,
        select,
      }: Omit<CreateParams<T>, "method">) => {
        const db = await ensureConnection();
        const query = generateSurrealQL(
          {
            method: "create",
            model,
            data,
            select,
          },
          context,
        );
        const [[result] = []] = await db.query<T[][]>(query);
        if (!result) {
          throw new Error("Failed to create record");
        }
        return result;
      },
      update: async <T>({
        model,
        where,
        update,
      }: Omit<UpdateParams<T>, "method">) => {
        const db = await ensureConnection();
        const query = generateSurrealQL(
          {
            method: "update",
            model,
            where,
            update,
          },
          context,
        );
        const [[result] = []] = await db.query<T[][]>(query);
        return result || null;
      },
      updateMany: async ({
        model,
        where,
        update,
      }: Omit<UpdateManyParams, "method">) => {
        const db = await ensureConnection();
        const query = generateSurrealQL(
          {
            method: "updateMany",
            model,
            where,
            update,
          },
          context,
        );
        const [result] = await db.query<number[]>(query);
        return result || 0;
      },
      delete: async <T>({ model, where }: Omit<DeleteParams, "method">) => {
        const db = await ensureConnection();
        const query = generateSurrealQL<T>(
          {
            method: "delete",
            model,
            where,
          },
          context,
        );
        await db.query<T[][]>(query);
      },
      deleteMany: async ({ model, where }) => {
        const db = await ensureConnection();
        const query = generateSurrealQL(
          {
            method: "deleteMany",
            model,
            where,
          },
          context,
        );
        const [result] = await db.query<number[]>(query);
        return result || 0;
      },
      createSchema: async ({ tables, file }) => {
        const code = [] as string[];

        for (const tableKey in tables) {
          const table = tables[tableKey];
          if (!table) continue;
          // Build table definition with permissions embedded
          const available = new Set(
            Object.values(tables)
              .filter((t: any) => !!t)
              .map((t: any) => t.modelName),
          );
          const permissions = generatePermissions(
            table.modelName,
            available,
          );
          const tableDef =
            `DEFINE TABLE ${escapeIdent(table.modelName)} SCHEMALESS` +
            (permissions ? `\n  ${permissions}` : "") +
            ";";
          code.push(tableDef);

          for (const fieldKey in table.fields) {
            const field = table.fields[fieldKey];
            if (!field) continue;

            const fieldName = field.fieldName || fieldKey;

            if (Array.isArray(field.type)) {
              throw new Error(
                `Array type not supported: ${JSON.stringify(field.type)}`,
              );
            }

            let type = (
              {
                string: "string",
                number: "number",
                boolean: "bool",
                date: "datetime",
                "number[]": "array<number>",
                "string[]": "array<string>",
              } as Record<typeof field.type & string, string>
            )[field.type];

            if (field.references) {
              // Do not escape model name inside record<> type to avoid invalid ⟨ ⟩ wrappers
              type = `record<${field.references.model}>`;
            }

            // Wrap optional types without escaping the composed generic type
            if (!field.required) {
              type = `option<${type}>`;
            }

            code.push(
              `DEFINE FIELD ${escapeIdent(fieldName)} ON TABLE ${escapeIdent(table.modelName)} TYPE ${type};`,
            );

            if (field.unique) {
              code.push(
                `DEFINE INDEX ${escapeIdent(joinCamelCase([table.modelName, table.modelName, "unique"]))} ON TABLE ${escapeIdent(table.modelName)} COLUMNS ${escapeIdent(fieldName)} UNIQUE;`,
              );
            }
          }
          code.push(``);
        }

        return {
          code: code.join("\n"),
          path: file || "./better-auth-schema.surql",
        };
      },
    }),
  });
}

export type CountParams = {
  method: "count";
  model: string;
  where?: CleanedWhere[];
};

export type FindOneParams = {
  method: "findOne";
  model: string;
  where: CleanedWhere[];
  select?: string[];
};

export type FindManyParams = {
  method: "findMany";
  model: string;
  where?: CleanedWhere[];
  limit: number;
  sortBy?: {
    field: string;
    direction: "asc" | "desc";
  };
  offset?: number;
};

export type CreateParams<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  method: "create";
  model: string;
  data: T;
  select?: string[];
};

export type UpdateParams<T> = {
  method: "update";
  model: string;
  where: CleanedWhere[];
  update: T;
};

export type UpdateManyParams = {
  method: "updateMany";
  model: string;
  where: CleanedWhere[];
  update: unknown;
};

export type DeleteParams = {
  method: "delete";
  model: string;
  where: CleanedWhere[];
};

export type DeleteManyParams = {
  method: "deleteMany";
  model: string;
  where: CleanedWhere[];
};

export type AdapterRequestParams<T> =
  | CountParams
  | FindOneParams
  | FindManyParams
  | CreateParams<T & Record<string, unknown>>
  | UpdateParams<T>
  | UpdateManyParams
  | DeleteParams
  | DeleteManyParams;

type AdapterContext = Parameters<CreateCustomAdapter>[0];

export function generateSurrealQL<T>(
  request: AdapterRequestParams<T>,
  context: AdapterContext,
) {
  const query = surql``;
  const where = [] as CleanedWhere[];
  const ids = [] as RecordId[];

  if ("where" in request && request.where) {
    for (const condition of request.where) {
      const value = condition.value;
      if (condition.field === "id") {
        if (condition.operator === "in" && Array.isArray(value)) {
          for (const id of value) {
            ids.push(new RecordId(request.model, id));
          }
          continue;
        } else if (
          condition.operator !== "starts_with" &&
          condition.operator !== "ends_with" &&
          condition.operator !== "contains"
        ) {
          ids.push(new RecordId(request.model, value as string));
          continue;
        }
      }

      where.push(condition);
    }
  }

  const model = ids.length > 0 ? ids : new Table(request.model);
  if (request.method === "count") {
    query.append`RETURN (SELECT count() FROM ${model} GROUP ALL).count`;
  } else if (request.method === "create") {
    query.append`CREATE ${model} SET `;

    const data = request.data as Record<string, unknown>;
    const dataKeys = Object.keys(data);
    for (let i = 0; i < dataKeys.length; i++) {
      const key = dataKeys[i] || "";
      const field = context.getFieldName({ model: request.model, field: key });

      // we ignore unknown fields
      if (!field) continue;

      const attributes = context.getFieldAttributes({
        model: request.model,
        field: key,
      });
      const value = request.data[key];

      if (i > 0) {
        query.append([`, `]);
      }

      if (attributes?.references) {
        query.append(
          [`${escapeIdent(field)} = `],
          new RecordId(attributes.references.model, value as string),
        );
      } else {
        query.append([`${escapeIdent(field)} = `], value);
      }
    }
  } else if (request.method === "delete" || request.method === "deleteMany") {
    if (request.method === "deleteMany") {
      query.append`RETURN (DELETE ${model}`;
    } else if (request.method === "delete") {
      query.append`DELETE ${model}`;
    }
  } else if (request.method === "update" || request.method === "updateMany") {
    if (request.method === "updateMany") {
      query.append`RETURN (UPDATE ${model} SET `;
    } else {
      query.append`UPDATE ${model} SET `;
    }

    const data = request.update as Record<string, unknown>;
    const dataKeys = Object.keys(data);
    for (let i = 0; i < dataKeys.length; i++) {
      const key = dataKeys[i] || "";
      const field = context.getFieldName({ model: request.model, field: key });
      const attributes = context.getFieldAttributes({
        model: request.model,
        field: key,
      });
      const value = data[key];
      if (i > 0) {
        query.append([`, `]);
      }

      if (attributes?.references) {
        query.append(
          [`${escapeIdent(field)} = `],
          new RecordId(attributes.references.model, value as string),
        );
      } else {
        query.append([`${escapeIdent(field)} = `], value);
      }
    }
  } else if ("select" in request && request.select) {
    query.append([
      `SELECT ${request.select.map(escapeIdent).join(", ") || "*"} FROM `,
      model as unknown as string,
    ]);
  } else {
    query.append`SELECT * FROM ${model}`;
  }

  if (where.length > 0) {
    query.append` WHERE `;
    let first = true;
    for (const condition of where) {
      const field = condition.field;
      const attributes = context.getFieldAttributes({
        model: request.model,
        field: condition.field,
      });
      const value = surrealizeValue(condition.value, attributes);

      if (first) {
        first = false;
      } else {
        query.append([` ${condition.connector} `]);
      }

      switch (condition.operator) {
        case "eq":
          query.append([`${escapeIdent(field)} = `], value);
          break;
        case "ne":
          query.append([`${escapeIdent(field)} != `], value);
          break;
        case "gt":
          query.append([`${escapeIdent(field)} > `], value);
          break;
        case "gte":
          query.append([`${escapeIdent(field)} >= `], value);
          break;
        case "lt":
          query.append([`${escapeIdent(field)} < `], value);
          break;
        case "lte":
          query.append([`${escapeIdent(field)} <= `], value);
          break;
        case "in":
          query.append([`${escapeIdent(field)} IN `], value);
          break;
        case "starts_with":
          query.append(
            [`string::starts_with(${escapeIdent(field)}, `, ")"],
            value,
          );
          break;
        case "ends_with":
          query.append(
            [`string::ends_with(${escapeIdent(field)}, `, ")"],
            value,
          );
          break;
        case "contains":
          query.append([`${escapeIdent(field)} CONTAINS `], value);
          break;
        default:
          throw new APIError(`Unsupported operator: ${condition.operator}`);
      }
    }
  }

  if ("sortBy" in request && request.sortBy) {
    const field = context.getFieldName({
      model: request.model,
      field: request.sortBy.field,
    });

    query.append([
      ` ORDER BY ${escapeIdent(field)} ${request.sortBy.direction === "asc" ? "ASC" : "DESC"}`,
    ]);
  }

  if ("limit" in request && request.limit) {
    query.append` LIMIT ${request.limit}`;
  }

  if ("offset" in request && request.offset) {
    query.append` START AT ${request.offset}`;
  }

  if (request.method === "count") {
    query.append` GROUP ALL`;
  } else if (
    request.method === "deleteMany" ||
    request.method === "updateMany"
  ) {
    query.append` RETURN true).len()`;
  }

  return query;
}

function joinCamelCase(parts: string[]) {
  let result = parts[0] || "";

  for (const part of parts.slice(1)) {
    result += part.charAt(0).toUpperCase() + part.slice(1);
  }

  return result;
}

function surrealizeValue(value: unknown, field: FieldAttribute<FieldType>) {
  // Primitives are already surrealizable, just need to convert simple id values
  // to RecordIds

  if (field.references) {
    return new RecordId(field.references.model, value as RecordIdValue);
  }

  return value;
}

type RoleSets = {
  orgAdmin: string[];
  orgOwner: string[];
  workspaceAdmin: string[];
  workspaceOwner: string[];
};

function generatePermissions(
  tableName: string,
  availableTables?: Set<string>,
  roleSets?: RoleSets,
): string | null {
  const has = (name: string) => !availableTables || availableTables.has(name);
  const lines: string[] = [];
  const inList = (roles: string[]) =>
    `[${roles.map((r) => `'${String(r).replace(/'/g, "\\'")}'`).join(", ")}]`;
  const ORG_ADMIN = roleSets?.orgAdmin || ["owner", "admin"];
  const ORG_OWNER = roleSets?.orgOwner || ["owner"];
  const WS_ADMIN = roleSets?.workspaceAdmin || ["owner", "admin"];
  const WS_OWNER = roleSets?.workspaceOwner || ["owner"];
  switch (tableName) {
    case "user":
      // Users can select/update their own record, create is handled by Better Auth adapter
      return `PERMISSIONS FOR select, update WHERE id = $auth.id`;
    case "session":
      return `PERMISSIONS FOR select WHERE userId = $auth.id FOR create, update, delete WHERE userId = $auth.id`;
    case "account":
      return `PERMISSIONS FOR select WHERE userId = $auth.id FOR create, update, delete WHERE userId = $auth.id`;
    case "verification":
      return `PERMISSIONS FOR select WHERE identifier = $auth.email FOR create, update, delete WHERE identifier = $auth.email`;
    case "passkey":
      return `PERMISSIONS FOR select WHERE userId = $auth.id FOR create, update, delete WHERE userId = $auth.id`;
    case "team": {
      lines.push("PERMISSIONS");
      const teamSelect: string[] = [];
      if (has("teamMember")) {
        teamSelect.push(
          "  FOR select WHERE id IN (SELECT teamId FROM teamMember WHERE userId = $auth.id)",
        );
      }
      if (has("member")) {
        const cond =
          `organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)})`;
        if (teamSelect.length > 0) {
          teamSelect.push(`    OR ${cond}`);
        } else {
          teamSelect.push(`  FOR select WHERE ${cond}`);
        }
        lines.push(...teamSelect);
        lines.push(
          `  FOR create WHERE ${cond}`,
          `  FOR update, delete WHERE ${cond}`,
        );
      } else if (teamSelect.length > 0) {
        lines.push(...teamSelect);
      }
      return lines.length > 1 ? lines.join("\n") : null;
    }
    case "teamMember": {
      lines.push("PERMISSIONS");
      const canSeeOwnTeam = has("teamMember");
      const hasTeamAndMember = has("team") && has("member");
      if (canSeeOwnTeam) {
        lines.push(
          "  FOR select WHERE teamId IN (SELECT teamId FROM teamMember WHERE userId = $auth.id)",
        );
      }
      if (hasTeamAndMember) {
        const cond =
          `teamId IN (SELECT id FROM team WHERE organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)}))`;
        if (canSeeOwnTeam) {
          lines.push(`    OR ${cond}`);
        } else {
          lines.push(`  FOR select WHERE ${cond}`);
        }
        lines.push(`  FOR create, update, delete WHERE ${cond}`);
      }
      return lines.length > 1 ? lines.join("\n") : null;
    }
    case "organization": {
      lines.push("PERMISSIONS");
      if (has("member")) {
        lines.push(
          "  FOR select WHERE id IN (SELECT organizationId FROM member WHERE userId = $auth.id)",
          `  FOR update, delete WHERE id IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)})`,
        );
      }
      
  // Allow authenticated creation even if member table isn't present
  lines.push("  FOR create WHERE $auth.id != null");
      return lines.length > 1 ? lines.join("\n") : null;
    }
    case "member": {
      lines.push("PERMISSIONS");
      lines.push("  FOR select WHERE userId = $auth.id");
      if (has("member")) {
        const cond =
          `organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)})`;
        lines.push(`    OR ${cond}`, `  FOR create, update, delete WHERE ${cond}`);
      }
      return lines.length > 1 ? lines.join("\n") : null;
    }
    case "invitation": {
      lines.push("PERMISSIONS");
      lines.push("  FOR select WHERE email = $auth.email");
      if (has("member")) {
        const cond =
          `organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)})`;
        lines.push(`    OR ${cond}`, `  FOR create, update, delete WHERE ${cond}`);
      }
      return lines.length > 1 ? lines.join("\n") : null;
    }
    case "workspace": {
      lines.push("PERMISSIONS");
      const hasMember = has("member");
      const hasWsMember = has("workspaceMember");
      // SELECT visibility
      if (hasMember) {
        lines.push(
          "  FOR select WHERE organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id)",
        );
      }
      if (hasWsMember) {
        if (hasMember) {
          lines.push(
            "    OR id IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id)",
          );
        } else {
          lines.push(
            "  FOR select WHERE id IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id)",
          );
        }
      }
      // CREATE/UPDATE/DELETE, tied to org roles and workspace roles if tables exist
      if (hasMember) {
        lines.push(
          `  FOR create WHERE organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)})`,
          `  FOR update WHERE organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)})`,
        );
      }
      if (hasWsMember) {
        lines.push(
          `    OR id IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id AND role IN ${inList(WS_ADMIN)})`,
        );
      }
      if (hasMember) {
        lines.push(
          `  FOR delete WHERE organizationId IN (SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)})`,
        );
      }
      if (hasWsMember) {
        lines.push(
          `    OR id IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id AND role IN ${inList(WS_OWNER)})`,
        );
      }
      return lines.length > 1 ? lines.join("\n") : null;
    }
    case "workspaceMember": {
      lines.push("PERMISSIONS");
      if (has("workspaceMember")) {
        lines.push(
          "  FOR select WHERE workspaceId IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id)",
        );
      }
      const canOrgManage = has("workspace") && has("member");
      if (canOrgManage) {
        lines.push(
          "  FOR create, update, delete WHERE workspaceId IN (",
          "      SELECT id FROM workspace WHERE organizationId IN (",
          `        SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)}`,
          "      )",
          "    )",
        );
      }
      if (has("workspaceMember")) {
        lines.push(
          `    OR workspaceId IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id AND role IN ${inList(WS_ADMIN)})`,
        );
      }
      return lines.length > 1 ? lines.join("\n") : null;
    }
    case "workspaceTeamMember": {
      lines.push("PERMISSIONS");
      if (has("workspaceMember")) {
        lines.push(
          "  FOR select WHERE workspaceId IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id)",
        );
      }
      const canOrgManage = has("workspace") && has("member");
      if (canOrgManage) {
        lines.push(
          "  FOR create, update, delete WHERE workspaceId IN (",
          "      SELECT id FROM workspace WHERE organizationId IN (",
          `        SELECT organizationId FROM member WHERE userId = $auth.id AND role IN ${inList(ORG_ADMIN)}`,
          "      )",
          "    )",
        );
      }
      if (has("workspaceMember")) {
        lines.push(
          `    OR workspaceId IN (SELECT workspaceId FROM workspaceMember WHERE userId = $auth.id AND role IN ${inList(WS_ADMIN)})`,
        );
      }
      return lines.length > 1 ? lines.join("\n") : null;
    }
    default:
      return null;
  }
}
