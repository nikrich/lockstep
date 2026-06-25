// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepSourceControlProvider.h"
#include "LockstepSourceControlState.h"
#include "LockstepSourceControlCommand.h"
#include "LockstepSourceControlModule.h"
#include "LockstepGit.h"
#include "SLockstepSourceControlSettings.h"

#include "ISourceControlModule.h"
#include "SourceControlHelpers.h"
#include "SourceControlOperations.h"
#include "Logging/MessageLog.h"
#include "ScopedSourceControlProgress.h"
#include "Misc/Paths.h"
#include "Misc/QueuedThreadPool.h"
#include "HttpModule.h"
#include "HttpManager.h"

#define LOCTEXT_NAMESPACE "LockstepSourceControl"

static FName ProviderName("Lockstep");

void FLockstepSourceControlProvider::Init(bool /*bForceConnection*/)
{
	CheckConnection();
}

void FLockstepSourceControlProvider::CheckConnection()
{
	FLockstepSourceControlModule& Module =
		FModuleManager::LoadModuleChecked<FLockstepSourceControlModule>("LockstepSourceControl");

	FString GitBinary = Module.AccessSettings().GetGitBinaryPath();
	if (GitBinary.IsEmpty())
	{
		GitBinary = LockstepGit::FindGitBinaryPath();
		if (!GitBinary.IsEmpty())
		{
			Module.AccessSettings().SetGitBinaryPath(GitBinary);
		}
	}

	bGitAvailable = !GitBinary.IsEmpty() && LockstepGit::CheckGitAvailability(GitBinary, GitVersion);
	if (!bGitAvailable)
	{
		bRepositoryFound = false;
		return;
	}

	const FString ProjectDir = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir());
	bRepositoryFound = LockstepGit::FindRepositoryRoot(ProjectDir, PathToRepositoryRoot);
	if (bRepositoryFound)
	{
		Module.AccessSettings().SetWorkingCopyRoot(PathToRepositoryRoot);
		LockstepGit::GetUserEmail(GitBinary, PathToRepositoryRoot, UserEmail);
	}
	else
	{
		UE_LOG(LogSourceControl, Warning, TEXT("'%s' is not part of a git repository"), *ProjectDir);
	}
}

void FLockstepSourceControlProvider::Close()
{
	StateCache.Empty();
	bGitAvailable = false;
	bRepositoryFound = false;
	UserEmail.Empty();
}

const FName& FLockstepSourceControlProvider::GetName() const
{
	return ProviderName;
}

FText FLockstepSourceControlProvider::GetStatusText() const
{
	FFormatNamedArguments Args;
	Args.Add(TEXT("RepositoryName"), FText::FromString(PathToRepositoryRoot));
	Args.Add(TEXT("UserEmail"), FText::FromString(UserEmail));
	Args.Add(TEXT("GitVersion"), FText::FromString(GitVersion));
	return FText::Format(
		LOCTEXT("ProviderStatusText",
			"Provider: Lockstep\nWorking copy: {RepositoryName}\nUser: {UserEmail}\n{GitVersion}"),
		Args);
}

TMap<ISourceControlProvider::EStatus, FString> FLockstepSourceControlProvider::GetStatus() const
{
	TMap<EStatus, FString> Result;
	Result.Add(EStatus::Enabled, IsEnabled() ? TEXT("Yes") : TEXT("No"));
	Result.Add(EStatus::Connected, (IsEnabled() && IsAvailable()) ? TEXT("Yes") : TEXT("No"));
	Result.Add(EStatus::User, UserEmail);
	Result.Add(EStatus::Repository, PathToRepositoryRoot);
	Result.Add(EStatus::ScmVersion, GitVersion);
	return Result;
}

bool FLockstepSourceControlProvider::IsEnabled() const
{
	return bRepositoryFound;
}

bool FLockstepSourceControlProvider::IsAvailable() const
{
	return bGitAvailable && bRepositoryFound;
}

TSharedRef<FLockstepSourceControlState, ESPMode::ThreadSafe> FLockstepSourceControlProvider::GetStateInternal(const FString& Filename)
{
	if (TSharedRef<FLockstepSourceControlState, ESPMode::ThreadSafe>* State = StateCache.Find(Filename))
	{
		return *State;
	}
	TSharedRef<FLockstepSourceControlState, ESPMode::ThreadSafe> NewState =
		MakeShareable(new FLockstepSourceControlState(Filename));
	StateCache.Add(Filename, NewState);
	return NewState;
}

