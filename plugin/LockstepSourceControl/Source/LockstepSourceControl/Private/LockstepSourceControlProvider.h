// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// The ISourceControlProvider the editor drives. Content operations delegate to
// git/git-lfs; the locking operations (CheckOut/Revert) talk to the Lockstep
// lock API. Command dispatch (worker map, queue, Tick, sync/async) mirrors the
// engine GitSourceControl plugin so the threading model is the proven one.
#pragma once

#include "ISourceControlProvider.h"
#include "ILockstepSourceControlWorker.h"

class FLockstepSourceControlState;
class FLockstepSourceControlCommand;

DECLARE_DELEGATE_RetVal(FLockstepSourceControlWorkerRef, FGetLockstepSourceControlWorker)

class FLockstepSourceControlProvider : public ISourceControlProvider
{
public:
	FLockstepSourceControlProvider() = default;

	// ---- ISourceControlProvider (5.7) ----
	virtual void Init(bool bForceConnection = true) override;
	virtual void Close() override;
	virtual const FName& GetName() const override;
	virtual FText GetStatusText() const override;
	virtual TMap<EStatus, FString> GetStatus() const override;
	virtual bool IsEnabled() const override;
	virtual bool IsAvailable() const override;
	virtual bool QueryStateBranchConfig(const FString& ConfigSrc, const FString& ConfigDest) override { return false; }
	virtual void RegisterStateBranches(const TArray<FString>& BranchNames, const FString& ContentRoot) override {}
	virtual int32 GetStateBranchIndex(const FString& InBranchName) const override { return INDEX_NONE; }
	virtual bool GetStateBranchAtIndex(int32 BranchIndex, FString& OutBranchName) const override { return false; }
	virtual ECommandResult::Type GetState(const TArray<FString>& InFiles, TArray<FSourceControlStateRef>& OutState, EStateCacheUsage::Type InStateCacheUsage) override;
	virtual ECommandResult::Type GetState(const TArray<FSourceControlChangelistRef>& InChangelists, TArray<FSourceControlChangelistStateRef>& OutState, EStateCacheUsage::Type InStateCacheUsage) override;
	virtual TArray<FSourceControlStateRef> GetCachedStateByPredicate(TFunctionRef<bool(const FSourceControlStateRef&)> Predicate) const override;
	virtual FDelegateHandle RegisterSourceControlStateChanged_Handle(const FSourceControlStateChanged::FDelegate& SourceControlStateChanged) override;
	virtual void UnregisterSourceControlStateChanged_Handle(FDelegateHandle Handle) override;
	virtual ECommandResult::Type Execute(const FSourceControlOperationRef& InOperation, FSourceControlChangelistPtr InChangelist, const TArray<FString>& InFiles, EConcurrency::Type InConcurrency = EConcurrency::Synchronous, const FSourceControlOperationComplete& InOperationCompleteDelegate = FSourceControlOperationComplete()) override;
	virtual bool CanExecuteOperation(const FSourceControlOperationRef& InOperation) const override;
	virtual bool CanCancelOperation(const FSourceControlOperationRef& InOperation) const override;
	virtual void CancelOperation(const FSourceControlOperationRef& InOperation) override;
	virtual bool UsesLocalReadOnlyState() const override;
	virtual bool UsesChangelists() const override;
	virtual bool UsesUncontrolledChangelists() const override;
	virtual bool UsesCheckout() const override;
	virtual bool UsesFileRevisions() const override;
	virtual bool UsesSnapshots() const override;
	virtual bool AllowsDiffAgainstDepot() const override;
	virtual TOptional<bool> IsAtLatestRevision() const override;
	virtual TOptional<int> GetNumLocalChanges() const override;
	virtual void Tick() override;
	virtual TArray<TSharedRef<class ISourceControlLabel>> GetLabels(const FString& InMatchingSpec) const override;
	virtual TArray<FSourceControlChangelistRef> GetChangelists(EStateCacheUsage::Type InStateCacheUsage) override;
#if SOURCE_CONTROL_WITH_SLATE
	virtual TSharedRef<class SWidget> MakeSettingsWidget() const override;
#endif

	using ISourceControlProvider::Execute;
	using ISourceControlProvider::GetState;

	// ---- Lockstep internals ----

	/** Probe git + locate the working copy; called from Init. */
	void CheckConnection();

	const FString& GetPathToRepositoryRoot() const { return PathToRepositoryRoot; }
	const FString& GetUserEmail() const { return UserEmail; }
	const FString& GetGitVersion() const { return GitVersion; }
	bool IsGitAvailable() const { return bGitAvailable; }

	/** Find or create the cached state for a file. */
	TSharedRef<FLockstepSourceControlState, ESPMode::ThreadSafe> GetStateInternal(const FString& Filename);

	void RegisterWorker(const FName& InName, const FGetLockstepSourceControlWorker& InDelegate);

private:
	TSharedPtr<ILockstepSourceControlWorker, ESPMode::ThreadSafe> CreateWorker(const FName& InOperationName) const;
	ECommandResult::Type ExecuteSynchronousCommand(FLockstepSourceControlCommand& InCommand, const FText& Task);
	ECommandResult::Type IssueCommand(FLockstepSourceControlCommand& InCommand);
	void OutputCommandMessages(const FLockstepSourceControlCommand& InCommand) const;

	bool bGitAvailable = false;
	bool bRepositoryFound = false;

	FString PathToRepositoryRoot;
	FString UserEmail;
	FString GitVersion;

	TMap<FString, TSharedRef<FLockstepSourceControlState, ESPMode::ThreadSafe>> StateCache;
	TMap<FName, FGetLockstepSourceControlWorker> WorkersMap;
	TArray<FLockstepSourceControlCommand*> CommandQueue;
	FSourceControlStateChanged OnSourceControlStateChanged;
};
