// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepSourceControlState.h"

#define LOCTEXT_NAMESPACE "LockstepSourceControl.State"

#if SOURCE_CONTROL_WITH_SLATE
#include "Styling/AppStyle.h"

FSlateIcon FLockstepSourceControlState::GetIcon() const
{
	// The lock badge is the headline UX. A file someone else holds reads as
	// "locked by other"; one we hold reads as "checked out by us".
	switch (LockState)
	{
	case ELockstepLockState::LockedByOther:
		return FSlateIcon(FAppStyle::GetAppStyleSetName(), "RevisionControl.CheckedOutByOtherUser");
	case ELockstepLockState::LockedByMe:
		return FSlateIcon(FAppStyle::GetAppStyleSetName(), "RevisionControl.CheckedOut");
	default:
		break;
	}

	switch (WorkingState)
	{
	case ELockstepWorkingState::Modified:
		return FSlateIcon(FAppStyle::GetAppStyleSetName(), "RevisionControl.CheckedOut");
	case ELockstepWorkingState::Added:
		return FSlateIcon(FAppStyle::GetAppStyleSetName(), "RevisionControl.OpenForAdd");
	case ELockstepWorkingState::Deleted:
		return FSlateIcon(FAppStyle::GetAppStyleSetName(), "RevisionControl.MarkedForDelete");
	case ELockstepWorkingState::Untracked:
		return FSlateIcon(FAppStyle::GetAppStyleSetName(), "RevisionControl.NotInDepot");
	default:
		return FSlateIcon();
	}
}
#endif // SOURCE_CONTROL_WITH_SLATE

FText FLockstepSourceControlState::GetDisplayName() const
{
	switch (LockState)
	{
	case ELockstepLockState::LockedByOther:
		return FText::Format(LOCTEXT("LockedOther", "Locked by {0}"), FText::FromString(LockOwner));
	case ELockstepLockState::LockedByMe:
		return LOCTEXT("LockedMe", "Checked out (locked by you)");
	default:
		break;
	}

	switch (WorkingState)
	{
	case ELockstepWorkingState::Unmodified:   return LOCTEXT("Unmodified", "Unmodified");
	case ELockstepWorkingState::Modified:     return LOCTEXT("Modified", "Modified");
	case ELockstepWorkingState::Added:        return LOCTEXT("Added", "Added");
	case ELockstepWorkingState::Deleted:      return LOCTEXT("Deleted", "Deleted");
	case ELockstepWorkingState::Untracked:    return LOCTEXT("Untracked", "Not tracked");
	case ELockstepWorkingState::Ignored:      return LOCTEXT("Ignored", "Ignored");
	case ELockstepWorkingState::NotControlled:return LOCTEXT("NotControlled", "Not under source control");
	default:                                  return LOCTEXT("Unknown", "Unknown");
	}
}

FText FLockstepSourceControlState::GetDisplayTooltip() const
{
	if (LockState == ELockstepLockState::LockedByOther)
	{
		return FText::Format(
			LOCTEXT("LockedOtherTip", "🔒 Locked by {0} since {1}.\nThis asset is read-only until they release the lock."),
			FText::FromString(LockOwner),
			FText::AsDateTime(LockedAt));
	}
	if (LockState == ELockstepLockState::LockedByMe)
	{
		return LOCTEXT("LockedMeTip", "You hold the lock on this asset. Submit or release it when you're done.");
	}
	return GetDisplayName();
}

bool FLockstepSourceControlState::IsSourceControlled() const
{
	return WorkingState != ELockstepWorkingState::NotControlled
		&& WorkingState != ELockstepWorkingState::Untracked
		&& WorkingState != ELockstepWorkingState::Unknown;
}

bool FLockstepSourceControlState::IsCheckedOut() const
{
	// For lockable assets "checked out" == "we hold the lock". For ordinary
	// (mergeable) files there is no exclusive checkout, so modified == editable.
	if (bIsLockable)
	{
		return LockState == ELockstepLockState::LockedByMe;
	}
	return WorkingState == ELockstepWorkingState::Modified || WorkingState == ELockstepWorkingState::Added;
}

bool FLockstepSourceControlState::IsCheckedOutOther(FString* Who) const
{
	if (LockState == ELockstepLockState::LockedByOther)
	{
		if (Who)
		{
			*Who = LockOwner;
		}
		return true;
	}
	return false;
}

bool FLockstepSourceControlState::CanCheckout() const
{
	if (!bIsLockable)
	{
		// Non-lockable files are freely editable; "check out" is a no-op concept.
		return false;
	}
	return LockState == ELockstepLockState::NotLocked && IsSourceControlled();
}

bool FLockstepSourceControlState::CanCheckIn() const
{
	if (bIsLockable)
	{
		return LockState == ELockstepLockState::LockedByMe;
	}
	return IsModified() || IsAdded();
}

bool FLockstepSourceControlState::CanEdit() const
{
	// Editing a lockable asset requires holding its lock. Anything else (or a
	// file we already hold) is editable.
	if (bIsLockable)
	{
		return LockState != ELockstepLockState::LockedByOther;
	}
	return true;
}

bool FLockstepSourceControlState::CanDelete() const
{
	return IsSourceControlled() && !IsCheckedOutOther();
}

bool FLockstepSourceControlState::IsModified() const
{
	return WorkingState == ELockstepWorkingState::Modified
		|| WorkingState == ELockstepWorkingState::Added
		|| WorkingState == ELockstepWorkingState::Deleted;
}

#undef LOCTEXT_NAMESPACE
