import { readFile } from "node:fs/promises";
import { Question } from "./types";

type RawQuestion = {
  id?: unknown;
  text?: unknown;
};

export async function loadQuestions(path: URL): Promise<Question[]> {
  const raw = await readFile(path, "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("Questions config must be a JSON array.");
  }

  const questions: Question[] = data.map((entry: RawQuestion, index) => {
    if (typeof entry?.id !== "string" || typeof entry?.text !== "string") {
      throw new Error(`Question at index ${index} must have id and text.`);
    }

    return { id: entry.id, text: entry.text };
  });

  if (questions.length === 0) {
    throw new Error("Questions config must include at least one question.");
  }

  return questions;
}
