import { describe, expect, it, vi } from "vitest";
import { isInside, routeOpenRequest } from "./useOpenRequests";

function handlers(rootPath: string | null) {
  return {
    rootPath,
    setRoot: vi.fn(),
    openInVault: vi.fn(),
    openElsewhere: vi.fn(),
  };
}

describe("routeOpenRequest", () => {
  it("adopts the file's folder when no vault is open", () => {
    const h = handlers(null);
    const root = routeOpenRequest("/v/notes/a.md", h);
    expect(root).toBe("/v/notes");
    expect(h.setRoot).toHaveBeenCalledWith("/v/notes");
    expect(h.openInVault).toHaveBeenCalledWith("/v/notes/a.md");
  });

  it("opens a tab for files inside the vault", () => {
    const h = handlers("/v");
    routeOpenRequest("/v/sub/a.md", h);
    expect(h.openInVault).toHaveBeenCalledWith("/v/sub/a.md");
    expect(h.openElsewhere).not.toHaveBeenCalled();
  });

  it("opens a window for files outside the vault", () => {
    const h = handlers("/v");
    routeOpenRequest("/other/a.md", h);
    expect(h.openElsewhere).toHaveBeenCalledWith("/other/a.md");
    expect(h.setRoot).not.toHaveBeenCalled();
  });

  it("does not treat a sibling with the same prefix as inside", () => {
    expect(isInside("/v", "/vault/a.md")).toBe(false);
    expect(isInside("/v/", "/v/a.md")).toBe(true);
  });
});
