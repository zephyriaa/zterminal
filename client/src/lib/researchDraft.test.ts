import { describe, expect, it } from "vitest";
import { createResearchDraftId } from "./researchDraft";

describe("research draft identity", () => {
  it("creates non-empty draft identifiers for unsynced browser drafts", () => {
    expect(createResearchDraftId()).toMatch(/.+/);
    expect(createResearchDraftId()).not.toBe(createResearchDraftId());
  });
});