ECommandResult::Type FLockstepSourceControlProvider::GetState(const TArray<FString>& InFiles, TArray<FSourceControlStateRef>& OutState, EStateCacheUsage::Type InStateCacheUsage)
{
	if (!IsEnabled())
	{
		return ECommandResult::Failed;
	}

	const TArray<FString> AbsoluteFiles = SourceControlHelpers::AbsoluteFilenames(InFiles);
	if (InStateCacheUsage == EStateCacheUsage::ForceUpdate)
	{
		Execute(ISourceControlOperation::Create<FUpdateStatus>(), AbsoluteFiles);
	}
	for (const FString& AbsoluteFile : AbsoluteFiles)
	{
		OutState.Add(GetStateInternal(AbsoluteFile));
	}
	return ECommandResult::Succeeded;
}

ECommandResult::Type FLockstepSourceControlProvider::GetState(const TArray<FSourceControlChangelistRef>&, TArray<FSourceControlChangelistStateRef>&, EStateCacheUsage::Type)
{
	// Lockstep does not model changelists (git has no per-commit "pending" set
	// the editor manipulates; we use uncontrolled changelists instead).
	return ECommandResult::Failed;
}

TArray<FSourceControlStateRef> FLockstepSourceControlProvider::GetCachedStateByPredicate(TFunctionRef<bool(const FSourceControlStateRef&)> Predicate) const
{
	TArray<FSourceControlStateRef> Result;
	for (const auto& CacheItem : StateCache)
	{
		FSourceControlStateRef State = CacheItem.Value;
		if (Predicate(State))
		{
			Result.Add(State);
		}
	}
	return Result;
}

FDelegateHandle FLockstepSourceControlProvider::RegisterSourceControlStateChanged_Handle(const FSourceControlStateChanged::FDelegate& SourceControlStateChanged)
{
	return OnSourceControlStateChanged.Add(SourceControlStateChanged);
}

void FLockstepSourceControlProvider::UnregisterSourceControlStateChanged_Handle(FDelegateHandle Handle)
{
	OnSourceControlStateChanged.Remove(Handle);
}

ECommandResult::Type FLockstepSourceControlProvider::Execute(const FSourceControlOperationRef& InOperation, FSourceControlChangelistPtr /*InChangelist*/, const TArray<FString>& InFiles, EConcurrency::Type InConcurrency, const FSourceControlOperationComplete& InOperationCompleteDelegate)
{
	if (!IsEnabled() && InOperation->GetName() != "Connect")
	{
		InOperationCompleteDelegate.ExecuteIfBound(InOperation, ECommandResult::Failed);
		return ECommandResult::Failed;
	}

	const TArray<FString> AbsoluteFiles = SourceControlHelpers::AbsoluteFilenames(InFiles);

	TSharedPtr<ILockstepSourceControlWorker, ESPMode::ThreadSafe> Worker = CreateWorker(InOperation->GetName());
	if (!Worker.IsValid())
	{
		FFormatNamedArguments Arguments;
		Arguments.Add(TEXT("OperationName"), FText::FromName(InOperation->GetName()));
		Arguments.Add(TEXT("ProviderName"), FText::FromName(GetName()));
		const FText Message = FText::Format(
			LOCTEXT("UnsupportedOperation", "Operation '{OperationName}' not supported by revision control provider '{ProviderName}'"),
			Arguments);
		FMessageLog("SourceControl").Error(Message);
		InOperation->AddErrorMessge(Message);
		InOperationCompleteDelegate.ExecuteIfBound(InOperation, ECommandResult::Failed);
		return ECommandResult::Failed;
	}

	FLockstepSourceControlCommand* Command = new FLockstepSourceControlCommand(InOperation, Worker.ToSharedRef());
	Command->Files = AbsoluteFiles;
	Command->OperationCompleteDelegate = InOperationCompleteDelegate;

	if (InConcurrency == EConcurrency::Synchronous)
	{
		Command->bAutoDelete = false;
		return ExecuteSynchronousCommand(*Command, InOperation->GetInProgressString());
	}
	Command->bAutoDelete = true;
	return IssueCommand(*Command);
}

bool FLockstepSourceControlProvider::CanExecuteOperation(const FSourceControlOperationRef& InOperation) const
{
	return WorkersMap.Find(InOperation->GetName()) != nullptr;
}

bool FLockstepSourceControlProvider::CanCancelOperation(const FSourceControlOperationRef&) const { return false; }
void FLockstepSourceControlProvider::CancelOperation(const FSourceControlOperationRef&) {}

// Lockstep enforces editability through locks, not the OS read-only bit. (We may
// flip this on once disk read-only enforcement for unheld lockable assets lands.)
bool FLockstepSourceControlProvider::UsesLocalReadOnlyState() const { return false; }
bool FLockstepSourceControlProvider::UsesChangelists() const { return false; }
bool FLockstepSourceControlProvider::UsesUncontrolledChangelists() const { return true; }
bool FLockstepSourceControlProvider::UsesCheckout() const { return true; } // the lock IS the checkout
bool FLockstepSourceControlProvider::UsesFileRevisions() const { return false; }
bool FLockstepSourceControlProvider::UsesSnapshots() const { return false; }
bool FLockstepSourceControlProvider::AllowsDiffAgainstDepot() const { return true; }
TOptional<bool> FLockstepSourceControlProvider::IsAtLatestRevision() const { return TOptional<bool>(); }
TOptional<int> FLockstepSourceControlProvider::GetNumLocalChanges() const { return TOptional<int>(); }

