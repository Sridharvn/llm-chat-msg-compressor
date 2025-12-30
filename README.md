# llm-chat-msg-compressor 🚀

[![NPM Version](https://img.shields.io/npm/v/llm-chat-msg-compressor.svg)](https://www.npmjs.com/package/llm-chat-msg-compressor)
[![License](https://img.shields.io/npm/l/llm-chat-msg-compressor.svg)](https://github.com/Sridharvn/llm-chat-msg-compressor/blob/main/LICENSE)
[![Build Status](https://github.com/Sridharvn/llm-chat-msg-compressor/actions/workflows/test.yml/badge.svg)](https://github.com/Sridharvn/llm-chat-msg-compressor/actions)

Intelligent JSON optimizer for LLM APIs. Automatically reduces token usage by selecting the best compression strategy for your data payload.

## Features

- **🧠 Intelligent**: Analyzes payload structure to pick the best strategy
- **📉 Efficient**: Saves 10-40% input tokens on average
- **✅ Safe**: Full restoration of original data (semantic equality)
- **🔌 Easy**: Simple `optimize()` and `restore()` API

## Installation

```bash
npm install llm-chat-msg-compressor
```

## Usage

```typescript
import { optimize, restore } from "llm-chat-msg-compressor";
import OpenAI from "openai";

const data = {
  users: [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "viewer" },
    // ... 100 more users
  ],
};

// 1. Optimize before sending to LLM
const optimizedData = optimize(data);

// 2. Send to LLM
const completion = await openai.chat.completions.create({
  messages: [{ role: "user", content: JSON.stringify(optimizedData) }],
  model: "gpt-4",
});

// 3. (Optional) Restore if you need to process response in same format
// const original = restore(responseFromLLM);
```

## Strategies

The library **automatically selects** the best strategy using a smart scoring algorithm:

1. **Minify**: Standard JSON serialization (for small payloads < 500b)
2. **Schema Separation**: Separates keys from values (best for lists of uniform objects)
3. **Abbreviated Keys**: Shortens keys (best for mixed or nested payloads)
4. **Ultra Compact**: Aggressive compression (enabled with `aggressive: true`)

## Options

```typescript
optimize(data, {
  aggressive: false, // Enable UltraCompact strategy (default: false)
  unsafe: false, // Implement lossy optimizations like bool->int (default: false)
  thresholdBytes: 500, // Minimum size to attempt compression (default: 500)
});
```

### Safety & Types

By default, the library is **Safe-by-Default**. It preserves all data types (including booleans), ensuring that downstream code (e.g., in your backend or strictly typed clients) works without modification.

If you need maximum compression and your LLM can handle `1`/`0` instead of `true`/`false`, you can enable `unsafe: true`.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for our code of conduct.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
