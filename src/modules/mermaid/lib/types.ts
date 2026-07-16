export type MermaidBlockState =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "removed" };