TSharedPtr<ILockstepSourceControlWorker, ESPMode::ThreadSafe> FLockstepSourceControlProvider::CreateWorker(const FName& InOperationName) const
{
	if (const FGetLockstepSourceControlWorker* Operation = WorkersMap.Find(InOperationName))
	{
		return Operation->Execute();
	}
	return nullptr;
}

void FLockstepSourceControlProvider::RegisterWorker(const FName& InName, const FGetLockstepSourceControlWorker& InDelegate)
{
	WorkersMap.Add(InName, InDelegate);
}

void FLockstepSourceControlProvider::OutputCommandMessages(const FLockstepSourceControlCommand& InCommand) const
{
	FMessageLog SourceControlLog("SourceControl");
	for (const FString& Error : InCommand.ErrorMessages)
	{
		SourceControlLog.Error(FText::FromString(Error));
	}
	for (const FString& Info : InCommand.InfoMessages)
	{
		SourceControlLog.Info(FText::FromString(Info));
	}
}

void FLockstepSourceControlProvider::Tick()
{
	bool bStatesUpdated = false;
	for (int32 CommandIndex = 0; CommandIndex < CommandQueue.Num(); ++CommandIndex)
	{
		FLockstepSourceControlCommand& Command = *CommandQueue[CommandIndex];
		if (Command.bExecuteProcessed)
		{
			CommandQueue.RemoveAt(CommandIndex);
			bStatesUpdated |= Command.Worker->UpdateStates();
			OutputCommandMessages(Command);
			Command.ReturnResults();
			if (Command.bAutoDelete)
			{
				delete &Command;
			}
			// One command per tick to avoid concurrent queue modification from a
			// completion delegate re-entering Execute.
			break;
		}
	}
	if (bStatesUpdated)
	{
		OnSourceControlStateChanged.Broadcast();
	}
}

TArray<TSharedRef<ISourceControlLabel>> FLockstepSourceControlProvider::GetLabels(const FString&) const
{
	return TArray<TSharedRef<ISourceControlLabel>>();
}

TArray<FSourceControlChangelistRef> FLockstepSourceControlProvider::GetChangelists(EStateCacheUsage::Type)
{
	return TArray<FSourceControlChangelistRef>();
}

#if SOURCE_CONTROL_WITH_SLATE
TSharedRef<class SWidget> FLockstepSourceControlProvider::MakeSettingsWidget() const
{
	return SNew(SLockstepSourceControlSettings);
}
#endif

ECommandResult::Type FLockstepSourceControlProvider::ExecuteSynchronousCommand(FLockstepSourceControlCommand& InCommand, const FText& Task)
{
	ECommandResult::Type Result = ECommandResult::Failed;
	{
		FScopedSourceControlProgress Progress(Task);
		IssueCommand(InCommand);
		while (!InCommand.bExecuteProcessed)
		{
			// The command runs on a worker thread; its lock-API HTTP completes via
			// FHttpManager::Tick on THIS (game) thread. We're not in the normal
			// engine tick here, so pump the HTTP manager ourselves or a worker
			// blocked on an HTTP response would never wake. (git subprocesses are
			// unaffected, but our lock client uses HTTP.)
			FHttpModule::Get().GetHttpManager().Tick(0.0f);
			Tick();
			Progress.Tick();
			FPlatformProcess::Sleep(0.01f);
		}
		Tick();
		if (InCommand.bCommandSuccessful)
		{
			Result = ECommandResult::Succeeded;
		}
	}

	check(!InCommand.bAutoDelete);
	if (CommandQueue.Contains(&InCommand))
	{
		CommandQueue.Remove(&InCommand);
	}
	delete &InCommand;
	return Result;
}

ECommandResult::Type FLockstepSourceControlProvider::IssueCommand(FLockstepSourceControlCommand& InCommand)
{
	if (GThreadPool != nullptr)
	{
		GThreadPool->AddQueuedWork(&InCommand);
		CommandQueue.Add(&InCommand);
		return ECommandResult::Succeeded;
	}

	const FText Message = LOCTEXT("NoSCCThreads", "There are no threads available to process the revision control command.");
	FMessageLog("SourceControl").Error(Message);
	InCommand.bCommandSuccessful = false;
	InCommand.Operation->AddErrorMessge(Message);
	return InCommand.ReturnResults();
}

#undef LOCTEXT_NAMESPACE
