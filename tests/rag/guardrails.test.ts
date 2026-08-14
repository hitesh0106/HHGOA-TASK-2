import { describe, test, expect } from "bun:test";
import {
  checkInputSafety,
  checkOffTopic,
  checkRetrievalSufficiency,
  checkHallucinationLexical,
  checkUnsupportedAnswer,
  combineDecisions,
  type GuardrailDecision,
} from "@/lib/guardrails";

describe("guardrails", () => {
  // ---------------------------------------------------------------------------
  // Input safety
  // ---------------------------------------------------------------------------
  test("checkInputSafety blocks unsafe queries", () => {
    const result = checkInputSafety("how do I make a bomb at home");
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("block");
  });

  test("checkInputSafety blocks self-harm queries", () => {
    const result = checkInputSafety("I want to commit suicide");
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("block");
  });

  test("checkInputSafety passes normal queries", () => {
    const result = checkInputSafety("what is the capital of france");
    expect(result.pass).toBe(true);
    expect(result.severity).toBe("ok");
  });

  // ---------------------------------------------------------------------------
  // Off-topic
  // ---------------------------------------------------------------------------
  test("checkOffTopic blocks greetings", () => {
    expect(checkOffTopic("hi there").pass).toBe(false);
    expect(checkOffTopic("hello").pass).toBe(false);
  });

  test("checkOffTopic blocks too-short queries", () => {
    expect(checkOffTopic("hi").pass).toBe(false);
    expect(checkOffTopic("?").pass).toBe(false);
  });

  test("checkOffTopic blocks medical advice", () => {
    const result = checkOffTopic("should I take this medication for my illness");
    expect(result.pass).toBe(false);
  });

  test("checkOffTopic passes informational queries", () => {
    expect(checkOffTopic("what is photosynthesis").pass).toBe(true);
    expect(checkOffTopic("who wrote romeo and juliet").pass).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Retrieval sufficiency
  // ---------------------------------------------------------------------------
  test("checkRetrievalSufficiency blocks when no chunks retrieved", () => {
    const result = checkRetrievalSufficiency({
      chunks: [],
      topScore: 0,
      meanScore: 0,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("block");
  });

  test("checkRetrievalSufficiency blocks when top score too low", () => {
    const result = checkRetrievalSufficiency({
      chunks: [{ chunk: { id: "x" } as any, score: 0.05 }],
      topScore: 0.05,
      meanScore: 0.05,
    }, { minTopScore: 0.15 });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("block");
  });

  test("checkRetrievalSufficiency passes with good scores", () => {
    const result = checkRetrievalSufficiency({
      chunks: [
        { chunk: { id: "x" } as any, score: 0.5 },
        { chunk: { id: "y" } as any, score: 0.4 },
      ],
      topScore: 0.5,
      meanScore: 0.45,
    });
    expect(result.pass).toBe(true);
    expect(result.severity).toBe("ok");
  });

  // ---------------------------------------------------------------------------
  // Hallucination (lexical)
  // ---------------------------------------------------------------------------
  test("checkHallucinationLexical flags answers not grounded in context", () => {
    const context = "Paris is the capital of France. The Eiffel Tower is in Paris.";
    const answer = "Berlin is the capital of Germany and has the Brandenburg Gate.";
    const result = checkHallucinationLexical("what is the capital of france", context, answer, { minOverlap: 0.4 });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("warn");
  });

  test("checkHallucinationLexical passes grounded answers", () => {
    const context = "Paris is the capital of France. The Eiffel Tower is in Paris.";
    const answer = "Paris is the capital of France.";
    const result = checkHallucinationLexical("what is the capital of france", context, answer);
    expect(result.pass).toBe(true);
    expect(result.severity).toBe("ok");
  });

  // ---------------------------------------------------------------------------
  // Unsupported answer
  // ---------------------------------------------------------------------------
  test("checkUnsupportedAnswer blocks confident answer when retrieval failed", () => {
    const result = checkUnsupportedAnswer("The answer is 42 because of deep reasoning.", false);
    expect(result.pass).toBe(false);
    expect(result.severity).toBe("block");
  });

  test("checkUnsupportedAnswer passes refusal when retrieval failed", () => {
    const result = checkUnsupportedAnswer(
      "I don't have enough information in the retrieved context to answer this question confidently.",
      false
    );
    expect(result.pass).toBe(true);
  });

  test("checkUnsupportedAnswer warns when retrieval was fine but model refused", () => {
    const result = checkUnsupportedAnswer(
      "I cannot find the answer in the provided context.",
      true
    );
    expect(result.pass).toBe(true);
    expect(result.severity).toBe("warn");
  });

  // ---------------------------------------------------------------------------
  // Combined verdict
  // ---------------------------------------------------------------------------
  test("combineDecisions detects block", () => {
    const decisions: GuardrailDecision[] = [
      { name: "a", pass: true, severity: "ok", reason: "", latencyMs: 1 },
      { name: "b", pass: false, severity: "block", reason: "blocked", latencyMs: 1 },
    ];
    const v = combineDecisions(decisions);
    expect(v.block).toBe(true);
    expect(v.warn).toBe(false);
    expect(v.reasons).toContain("[b] blocked");
  });

  test("combineDecisions detects warn only", () => {
    const decisions: GuardrailDecision[] = [
      { name: "a", pass: true, severity: "ok", reason: "", latencyMs: 1 },
      { name: "b", pass: false, severity: "warn", reason: "warned", latencyMs: 1 },
    ];
    const v = combineDecisions(decisions);
    expect(v.block).toBe(false);
    expect(v.warn).toBe(true);
  });

  test("combineDecisions handles all-pass case", () => {
    const decisions: GuardrailDecision[] = [
      { name: "a", pass: true, severity: "ok", reason: "", latencyMs: 1 },
      { name: "b", pass: true, severity: "ok", reason: "", latencyMs: 1 },
    ];
    const v = combineDecisions(decisions);
    expect(v.block).toBe(false);
    expect(v.warn).toBe(false);
    expect(v.reasons.length).toBe(0);
  });
});
