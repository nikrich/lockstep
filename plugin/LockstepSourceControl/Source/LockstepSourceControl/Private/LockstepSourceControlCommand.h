// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// One queued source-control command. Snapshots everything the worker needs from
// the provider/settings on the game thread (constructor) so the worker thread
// never touches shared mutable state — same contract as the engine Git plugin.
#pragma once

#include "ISourceControlProvider.h"
#include "Misc/IQueuedWork.h"
#include "LockstepLockClient.h"

class FLockstepSourceControlCommand : public IQueuedWork
{
public:
	FLockstepSourceControlCommand(
		const TSharedRef<class ISourceControlOperation, ESPMode::ThreadSafe>& InOperation,
		const TSharedRef<class ILockstepSourceControlWorker, ESPMode::ThreadSafe>& InWorker,
		const FSourceControlOperationComplete& InOperationCompleteDelegate = FSourceControlOperationComplete());

	bool DoWork();
	virtual void Abandon() override;
	virtual void DoThreadedWork() override;

	/** Save accumulated messages and fire the completion delegate. */
	ECommandResult::Type ReturnResults();

	/** Construct a lock client from this command's connection snapshot. */
	FLockstepLockClient MakeLockClient() const { return FLockstepLockClient(ServerUrl, Token); }

public:
	// ---- connection snapshot (captured on the game thread) ----
	FString PathToGitBinary;
	FString PathToRepositoryRoot;
	FString ServerUrl;   // Lockstep API base for this repo (.lfsconfig lfs.url)
	FString Token;       // resolved Lockstep PAT (lsk_...)
	bool bSoftLockMode = false;

	// ---- operation plumbing ----
	TSharedRef<class ISourceControlOperation, ESPMode::ThreadSafe> Operation;
	TSharedRef<class ILockstepSourceControlWorker, ESPMode::ThreadSafe> Worker;
	FSourceControlOperationComplete OperationCompleteDelegate;

	volatile int32 bExecuteProcessed = 0;
	bool bCommandSuccessful = false;
	bool bAutoDelete = true;
	EConcurrency::Type Concurrency = EConcurrency::Synchronous;

	TArray<FString> Files;
	TArray<FString> InfoMessages;
	TArray<FString> ErrorMessages;
};
