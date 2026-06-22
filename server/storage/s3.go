package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

// S3Config configures an S3-compatible Store.
//
// For Cloudflare R2: set Endpoint to https://<accountid>.r2.cloudflarestorage.com
// and Region to "auto". For Backblaze B2 / Wasabi / MinIO: set Endpoint to the
// provider's S3 endpoint. Leave Endpoint empty for AWS S3 itself.
type S3Config struct {
	Bucket    string
	Prefix    string // optional key prefix within the bucket
	Region    string
	Endpoint  string
	AccessKey string
	SecretKey string
	TTL       time.Duration // presigned URL lifetime
	PathStyle bool          // path-style addressing (required by MinIO; safe for R2/B2)
}

// S3Store implements Store against any S3-compatible object store.
type S3Store struct {
	presign *s3.PresignClient
	client  *s3.Client
	bucket  string
	prefix  string
	ttl     time.Duration
}

// NewS3Store builds a Store from static credentials and an optional custom
// endpoint. It performs no network I/O.
func NewS3Store(ctx context.Context, cfg S3Config) (*S3Store, error) {
	if cfg.Bucket == "" {
		return nil, errors.New("storage: bucket is required")
	}
	if cfg.Region == "" {
		cfg.Region = "auto" // R2's expected region value
	}
	if cfg.TTL == 0 {
		cfg.TTL = 15 * time.Minute
	}

	awsCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("storage: load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
		o.UsePathStyle = cfg.PathStyle
	})

	return &S3Store{
		presign: s3.NewPresignClient(client),
		client:  client,
		bucket:  cfg.Bucket,
		prefix:  cfg.Prefix,
		ttl:     cfg.TTL,
	}, nil
}

// key returns the object key for an oid using the standard sharded LFS layout
// (ab/cd/abcd...), optionally under a configured prefix.
func (s *S3Store) key(oid string) string {
	k := oid
	if len(oid) >= 4 {
		k = fmt.Sprintf("%s/%s/%s", oid[0:2], oid[2:4], oid)
	}
	if s.prefix != "" {
		return s.prefix + "/" + k
	}
	return k
}

func (s *S3Store) Exists(ctx context.Context, oid string) (bool, error) {
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(oid)),
	})
	if err == nil {
		return true, nil
	}

	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "NotFound", "NoSuchKey":
			return false, nil
		}
	}
	return false, fmt.Errorf("storage: head %s: %w", oid, err)
}

func (s *S3Store) PresignUpload(ctx context.Context, oid string, size int64) (*Link, error) {
	// Deliberately do not sign Content-Length: the git-lfs "basic" transfer
	// sets it itself, and leaving it unsigned avoids signature mismatches
	// across providers.
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(oid)),
	}, s3.WithPresignExpires(s.ttl))
	if err != nil {
		return nil, fmt.Errorf("storage: presign upload %s: %w", oid, err)
	}
	return &Link{Href: req.URL, Header: map[string]string{}, ExpiresIn: int(s.ttl.Seconds())}, nil
}

func (s *S3Store) PresignDownload(ctx context.Context, oid string) (*Link, error) {
	req, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(oid)),
	}, s3.WithPresignExpires(s.ttl))
	if err != nil {
		return nil, fmt.Errorf("storage: presign download %s: %w", oid, err)
	}
	return &Link{Href: req.URL, Header: map[string]string{}, ExpiresIn: int(s.ttl.Seconds())}, nil
}
