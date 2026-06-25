// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// Direct HTTP client for the Lockstep file-locking API — the product's moat.
// Speaks the Git-LFS Locks API surface the coordination Worker exposes:
//
//   POST   {ServerUrl}/locks            acquire        -> 201 {lock} | 409 {lock}
//   GET    {ServerUrl}/locks[?path=]    list           -> {locks:[...]}
//   POST   {ServerUrl}/locks/verify     ours vs theirs -> {ours:[...], theirs:[...]}
//   POST   {ServerUrl}/locks/{id}/unlock release       -> {lock} | 403 | 404
//
// Auth is a Lockstep Personal Access Token (lsk_...) sent as a Bearer header.
//
// THREADING: every call BLOCKS until the HTTP request completes. Completion is
// dispatched from FHttpManager::Tick on the game thread, so the client adapts:
// on a worker thread it waits on an event; on the game thread it pumps the HTTP
// manager itself until the request finishes. Safe from either context.
#pragma once

#include "CoreMinimal.h"

/** One active lock as the server reports it. */
struct FLockstepLock
{
	FString Id;          // server lock id (used to unlock)
	FString Path;        // repo-relative path, server-canonical (posix, forward slashes)
	FString OwnerName;   // display name of the holder (email / handle)
	FDateTime LockedAt;  // parsed from the ISO-8601 locked_at
	bool bIsOurs = false; // true when the current token owns the lock

	bool IsValid() const { return !Id.IsEmpty() && !Path.IsEmpty(); }
};

class FLockstepLockClient
{
public:
	FLockstepLockClient(const FString& InServerUrl, const FString& InToken);

	/** True when we have both a server URL and a token to authenticate with. */
	bool IsConfigured() const { return !ServerUrl.IsEmpty() && !Token.IsEmpty(); }

	/** GET /locks — all active locks for the repo (paged transparently). */
	bool ListLocks(TArray<FLockstepLock>& OutLocks, FString& OutError) const;

	/** POST /locks/verify — split into the caller's locks and everyone else's,
	 *  with bIsOurs set accordingly. This is the call the provider uses to refresh
	 *  state, because it tells us who holds what in one round trip. */
	bool VerifyLocks(TArray<FLockstepLock>& OutLocks, FString& OutError) const;

	/** POST /locks — acquire. On 409 (already locked) returns false and fills
	 *  OutExisting with the conflicting lock so the UI can say who holds it. */
	bool AcquireLock(const FString& Path, FLockstepLock& OutLock, FLockstepLock& OutExisting, FString& OutError) const;

	/** POST /locks/{id}/unlock — release. bForce steals another user's lock
	 *  (server still requires an admin/owner role, else 403). */
	bool ReleaseLock(const FString& LockId, bool bForce, FString& OutError) const;

private:
	// Returns false on transport failure; on an HTTP response (any status) returns
	// true and fills OutStatusCode/OutResponseBody so callers interpret status.
	bool SendBlocking(
		const FString& Verb,
		const FString& Url,
		const FString& JsonBody,
		int32& OutStatusCode,
		FString& OutResponseBody,
		FString& OutError) const;

	FString LocksUrl() const { return ServerUrl + TEXT("/locks"); }

	FString ServerUrl; // e.g. https://api.lockstepcloud.com/my-repo (no trailing slash)
	FString Token;     // lsk_... PAT
};
