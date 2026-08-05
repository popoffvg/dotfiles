# Retry policy spec

The service retries a failed upload **twice**, then gives up.
There is no backoff between attempts.

## Open questions

- Should the second attempt wait?
- What happens to the partial upload?

```ts
async function upload(file: File): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await put(file);
  }
}
```

> A retry without backoff is a retry storm.

| Attempt | Delay | Result |
| --- | --- | --- |
| 1 | 0ms | maybe |
| 2 | 0ms | maybe |

See the [upload notes](https://example.com/notes) for the original decision.
