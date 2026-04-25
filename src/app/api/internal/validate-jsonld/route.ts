import { requireInternalAuth } from "@/lib/agent-auth";

export const runtime = "nodejs";

type ValidateBody = {
  schemaJson: string;
};

type Result = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  typesFound: string[];
};

type SchemaNode = {
  "@type"?: string | string[];
  "@context"?: string | Record<string, unknown>;
  "@graph"?: unknown;
  [key: string]: unknown;
};

function isValidateBody(v: unknown): v is ValidateBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.schemaJson === "string";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nodeTypes(node: SchemaNode): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function checkContext(root: SchemaNode, errors: string[]): void {
  const ctx = root["@context"];
  if (ctx === undefined) {
    errors.push("Missing @context");
    return;
  }
  if (typeof ctx === "string") {
    if (!ctx.includes("schema.org")) {
      errors.push(`@context must reference schema.org (got "${ctx}")`);
    }
    return;
  }
  if (isObject(ctx)) {
    const stringified = JSON.stringify(ctx);
    if (!stringified.includes("schema.org")) {
      errors.push("@context must reference schema.org");
    }
    return;
  }
  errors.push("@context must be a string or object");
}

function collectTypedNodes(root: SchemaNode): SchemaNode[] {
  const nodes: SchemaNode[] = [];
  const graph = root["@graph"];
  if (Array.isArray(graph)) {
    for (const g of graph) {
      if (isObject(g)) nodes.push(g as SchemaNode);
    }
    return nodes;
  }
  // No @graph: treat the root itself as a single typed node.
  if (nodeTypes(root).length > 0) nodes.push(root);
  return nodes;
}

function validateArticle(node: SchemaNode, errors: string[], warnings: string[]): void {
  if (!node.headline) errors.push("Article: missing required field `headline`");
  if (!node.author) errors.push("Article: missing required field `author`");
  if (!node.datePublished) {
    errors.push("Article: missing required field `datePublished`");
  }
  if (!node.image) warnings.push("Article: recommended field `image` missing");
  if (!node.dateModified) {
    warnings.push("Article: recommended field `dateModified` missing");
  }
  if (!node.mainEntityOfPage) {
    warnings.push("Article: recommended field `mainEntityOfPage` missing");
  }
}

function validateFaqPage(node: SchemaNode, errors: string[]): void {
  const main = node.mainEntity;
  if (!Array.isArray(main) || main.length === 0) {
    errors.push("FAQPage: requires `mainEntity` array of Question nodes");
    return;
  }
  main.forEach((q, idx) => {
    if (!isObject(q)) {
      errors.push(`FAQPage.mainEntity[${idx}]: not an object`);
      return;
    }
    const qNode = q as SchemaNode;
    const qTypes = nodeTypes(qNode);
    if (!qTypes.includes("Question")) {
      errors.push(`FAQPage.mainEntity[${idx}]: must be of @type Question`);
    }
    if (!qNode.name) {
      errors.push(`FAQPage.mainEntity[${idx}]: Question requires \`name\``);
    }
    if (!qNode.acceptedAnswer) {
      errors.push(
        `FAQPage.mainEntity[${idx}]: Question requires \`acceptedAnswer\``,
      );
    }
  });
}

function validateHowTo(node: SchemaNode, errors: string[]): void {
  const steps = node.step;
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push("HowTo: requires `step` array");
  }
}

function validateProduct(node: SchemaNode, errors: string[], warnings: string[]): void {
  if (!node.name) errors.push("Product: missing required field `name`");
  if (!node.offers) warnings.push("Product: recommended field `offers` missing");
  if (!node.aggregateRating) {
    warnings.push("Product: recommended field `aggregateRating` missing");
  }
}

function validateBreadcrumb(node: SchemaNode, errors: string[]): void {
  const items = node.itemListElement;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("BreadcrumbList: requires `itemListElement` array");
    return;
  }
  items.forEach((it, idx) => {
    if (!isObject(it)) {
      errors.push(`BreadcrumbList.itemListElement[${idx}]: not an object`);
      return;
    }
    if ((it as SchemaNode).position === undefined) {
      errors.push(
        `BreadcrumbList.itemListElement[${idx}]: missing \`position\``,
      );
    }
  });
}

function validateNode(
  node: SchemaNode,
  errors: string[],
  warnings: string[],
  typesFound: Set<string>,
): void {
  const types = nodeTypes(node);
  if (types.length === 0) {
    warnings.push("Node has no @type");
    return;
  }
  for (const t of types) {
    typesFound.add(t);
    switch (t) {
      case "Article":
      case "NewsArticle":
      case "BlogPosting":
        validateArticle(node, errors, warnings);
        break;
      case "FAQPage":
        validateFaqPage(node, errors);
        break;
      case "HowTo":
        validateHowTo(node, errors);
        break;
      case "Product":
        validateProduct(node, errors, warnings);
        break;
      case "BreadcrumbList":
        validateBreadcrumb(node, errors);
        break;
      default:
        // Unknown @type: not an error, just no required-field check.
        break;
    }
  }
}

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isValidateBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { schemaJson } = parsed;

  const errors: string[] = [];
  const warnings: string[] = [];
  const typesFound = new Set<string>();

  let root: SchemaNode;
  try {
    const decoded = JSON.parse(schemaJson) as unknown;
    if (!isObject(decoded)) {
      const result: Result = {
        valid: false,
        errors: ["Top-level JSON-LD must be an object"],
        warnings: [],
        typesFound: [],
      };
      return Response.json(result);
    }
    root = decoded as SchemaNode;
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    const result: Result = {
      valid: false,
      errors: [`JSON parse error: ${detail}`],
      warnings: [],
      typesFound: [],
    };
    return Response.json(result);
  }

  checkContext(root, errors);

  const nodes = collectTypedNodes(root);
  if (nodes.length === 0) {
    errors.push("No typed nodes found (no @graph entries and root has no @type)");
  }
  for (const node of nodes) {
    validateNode(node, errors, warnings, typesFound);
  }

  const result: Result = {
    valid: errors.length === 0,
    errors,
    warnings,
    typesFound: Array.from(typesFound),
  };
  return Response.json(result);
}
