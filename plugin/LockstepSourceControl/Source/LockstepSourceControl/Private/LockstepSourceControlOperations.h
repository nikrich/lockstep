// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// One worker per ISourceControlOperation. Execute() runs (possibly off-thread)
// and stashes results; UpdateStates() applies them to the provider cache on the
// game thread. The lock-bearing operations (CheckOut acquires, Revert releases)
// call the Lockstep lock API; the rest delegate to git.
#pragma once

#include "ILockstepSourceControlWorker.h"
#include "LockstepSourceControlState.h"

/** Result the workers build during Execute and replay in UpdateStates. */
struct FLockstepStatusResult
{
	FString LocalFilename;
	ELockstepWorkingState WorkingState = ELockstepWorkingState::Unknown;
	ELockstepLockState LockState = ELockstepLockState::NotLocked;
	bool bIsLockable = false;
	FString LockId;
	FString LockOwner;
	FDateTime LockedAt = FDateTime(0);
};

#define LOCKSTEP_DECLARE_WORKER(WorkerClass, OperationName)                          \
	class WorkerClass : public ILockstepSourceControlWorker                          \
	{                                                                                \
	public:                                                                          \
		virtual ~WorkerClass() {}                                                    \
		virtual FName GetName() const override { return OperationName; }             \
		virtual bool Execute(class FLockstepSourceControlCommand& InCommand) override;\
		virtual bool UpdateStates() const override;                                  \
		TArray<FLockstepStatusResult> States;                                        \
	};

LOCKSTEP_DECLARE_WORKER(FLockstepConnectWorker, "Connect")
LOCKSTEP_DECLARE_WORKER(FLockstepUpdateStatusWorker, "UpdateStatus")
LOCKSTEP_DECLARE_WORKER(FLockstepCheckOutWorker, "CheckOut")
LOCKSTEP_DECLARE_WORKER(FLockstepCheckInWorker, "CheckIn")
LOCKSTEP_DECLARE_WORKER(FLockstepMarkForAddWorker, "MarkForAdd")
LOCKSTEP_DECLARE_WORKER(FLockstepDeleteWorker, "Delete")
LOCKSTEP_DECLARE_WORKER(FLockstepRevertWorker, "Revert")
LOCKSTEP_DECLARE_WORKER(FLockstepSyncWorker, "Sync")

#undef LOCKSTEP_DECLARE_WORKER
