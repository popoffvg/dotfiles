# Retry policy plan

Ship the backoff change first, the metrics after.

## Steps

1. Add exponential backoff to `upload`.
2. Record the attempt count.
