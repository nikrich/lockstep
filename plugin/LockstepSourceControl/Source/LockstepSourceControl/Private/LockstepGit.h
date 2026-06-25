// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// Thin wrapper over the git/git-lfs CLI: locate the binary, run commands, find
// the working-copy root, parse `git status`, and map paths. Lockstep delegates
// all *content* (history, push/pull) to git/git-lfs and layers locking on top
// via the HTTP lock client — so this is intentionally minimal.
#pragma once

#include "CoreMinimal.h"

enum class ELockstepWorkingState : uint8; // LockstepSourceControlState.h

namespace LockstepGit
{
	/** Best-effort path to a working `git` executable (PATH + common installs). */
	FString FindGitBinaryPath();

	/** Run a git version probe; true if the binary works. Fills OutVersion. */
	bool CheckGitAvailability(const FString& GitBinary, FString& OutVersion);

	/** Walk up from InStartDir to find the dir containing `.git`. */
	bool FindRepositoryRoot(const FString& InStartDir, FString& OutRepositoryRoot);

	/** `git config user.email` (repo, else global) — used as the lock-owner identity hint. */
	bool GetUserEmail(const FString& GitBinary, const FString& RepoRoot, FString& OutEmail);

	/** Synchronous git invocation with working dir = RepoRoot. Returns exit==0. */
	bool RunCommand(
		const FString& GitBinary,
		const FString& RepoRoot,
		const FString& Command,
		const TArray<FString>& Parameters,
		const TArray<FString>& Files,
		FString& OutStdOut,
		FString& OutStdErr);

	/** Parse `git status --porcelain` for InFiles into absolute-path -> state.
	 *  Files not reported are assumed tracked & unmodified. */
	bool RunStatus(
		const FString& GitBinary,
		const FString& RepoRoot,
		const TArray<FString>& InAbsoluteFiles,
		TMap<FString, ELockstepWorkingState>& OutStates,
		TArray<FString>& OutErrors);

	/** True if the file matches a `lockable` .gitattributes pattern. */
	bool IsFileLockable(const FString& GitBinary, const FString& RepoRoot, const FString& AbsoluteFile);

	/** Absolute path -> repo-relative, forward-slashed (the server's lock key). */
	FString AbsoluteToRepoRelative(const FString& RepoRoot, const FString& AbsoluteFile);

	/** Repo-relative posix path -> absolute local path. */
	FString RepoRelativeToAbsolute(const FString& RepoRoot, const FString& RelativePath);

	/** Resolve a Lockstep PAT: $LOCKSTEP_TOKEN, else the git credential helper. */
	FString ResolveAccessToken(const FString& GitBinary, const FString& RepoRoot, const FString& ServerUrl);
}
