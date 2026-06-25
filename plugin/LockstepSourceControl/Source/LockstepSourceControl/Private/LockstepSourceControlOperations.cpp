// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepSourceControlOperations.h"
#include "LockstepSourceControlCommand.h"
#include "LockstepSourceControlProvider.h"
#include "LockstepSourceControlModule.h"
#include "LockstepLockClient.h"
#include "LockstepGit.h"

#include "SourceControlOperations.h"

#define LOCTEXT_NAMESPACE "LockstepSourceControl.Ops"

// ---- shared helpers -------------------------------------------------------

namespace
{
	/** Apply a worker's computed results to the provider's state cache (game thread). */
	bool ApplyStates(const TArray<FLockstepStatusResult>& States)
	{
		if (States.Num() == 0)
		{
			return false;
		}
		FLockstepSourceControlProvider& Provider = FLockstepSourceControlModule::Get().GetProvider();
		for (const FLockstepStatusResult& R : States)
		{
			TSharedRef<FLockstepSourceControlState, ESPMode::ThreadSafe> State = Provider.GetStateInternal(R.LocalFilename);
			State->WorkingState = R.WorkingState;
			State->LockState = R.LockState;
			State->bIsLockable = R.bIsLockable;
			State->LockId = R.LockId;
			State->LockOwner = R.LockOwner;
			State->LockedAt = R.LockedAt;
			State->TimeStamp = FDateTime::Now();
		}
		return true;
	}

	/** Build repo-relative-path -> lock map from the server (if configured). */
	void FetchLocks(FLockstepSourceControlCommand& Cmd, TMap<FString, FLockstepLock>& OutByPath)
	{
		FLockstepLockClient Client = Cmd.MakeLockClient();
		if (!Client.IsConfigured())
		{
			return;
		}
		TArray<FLockstepLock> Locks;
		FString Err;
		if (Client.VerifyLocks(Locks, Err))
		{
			for (const FLockstepLock& L : Locks)
			{
				OutByPath.Add(L.Path, L);
			}
		}
		else if (!Err.IsEmpty())
		{
			Cmd.InfoMessages.Add(FString::Printf(TEXT("Lock query failed: %s"), *Err));
		}
	}

	/** Compute combined git + lock status for the given absolute files. */
	void ComputeStatus(FLockstepSourceControlCommand& Cmd, const TArray<FString>& Files, TArray<FLockstepStatusResult>& Out)
	{
		TMap<FString, ELockstepWorkingState> Work;
		TArray<FString> Errors;
		LockstepGit::RunStatus(Cmd.PathToGitBinary, Cmd.PathToRepositoryRoot, Files, Work, Errors);
		Cmd.ErrorMessages.Append(Errors);

		TMap<FString, FLockstepLock> LockByPath;
		FetchLocks(Cmd, LockByPath);

		for (const FString& Abs : Files)
		{
			FLockstepStatusResult R;
			R.LocalFilename = Abs;
			R.WorkingState = Work.FindRef(Abs);
			R.bIsLockable = LockstepGit::IsFileLockable(Cmd.PathToGitBinary, Cmd.PathToRepositoryRoot, Abs);

			const FString Rel = LockstepGit::AbsoluteToRepoRelative(Cmd.PathToRepositoryRoot, Abs);
			if (const FLockstepLock* L = LockByPath.Find(Rel))
			{
				R.LockState = L->bIsOurs ? ELockstepLockState::LockedByMe : ELockstepLockState::LockedByOther;
				R.LockId = L->Id;
				R.LockOwner = L->OwnerName;
				R.LockedAt = L->LockedAt;
			}
			else
			{
				R.LockState = ELockstepLockState::NotLocked;
			}
			Out.Add(MoveTemp(R));
		}
	}
}

// ---- Connect --------------------------------------------------------------

bool FLockstepConnectWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	// Git availability + repo root are validated by the provider before we get
	// here. Confirm the lock server is reachable so "Connect" reflects locking.
	FLockstepLockClient Client = InCommand.MakeLockClient();
	if (!Client.IsConfigured())
	{
		InCommand.InfoMessages.Add(TEXT("Connected to git. Lockstep lock server is not configured — set the Server URL and access token to enable file locking."));
		return true;
	}
	TArray<FLockstepLock> Locks;
	FString Err;
	if (!Client.VerifyLocks(Locks, Err))
	{
		InCommand.ErrorMessages.Add(FString::Printf(TEXT("Connected to git, but the Lockstep lock server check failed: %s"), *Err));
		// Still a usable git connection; don't hard-fail Connect.
	}
	return true;
}

bool FLockstepConnectWorker::UpdateStates() const { return false; }

// ---- UpdateStatus ---------------------------------------------------------

bool FLockstepUpdateStatusWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	if (InCommand.Files.Num() == 0)
	{
		return true;
	}
	ComputeStatus(InCommand, InCommand.Files, States);
	return true;
}

bool FLockstepUpdateStatusWorker::UpdateStates() const { return ApplyStates(States); }

// ---- CheckOut (acquire lock) ----------------------------------------------

bool FLockstepCheckOutWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	FLockstepLockClient Client = InCommand.MakeLockClient();
	if (!Client.IsConfigured())
	{
		InCommand.ErrorMessages.Add(TEXT("Cannot check out: Lockstep is not configured (Server URL / access token)."));
		return false;
	}

	bool bAllSucceeded = true;
	for (const FString& Abs : InCommand.Files)
	{
		// Only lockable (unmergeable) assets are exclusively checked out.
		if (!LockstepGit::IsFileLockable(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot, Abs))
		{
			continue;
		}
		const FString Rel = LockstepGit::AbsoluteToRepoRelative(InCommand.PathToRepositoryRoot, Abs);

		FLockstepLock Lock, Existing;
		FString Err;
		FLockstepStatusResult R;
		R.LocalFilename = Abs;
		R.bIsLockable = true;
		R.WorkingState = ELockstepWorkingState::Unmodified;

		if (Client.AcquireLock(Rel, Lock, Existing, Err))
		{
			R.LockState = ELockstepLockState::LockedByMe;
			R.LockId = Lock.Id;
			R.LockOwner = Lock.OwnerName;
			R.LockedAt = Lock.LockedAt;
		}
		else
		{
			bAllSucceeded = false;
			InCommand.ErrorMessages.Add(Err);
			if (Existing.IsValid())
			{
				R.LockState = ELockstepLockState::LockedByOther;
				R.LockId = Existing.Id;
				R.LockOwner = Existing.OwnerName;
				R.LockedAt = Existing.LockedAt;
			}
		}
		States.Add(MoveTemp(R));
	}
	return bAllSucceeded;
}

bool FLockstepCheckOutWorker::UpdateStates() const { return ApplyStates(States); }

// ---- Revert (release lock + discard changes) ------------------------------

bool FLockstepRevertWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	FLockstepLockClient Client = InCommand.MakeLockClient();

	// Find which of these files we hold, so we can release by lock id.
	TMap<FString, FLockstepLock> LockByPath;
	FetchLocks(InCommand, LockByPath);

	for (const FString& Abs : InCommand.Files)
	{
		const FString Rel = LockstepGit::AbsoluteToRepoRelative(InCommand.PathToRepositoryRoot, Abs);

		// Discard local modifications via git.
		FString StdOut, StdErr;
		LockstepGit::RunCommand(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot,
			TEXT("checkout"), {TEXT("--")}, {Rel}, StdOut, StdErr);

		// Release our lock if we hold it.
		if (const FLockstepLock* L = LockByPath.Find(Rel))
		{
			if (L->bIsOurs && Client.IsConfigured())
			{
				FString Err;
				if (!Client.ReleaseLock(L->Id, /*bForce=*/false, Err))
				{
					InCommand.ErrorMessages.Add(Err);
				}
			}
		}

		FLockstepStatusResult R;
		R.LocalFilename = Abs;
		R.WorkingState = ELockstepWorkingState::Unmodified;
		R.LockState = ELockstepLockState::NotLocked;
		R.bIsLockable = LockstepGit::IsFileLockable(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot, Abs);
		States.Add(MoveTemp(R));
	}
	return true;
}

bool FLockstepRevertWorker::UpdateStates() const { return ApplyStates(States); }

// ---- CheckIn (stage + commit + push, then release locks) ------------------

