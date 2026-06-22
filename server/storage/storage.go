// Package storage abstracts the customer's bring-your-own object store.
//
// The defining property of Lockstep: blob bytes never pass through the
// coordination server. Implementations hand out short-lived presigned URLs;
// clients stream bytes directly to/from the bucket. That is the entire cost
// story — the server only ever sees pointers and metadata.
package storage

import "context"

// Link is a presigned URL plus any headers the client must replay when it
// performs the transfer.
type Link struct {
	Href      string
	Header    map[string]string
	ExpiresIn int // seconds until the URL expires
}

// Store brokers blob transfers to an object store via presigned URLs.
//
// Any S3-compatible backend (Cloudflare R2, Backblaze B2, Wasabi, MinIO, or
// AWS S3 itself) satisfies this through a single implementation — see S3Store.
type Store interface {
	// Exists reports whether a blob is already present, so uploads can be
	// skipped and downloads of missing objects can fail fast.
	Exists(ctx context.Context, oid string) (bool, error)

	// PresignUpload returns a URL the client PUTs the blob to.
	PresignUpload(ctx context.Context, oid string, size int64) (*Link, error)

	// PresignDownload returns a URL the client GETs the blob from.
	PresignDownload(ctx context.Context, oid string) (*Link, error)
}
