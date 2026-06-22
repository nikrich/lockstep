# Contributing to Lockstep

Thanks for your interest! Non-production use — evaluation, development, and
contributing — is open to everyone under the [license](LICENSE).

## Before you start

- Read [`docs/architecture.md`](docs/architecture.md) to understand the design
  and which **phase** the project is in. Please open an issue to discuss
  anything larger than a bug fix before writing code.
- By contributing, you agree your contributions are licensed under the same
  terms as the project (BSL 1.1, converting to Apache 2.0 per the schedule).

## Development

```bash
go mod tidy
go vet ./...
go test ./... -race
```

The LFS protocol logic is tested against an in-memory `Store`
(`server/storage/mem.go`), so most tests need **no cloud credentials**. Only
end-to-end runs against a real bucket need keys (see the README).

## Style

- Standard Go: `gofmt` (run `go fmt ./...`), idiomatic error wrapping with
  `%w`, small focused packages.
- Keep the core invariant sacred: **blob bytes never pass through the
  server.** Anything that would proxy object data through the coordination
  server is a design bug.

## Reporting security issues

Please do not open public issues for security vulnerabilities. Email
**jannik811@gmail.com** instead.