bool FLockstepCheckInWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	TArray<FString> RelFiles;
	for (const FString& Abs : InCommand.Files)
	{
		RelFiles.Add(LockstepGit::AbsoluteToRepoRelative(InCommand.PathToRepositoryRoot, Abs));
	}

	FString StdOut, StdErr;
	if (!LockstepGit::RunCommand(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot,
			TEXT("add"), {}, RelFiles, StdOut, StdErr))
	{
		InCommand.ErrorMessages.Add(StdErr.TrimStartAndEnd());
		return false;
	}

	FString Description;
	if (InCommand.Operation->GetName() == "CheckIn")
	{
		Description = StaticCastSharedRef<FCheckIn>(InCommand.Operation)->GetDescription().ToString();
	}
	if (Description.IsEmpty())
	{
		Description = TEXT("Lockstep check-in");
	}
	// Pass the message via a temp file to avoid shell-quoting pitfalls in the future;
	// for now use -m with the description on one logical line.
	const FString QuotedMessage = FString::Printf(TEXT("\"%s\""), *Description.Replace(TEXT("\""), TEXT("\\\"")));
	if (!LockstepGit::RunCommand(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot,
			TEXT("commit"), {TEXT("-m"), QuotedMessage}, {}, StdOut, StdErr))
	{
		InCommand.ErrorMessages.Add(StdErr.TrimStartAndEnd());
		return false;
	}
	InCommand.InfoMessages.Add(StdOut.TrimStartAndEnd());

	// Best-effort push (LFS blobs go straight to the bucket via presigned URLs).
	FString PushOut, PushErr;
	if (!LockstepGit::RunCommand(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot,
			TEXT("push"), {}, {}, PushOut, PushErr))
	{
		InCommand.InfoMessages.Add(FString::Printf(TEXT("Commit succeeded; push deferred: %s"), *PushErr.TrimStartAndEnd()));
	}

	// Release locks we hold on the submitted files.
	FLockstepLockClient Client = InCommand.MakeLockClient();
	if (Client.IsConfigured())
	{
		TMap<FString, FLockstepLock> LockByPath;
		FetchLocks(InCommand, LockByPath);
		for (const FString& Rel : RelFiles)
		{
			if (const FLockstepLock* L = LockByPath.Find(Rel))
			{
				if (L->bIsOurs)
				{
					FString Err;
					Client.ReleaseLock(L->Id, /*bForce=*/false, Err);
				}
			}
		}
	}

	for (const FString& Abs : InCommand.Files)
	{
		FLockstepStatusResult R;
		R.LocalFilename = Abs;
		R.WorkingState = ELockstepWorkingState::Unmodified;
		R.LockState = ELockstepLockState::NotLocked;
		R.bIsLockable = LockstepGit::IsFileLockable(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot, Abs);
		States.Add(MoveTemp(R));
	}
	return true;
}

bool FLockstepCheckInWorker::UpdateStates() const { return ApplyStates(States); }

// ---- MarkForAdd -----------------------------------------------------------

bool FLockstepMarkForAddWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	TArray<FString> RelFiles;
	for (const FString& Abs : InCommand.Files)
	{
		RelFiles.Add(LockstepGit::AbsoluteToRepoRelative(InCommand.PathToRepositoryRoot, Abs));
	}
	FString StdOut, StdErr;
	const bool bOk = LockstepGit::RunCommand(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot,
		TEXT("add"), {}, RelFiles, StdOut, StdErr);
	if (!bOk)
	{
		InCommand.ErrorMessages.Add(StdErr.TrimStartAndEnd());
		return false;
	}
	for (const FString& Abs : InCommand.Files)
	{
		FLockstepStatusResult R;
		R.LocalFilename = Abs;
		R.WorkingState = ELockstepWorkingState::Added;
		States.Add(MoveTemp(R));
	}
	return true;
}

bool FLockstepMarkForAddWorker::UpdateStates() const { return ApplyStates(States); }

// ---- Delete ---------------------------------------------------------------

bool FLockstepDeleteWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	TArray<FString> RelFiles;
	for (const FString& Abs : InCommand.Files)
	{
		RelFiles.Add(LockstepGit::AbsoluteToRepoRelative(InCommand.PathToRepositoryRoot, Abs));
	}
	FString StdOut, StdErr;
	const bool bOk = LockstepGit::RunCommand(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot,
		TEXT("rm"), {TEXT("--cached")}, RelFiles, StdOut, StdErr);
	if (!bOk)
	{
		InCommand.ErrorMessages.Add(StdErr.TrimStartAndEnd());
		return false;
	}
	for (const FString& Abs : InCommand.Files)
	{
		FLockstepStatusResult R;
		R.LocalFilename = Abs;
		R.WorkingState = ELockstepWorkingState::Deleted;
		States.Add(MoveTemp(R));
	}
	return true;
}

bool FLockstepDeleteWorker::UpdateStates() const { return ApplyStates(States); }

// ---- Sync (pull) ----------------------------------------------------------

bool FLockstepSyncWorker::Execute(FLockstepSourceControlCommand& InCommand)
{
	FString StdOut, StdErr;
	const bool bOk = LockstepGit::RunCommand(InCommand.PathToGitBinary, InCommand.PathToRepositoryRoot,
		TEXT("pull"), {}, {}, StdOut, StdErr);
	if (!bOk)
	{
		InCommand.ErrorMessages.Add(StdErr.TrimStartAndEnd());
		return false;
	}
	InCommand.InfoMessages.Add(StdOut.TrimStartAndEnd());
	// Refresh status for the synced files.
	if (InCommand.Files.Num() > 0)
	{
		ComputeStatus(InCommand, InCommand.Files, States);
	}
	return true;
}

bool FLockstepSyncWorker::UpdateStates() const { return ApplyStates(States); }

#undef LOCTEXT_NAMESPACE
