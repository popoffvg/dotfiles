import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModel } from "../lib/llm.mjs";

describe("createModel", () => {
  it("throws when no API key is provided", () => {
    // Clear env vars for this test
    const saved = { ...process.env };
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      assert.throws(
        () => createModel({}),
        { message: /No API key/ }
      );
    } finally {
      Object.assign(process.env, saved);
    }
  });

  it("creates model for openrouter provider", () => {
    const model = createModel({
      llm_provider: "openrouter",
      llm_api_key: "test-key-123",
      llm_model: "anthropic/claude-sonnet-4",
    });
    assert.ok(model, "should return a model object");
  });

  it("creates model for openai provider", () => {
    const model = createModel({
      llm_provider: "openai",
      llm_api_key: "sk-test-123",
      llm_model: "gpt-4o-mini",
    });
    assert.ok(model, "should return a model object");
  });

  it("creates model for ollama provider (no real key needed)", () => {
    const model = createModel({
      llm_provider: "ollama",
      llm_model: "llama3.1",
    });
    assert.ok(model, "should return a model object");
  });

  it("supports custom base URL", () => {
    const model = createModel({
      llm_provider: "custom",
      llm_base_url: "http://localhost:8080/v1",
      llm_api_key: "test",
      llm_model: "my-model",
    });
    assert.ok(model, "should return a model object");
  });

  it("throws for unknown provider without base URL", () => {
    assert.throws(
      () => createModel({ llm_provider: "unknown", llm_api_key: "test" }),
      { message: /Unknown provider/ }
    );
  });

  it("falls back to openrouter_api_key config", () => {
    const model = createModel({
      openrouter_api_key: "sk-or-legacy-key",
    });
    assert.ok(model, "should accept legacy openrouter_api_key");
  });

  it("creates model for google provider", () => {
    const model = createModel({
      llm_provider: "google",
      llm_api_key: "AIzaSy-fake-key",
    });
    assert.ok(model, "should return a google model");
  });

  it("creates google model with custom model name", () => {
    const model = createModel({
      llm_provider: "google",
      llm_api_key: "AIzaSy-fake-key",
      llm_model: "gemini-2.5-pro",
    });
    assert.ok(model);
  });

  it("uses default model per provider", () => {
    const model = createModel({
      llm_provider: "openai",
      llm_api_key: "sk-test",
    });
    assert.ok(model);
  });
});
