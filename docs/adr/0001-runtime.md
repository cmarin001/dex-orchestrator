# 0001 Use the OpenAI Responses API

The TypeScript process calls the Responses API with native fetch. Each request includes the verbatim prompt file as `instructions`, the validated handoff context, and the agent's strict JSON schema under `text.format`. The API reference defines `text.format` for the Responses endpoint.

Each tool-enabled call has a candidate-scoped allowlist, validated arguments, and a one-use-per-tool budget. The process runs the functions and sends `function_call_output` items keyed by their original call IDs. Requests use `store: false` and carry prior output items in memory during tool rounds. The caller rejects incomplete, refused, invalid, or misidentified results.

[Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create) · [Function calling](https://developers.openai.com/api/docs/guides/function-calling) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
