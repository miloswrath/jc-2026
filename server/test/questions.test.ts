import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { loadQuestions } from "../src/questions";

describe("loadQuestions", () => {
  it("loads a valid questions file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cards-"));
    const file = join(dir, "questions.json");
    await writeFile(
      file,
      JSON.stringify([{ id: "q1", text: "Question one" }]),
      "utf-8"
    );

    const questions = await loadQuestions(pathToFileURL(file));
    expect(questions).toEqual([{ id: "q1", text: "Question one" }]);
  });

  it("throws on invalid format", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cards-"));
    const file = join(dir, "questions.json");
    await writeFile(file, JSON.stringify({ nope: true }), "utf-8");

    await expect(loadQuestions(pathToFileURL(file))).rejects.toThrow(
      /JSON array/
    );
  });
});
