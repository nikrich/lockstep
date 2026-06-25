// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// Secure, per-user storage for the Lockstep access token. On Windows this is the
// Credential Manager (CredWrite/CredRead — DPAPI-encrypted at rest, scoped to the
// OS user). The token is keyed by API host so different servers don't collide.
// Other platforms currently return false (Win64 is the shipped target).
#pragma once

#include "CoreMinimal.h"

namespace LockstepCredentials
{
	/** Store the access token for an API host (e.g. "api.lockstepcloud.com"). */
	bool Save(const FString& Host, const FString& Token);

	/** Load a previously stored token. Returns false if none. */
	bool Load(const FString& Host, FString& OutToken);

	/** Remove the stored token (sign out). */
	bool Delete(const FString& Host);

	/** True if a token is stored for the host. */
	bool Has(const FString& Host);
}
