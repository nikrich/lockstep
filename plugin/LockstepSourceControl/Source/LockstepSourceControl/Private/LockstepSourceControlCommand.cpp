// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepSourceControlCommand.h"
#include "ILockstepSourceControlWorker.h"
#include "LockstepSourceControlModule.h"
#include "LockstepGit.h"
#include "Modules/ModuleManager.h"
#include "HAL/PlatformAtomics.h"

FLockstepSourceControlCommand::FLockstepSourceControlCommand(
	const TSharedRef<class ISourceControlOperation, ESPMode::ThreadSafe>& InOperation,
	const TSharedRef<class ILockstepSourceControlWorker, ESPMode::ThreadSafe>& InWorker,
	const FSourceControlOperationComplete& InOperationCompleteDelegate)
	: Operation(InOperation)
	, Worker(InWorker)
	, OperationCompleteDelegate(InOperationCompleteDelegate)
{
	// Snapshot connection state here, on the game thread, so the worker thread
	// never reads provider/settings concurrently.
	check(IsInGameThread());
	FLockstepSourceControlModule& Module =
		FModuleManager::LoadModuleChecked<FLockstepSourceControlModule>("LockstepSourceControl");

	PathToGitBinary = Module.AccessSettings().GetGitBinaryPath();
	PathToRepositoryRoot = Module.GetProvider().GetPathToRepositoryRoot();
	ServerUrl = Module.AccessSettings().GetServerUrl();
	bSoftLockMode = Module.AccessSettings().IsSoftLockMode();

	// Resolve the PAT now (may shell out to the git credential helper, which we
	// must not do off the game thread). Never stored in our ini.
	Token = LockstepGit::ResolveAccessToken(PathToGitBinary, PathToRepositoryRoot, ServerUrl);
}

bool FLockstepSourceControlCommand::DoWork()
{
	bCommandSuccessful = Worker->Execute(*this);
	FPlatformAtomics::InterlockedExchange(&bExecuteProcessed, 1);
	return bCommandSuccessful;
}

void FLockstepSourceControlCommand::Abandon()
{
	FPlatformAtomics::InterlockedExchange(&bExecuteProcessed, 1);
}

void FLockstepSourceControlCommand::DoThreadedWork()
{
	Concurrency = EConcurrency::Asynchronous;
	DoWork();
}

ECommandResult::Type FLockstepSourceControlCommand::ReturnResults()
{
	for (FString& String : InfoMessages)
	{
		Operation->AddInfoMessge(FText::FromString(String));
	}
	for (FString& String : ErrorMessages)
	{
		Operation->AddErrorMessge(FText::FromString(String));
	}

	const ECommandResult::Type Result = bCommandSuccessful ? ECommandResult::Succeeded : ECommandResult::Failed;
	OperationCompleteDelegate.ExecuteIfBound(Operation, Result);
	return Result;
}
