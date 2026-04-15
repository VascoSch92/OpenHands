import { describe, expect, test } from "vitest";
import { getCombinedMetrics } from "#/utils/conversation-metrics";
import type { V1RuntimeConversationInfo } from "#/api/conversation-service/v1-conversation-service.types";

const buildInfo = (
  usageToMetrics: Record<string, unknown>,
): V1RuntimeConversationInfo =>
  ({
    stats: { usage_to_metrics: usageToMetrics },
  }) as unknown as V1RuntimeConversationInfo;

describe("getCombinedMetrics", () => {
  test("returns empty snapshot when stats are missing", () => {
    const result = getCombinedMetrics({} as V1RuntimeConversationInfo);
    expect(result).toEqual({
      accumulated_cost: 0,
      max_budget_per_task: null,
      accumulated_token_usage: null,
    });
  });

  test("does not let a zeroed condenser clobber the agent's per_turn_token and context_window", () => {
    const info = buildInfo({
      agent: {
        accumulated_cost: 0.18,
        max_budget_per_task: null,
        accumulated_token_usage: {
          prompt_tokens: 90503,
          completion_tokens: 1228,
          cache_read_tokens: 71414,
          cache_write_tokens: 18744,
          context_window: 200000,
          per_turn_token: 18877,
        },
      },
      condenser: {
        accumulated_cost: 0,
        max_budget_per_task: null,
        accumulated_token_usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          context_window: 0,
          per_turn_token: 0,
        },
      },
    });

    const result = getCombinedMetrics(info);

    expect(result.accumulated_cost).toBeCloseTo(0.18);
    expect(result.accumulated_token_usage).toEqual({
      prompt_tokens: 90503,
      completion_tokens: 1228,
      cache_read_tokens: 71414,
      cache_write_tokens: 18744,
      context_window: 200000,
      per_turn_token: 18877,
    });
  });

  test("sums token counts and takes max of context_window and per_turn_token across entries", () => {
    const info = buildInfo({
      a: {
        accumulated_cost: 1,
        max_budget_per_task: 10,
        accumulated_token_usage: {
          prompt_tokens: 100,
          completion_tokens: 10,
          cache_read_tokens: 5,
          cache_write_tokens: 2,
          context_window: 100000,
          per_turn_token: 50,
        },
      },
      b: {
        accumulated_cost: 2,
        max_budget_per_task: null,
        accumulated_token_usage: {
          prompt_tokens: 200,
          completion_tokens: 20,
          cache_read_tokens: 7,
          cache_write_tokens: 3,
          context_window: 200000,
          per_turn_token: 75,
        },
      },
    });

    const result = getCombinedMetrics(info);

    expect(result.accumulated_cost).toBe(3);
    expect(result.max_budget_per_task).toBe(10);
    expect(result.accumulated_token_usage).toEqual({
      prompt_tokens: 300,
      completion_tokens: 30,
      cache_read_tokens: 12,
      cache_write_tokens: 5,
      context_window: 200000,
      per_turn_token: 75,
    });
  });
});
