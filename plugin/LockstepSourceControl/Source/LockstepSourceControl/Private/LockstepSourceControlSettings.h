// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// Connection settings for the Lockstep provider, persisted to the editor's
// SourceControl ini (section [LockstepSourceControl.LockstepSourceControlSettings]).
//
// We deliberately do NOT persist the Personal Access Token here in plaintext.
// git/git-lfs already store it in the OS credential helper; the lock client
// reads it from there at runtime (see FLockstepLockClient). Only the server
// URL, repo slug, and the resolved git binary/working-copy paths live in ini.
#pragma once

#include "CoreMinimal.h"
#include "Misc/ScopeLock.h"

class FLockstepSourceControlSettings
{
public:
	/** API base for this repo, e.g. https://api.lockstepcloud.com/my-repo .
	 *  This is exactly the {lfs.url} from the project's .lfsconfig — the locks
	 *  API lives at {ServerUrl}/locks and the LFS batch at {ServerUrl}/objects/batch. */
	FString GetServerUrl() const;
	void SetServerUrl(const FString& InServerUrl);

	/** Absolute path to the git executable (auto-detected, user-overridable). */
	FString GetGitBinaryPath() const;
	void SetGitBinaryPath(const FString& InGitBinaryPath);

	/** Repo slug captured by the server (last path segment of ServerUrl). */
	FString GetRepoSlug() const;

	/** Scheme+host of the API, e.g. "https://api.lockstepcloud.com" (no path).
	 *  The auth endpoints live here, not under the per-repo ServerUrl. */
	FString GetApiOrigin() const;

	/** Host only, e.g. "api.lockstepcloud.com" — the credential-store key. */
	FString GetApiHost() const;

	/** Root of the git working copy that contains the UE project. */
	FString GetWorkingCopyRoot() const;
	void SetWorkingCopyRoot(const FString& InRoot);

	/** Advisory ("soft") locking: warn on collision instead of blocking save. */
	bool IsSoftLockMode() const;
	void SetSoftLockMode(bool bInSoft);

	/** Load from / save to GConfig (GSourceControlIni). */
	void LoadSettings();
	void SaveSettings() const;

private:
	mutable FCriticalSection CriticalSection;

	FString ServerUrl;
	FString GitBinaryPath;
	FString WorkingCopyRoot;
	bool bSoftLockMode = false;
};
