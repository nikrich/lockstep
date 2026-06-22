// Command lockstep-server is the Phase 0 coordination server: a Git LFS Batch
// API endpoint that brokers presigned URLs to a bring-your-own object store.
//
// Phase 0 scope (intentionally minimal): LFS upload/download only. No git
// remote, no locking, no auth yet — those are Phases 1+. The point is to
// prove end-to-end that blobs land in the customer's bucket and never touch
// this server.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/lockstep-vcs/lockstep/server/lfs"
	"github.com/lockstep-vcs/lockstep/server/storage"
)

func main() {
	ctx := context.Background()

	store, err := storage.NewS3Store(ctx, storage.S3Config{
		Bucket:    mustEnv("LOCKSTEP_BUCKET"),
		Prefix:    os.Getenv("LOCKSTEP_PREFIX"),
		Region:    envOr("LOCKSTEP_REGION", "auto"),
		Endpoint:  os.Getenv("LOCKSTEP_ENDPOINT"),
		AccessKey: mustEnv("LOCKSTEP_ACCESS_KEY"),
		SecretKey: mustEnv("LOCKSTEP_SECRET_KEY"),
		TTL:       envDuration("LOCKSTEP_PRESIGN_TTL", 15*time.Minute),
		PathStyle: envBool("LOCKSTEP_PATH_STYLE", true),
	})
	if err != nil {
		log.Fatalf("storage init: %v", err)
	}

	h := lfs.NewHandler(store)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok\n"))
	})
	// git-lfs derives this from .lfsconfig's lfs.url: {lfs.url}/objects/batch.
	// The {repo} segment is captured for future multi-tenant routing; Phase 0
	// ignores it (one bucket, one project).
	mux.HandleFunc("POST /{repo}/objects/batch", logging(h.Batch))

	addr := envOr("LOCKSTEP_ADDR", ":8080")
	log.Printf("lockstep listening on %s — blobs go direct to bucket %q, 0 bytes proxied",
		addr, os.Getenv("LOCKSTEP_BUCKET"))
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func logging(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next(w, r)
		log.Printf("%s %s %s/%s (%s)",
			r.Method, r.URL.Path, r.PathValue("repo"), "objects/batch", time.Since(start))
	}
}

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing required env var %s", k)
	}
	return v
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envBool(k string, def bool) bool {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func envDuration(k string, def time.Duration) time.Duration {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}
