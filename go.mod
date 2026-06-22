module github.com/lockstep-vcs/lockstep

go 1.22

// Run `go mod tidy` to download these and generate go.sum.
// Versions below are a known-good starting point; tidy will reconcile them.
require (
	github.com/aws/aws-sdk-go-v2 v1.30.3
	github.com/aws/aws-sdk-go-v2/config v1.27.27
	github.com/aws/aws-sdk-go-v2/credentials v1.17.27
	github.com/aws/aws-sdk-go-v2/service/s3 v1.58.2
	github.com/aws/smithy-go v1.20.3
)
