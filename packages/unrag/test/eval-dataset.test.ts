import { describe, expect, test } from "bun:test";
import { parseEvalDataset } from "../registry/eval/dataset";

describe("eval dataset parsing", () => {
  test("parses minimal valid dataset", () => {
    const ds = parseEvalDataset({
      version: "1",
      id: "mini",
      defaults: { scopePrefix: "eval:mini:", topK: 5, mode: "retrieve" },
      queries: [
        {
          id: "q1",
          query: "hello",
          relevant: { sourceIds: ["eval:mini:doc:a"] },
        },
      ],
    });

    expect(ds.version).toBe("1");
    expect(ds.id).toBe("mini");
    expect(ds.defaults.scopePrefix).toBe("eval:mini:");
    expect(ds.queries.length).toBe(1);
  });

  test("requires defaults.scopePrefix", () => {
    expect(() =>
      parseEvalDataset({
        version: "1",
        id: "bad",
        defaults: {},
        queries: [
          {
            id: "q1",
            query: "hello",
            relevant: { sourceIds: ["x"] },
          },
        ],
      })
    ).toThrow();
  });

  test("requires documents to include content or loaderRef", () => {
    expect(() =>
      parseEvalDataset({
        version: "1",
        id: "bad-docs",
        defaults: { scopePrefix: "eval:bad:" },
        documents: [{ sourceId: "eval:bad:doc:1" }],
        queries: [
          { id: "q1", query: "hello", relevant: { sourceIds: ["eval:bad:doc:1"] } },
        ],
      })
    ).toThrow();
  });
});

