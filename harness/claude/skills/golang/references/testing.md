# Testing

## Tools

| Need | Package | Rule |
| --- | --- | --- |
| Assertions | `github.com/stretchr/testify` | `require` for a step the test cannot go on without, `assert` for the checks after it. No `suite` package: a table test and `t.Cleanup` cover it. A test MUST NOT call `t.Fatal`, `t.Fatalf`, `t.Error`, or `t.Errorf`: write `require.NoError(t, err)`, not `if err != nil { t.Fatal(err) }`. |
| Test data | `github.com/brianvoe/gofakeit/v7` | Build values from a seeded `*gofakeit.Faker`. Log the seed, so a failure replays. |
| DB fixtures | `github.com/go-testfixtures/testfixtures/v3` | YAML files, one per table, under `testdata/fixtures/`. Load before each test that reads the DB. |
| Real dependencies | `github.com/testcontainers/testcontainers-go` and its modules (`modules/postgres`) | One container per test package, started in `TestMain`. |
| API scenarios | Hurl (`hurl --test`) | Plain-text `.hurl` files under `tests/api/`, run against a server that runs for real. |

testfixtures wins over hand-written `INSERT` helpers and over `go-txdb`: the rows live in files a reviewer reads, and it refuses a database whose name does not contain `test`.

## Layers

| Layer | What runs | Dependencies | Tools |
| --- | --- | --- | --- |
| Unit | Domain types and services | Fakes of the repository interfaces | testify, gofakeit |
| Adapter | One repository against a real DB | Postgres in testcontainers | testify, testfixtures |
| API | The real router through `httptest` | Fake `TokenVerifier`, fake repositories | testify, gofakeit |
| E2E | The built server | All of them in testcontainers | Hurl |

A unit test MUST NOT do I/O. An adapter test MUST NOT mock the driver: a mock of SQL proves nothing about SQL.

## Unit test

```go
func TestNewEmail(t *testing.T) {
	f := newFaker(t)
	tests := []struct {
		name    string
		in      string
		wantErr error
	}{
		{"valid", f.Email(), nil},
		{"no at sign", f.Word(), ErrEmailFormat},
		{"empty", "", ErrEmailFormat},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewEmail(tt.in)
			require.ErrorIs(t, err, tt.wantErr)
		})
	}
}

func newFaker(t *testing.T) *gofakeit.Faker {
	t.Helper()
	seed := rand.Uint64()
	t.Logf("gofakeit seed %d", seed)
	return gofakeit.New(seed)
}
```

A boundary case (empty, too long, zero) MUST be a literal row, not a fake value: a fake value hits the boundary only by chance.

## Adapter test

```go
var (
	testDB   *sql.DB
	fixtures *testfixtures.Loader
)

func TestMain(m *testing.M) {
	ctx := context.Background()
	ctr, err := postgres.Run(ctx, "postgres:16-alpine",
		postgres.WithDatabase("app_test"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		log.Fatalf("postgres container: %v", err)
	}
	dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("postgres dsn: %v", err)
	}
	testDB, err = sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("postgres open: %v", err)
	}
	if err := migrate(ctx, testDB); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	fixtures, err = testfixtures.New(
		testfixtures.Database(testDB),
		testfixtures.Dialect("postgres"),
		testfixtures.Directory("testdata/fixtures"),
	)
	if err != nil {
		log.Fatalf("fixtures: %v", err)
	}

	code := m.Run()
	_ = testcontainers.TerminateContainer(ctr)
	os.Exit(code)
}

func TestNotesLock(t *testing.T) {
	require.NoError(t, fixtures.Load())
	repo := NewNotes(testDB)
	// ...
}
```

- The migrations under test MUST be the migrations that ship. Never a schema copied into `testdata`.
- `fixtures.Load` resets the fixture tables, so tests in one package MUST NOT call `t.Parallel`.
- An E2E or adapter test needs Docker. Mark the file `//go:build e2e` when CI has no Docker on the unit job.

## API test

```go
func TestGetNote(t *testing.T) {
	srv, err := NewServer("", slog.New(slog.DiscardHandler), fakeVerifier{"good": testUser}, users.NewService(&memNotes{}))
	require.NoError(t, err)
	tests := []struct {
		name       string
		token      string
		wantStatus int
	}{
		{"valid token", "good", http.StatusOK},
		{"no token", "", http.StatusUnauthorized},
		{"wrong token", "bad", http.StatusUnauthorized},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/notes/1", nil)
			if tt.token != "" {
				req.Header.Set("Authorization", "Bearer "+tt.token)
			}
			rec := httptest.NewRecorder()
			srv.Handler.ServeHTTP(rec, req)
			assert.Equal(t, tt.wantStatus, rec.Code)
		})
	}
}
```

Test through `srv.Handler`, the same router and middleware that ship, not through the handler function alone.

Every secured operation MUST have one test without a token that expects 401.

## E2E with Hurl

```hurl
# tests/api/notes.hurl
POST {{base_url}}/notes
Authorization: Bearer {{token}}
{"title": "first"}
HTTP 201
[Captures]
note_id: jsonpath "$.id"

GET {{base_url}}/notes/{{note_id}}
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.title" == "first"
```

```go
//go:build e2e

func TestAPI(t *testing.T) {
	baseURL := startStack(t) // testcontainers: Postgres + the server image
	cmd := exec.Command("hurl", "--test",
		"--variable", "base_url="+baseURL,
		"--variable", "token="+testToken,
		"--glob", "tests/api/*.hurl")
	out, err := cmd.CombinedOutput()
	require.NoError(t, err, string(out))
}
```

- A `.hurl` file is one user scenario, read top to bottom. It captures ids from responses and never hard-codes them.
- The server runs as the image that ships, built from the repo `Dockerfile` with `testcontainers.FromDockerfile`. A server started in the test process skips the build, the config loading, and the flags.
