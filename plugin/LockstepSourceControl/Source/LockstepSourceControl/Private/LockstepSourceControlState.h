// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// Per-file source-control state the editor queries to drive icons, the "check
// out" affordance, and — the part that matters for Lockstep — the lock badge.
//
// The lock truth comes from the Lockstep lock API (FLockstepLock); git status
// supplies the working-tree state (modified / added / untracked). This class
// fuses both into the answers ISourceControlState must give.
#pragma once

#include "CoreMinimal.h"
#include "ISourceControlState.h"
#include "ISourceControlRevision.h"
#include "LockstepVersionCompat.h"

/** Working-tree status of a file, as derived from `git status`/`git lfs`. */
enum class ELockstepWorkingState : uint8
{
	Unknown,
	Unmodified,    // tracked, clean
	Modified,      // tracked, edited
	Added,         // staged add
	Deleted,       // staged/working delete
	Untracked,     // not in git
	Ignored,
	NotControlled, // outside the working copy
};

/** Lock status of a file from the Lockstep lock API. */
enum class ELockstepLockState : uint8
{
	Unknown,
	NotLocked,
	LockedByMe,
	LockedByOther,
};

class FLockstepSourceControlState : public ISourceControlState
{
public:
	explicit FLockstepSourceControlState(const FString& InLocalFilename)
		: LocalFilename(InLocalFilename)
	{
	}

	// ---- ISourceControlState: history (we don't surface git history yet) ----
	virtual int32 GetHistorySize() const override { return 0; }
	virtual TSharedPtr<class ISourceControlRevision, ESPMode::ThreadSafe> GetHistoryItem(int32) const override { return nullptr; }
	virtual TSharedPtr<class ISourceControlRevision, ESPMode::ThreadSafe> FindHistoryRevision(int32) const override { return nullptr; }
	virtual TSharedPtr<class ISourceControlRevision, ESPMode::ThreadSafe> FindHistoryRevision(const FString&) const override { return nullptr; }
	virtual TSharedPtr<class ISourceControlRevision, ESPMode::ThreadSafe> GetCurrentRevision() const override { return nullptr; }
	// GetResolveInfo()/IsConflicted() use the base defaults (no merge-resolve flow
	// for binaries — they're locked, not merged). GetBaseRevForMerge() is `final`
	// from 5.3 on, so we must not override it.

#if SOURCE_CONTROL_WITH_SLATE
	virtual FSlateIcon GetIcon() const override;
#endif

	virtual FText GetDisplayName() const override;
	virtual FText GetDisplayTooltip() const override;
	virtual const FString& GetFilename() const override { return LocalFilename; }
	virtual const FDateTime& GetTimeStamp() const override { return TimeStamp; }

	// ---- check out / lock semantics ----
	virtual bool CanCheckIn() const override;
	virtual bool CanCheckout() const override;
	virtual bool IsCheckedOut() const override;
	virtual bool IsCheckedOutOther(FString* Who = nullptr) const override;
	virtual bool IsCheckedOutInOtherBranch(const FString& CurrentBranch = FString()) const override { return false; }
	virtual bool IsModifiedInOtherBranch(const FString& CurrentBranch = FString()) const override { return false; }
	virtual bool IsCheckedOutOrModifiedInOtherBranch(const FString& CurrentBranch = FString()) const override { return false; }
	virtual TArray<FString> GetCheckedOutBranches() const override { return TArray<FString>(); }
	virtual FString GetOtherUserBranchCheckedOuts() const override { return FString(); }
	virtual bool GetOtherBranchHeadModification(FString&, FString&, int32&) const override { return false; }

	// ---- working-tree state ----
	virtual bool IsCurrent() const override { return true; }
	virtual bool IsSourceControlled() const override;
	virtual bool IsAdded() const override { return WorkingState == ELockstepWorkingState::Added; }
	virtual bool IsDeleted() const override { return WorkingState == ELockstepWorkingState::Deleted; }
	virtual bool IsIgnored() const override { return WorkingState == ELockstepWorkingState::Ignored; }
	virtual bool CanEdit() const override;
	virtual bool CanDelete() const override;
	virtual bool IsUnknown() const override { return WorkingState == ELockstepWorkingState::Unknown; }
	virtual bool IsModified() const override;
	virtual bool CanAdd() const override { return WorkingState == ELockstepWorkingState::Untracked; }
	virtual bool IsConflicted() const override { return false; }
	virtual bool CanRevert() const override { return IsModified(); }

	/** True if this path is governed by a `lockable` .gitattributes pattern. We
	 *  only enforce exclusive checkout / read-only for lockable binary assets. */
	bool IsLockable() const { return bIsLockable; }

public:
	FString LocalFilename;
	FDateTime TimeStamp = FDateTime::Now();

	ELockstepWorkingState WorkingState = ELockstepWorkingState::Unknown;
	ELockstepLockState LockState = ELockstepLockState::Unknown;

	bool bIsLockable = false;

	// Populated when LockState != NotLocked.
	FString LockId;
	FString LockOwner;
	FDateTime LockedAt;
};
