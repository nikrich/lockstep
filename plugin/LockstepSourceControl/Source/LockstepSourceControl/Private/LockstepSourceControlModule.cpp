// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepSourceControlModule.h"
#include "LockstepSourceControlOperations.h"
#include "ILockstepSourceControlWorker.h"
#include "Misc/App.h"
#include "Features/IModularFeatures.h"

#define LOCTEXT_NAMESPACE "LockstepSourceControl"

template <typename WorkerType>
static FLockstepSourceControlWorkerRef CreateWorker()
{
	return MakeShareable(new WorkerType());
}

void FLockstepSourceControlModule::StartupModule()
{
	Provider.RegisterWorker("Connect", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepConnectWorker>));
	Provider.RegisterWorker("UpdateStatus", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepUpdateStatusWorker>));
	Provider.RegisterWorker("CheckOut", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepCheckOutWorker>));
	Provider.RegisterWorker("CheckIn", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepCheckInWorker>));
	Provider.RegisterWorker("MarkForAdd", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepMarkForAddWorker>));
	Provider.RegisterWorker("Delete", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepDeleteWorker>));
	Provider.RegisterWorker("Revert", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepRevertWorker>));
	Provider.RegisterWorker("Sync", FGetLockstepSourceControlWorker::CreateStatic(&CreateWorker<FLockstepSyncWorker>));

	Settings.LoadSettings();

	IModularFeatures::Get().RegisterModularFeature("SourceControl", &Provider);
}

void FLockstepSourceControlModule::ShutdownModule()
{
	Provider.Close();
	IModularFeatures::Get().UnregisterModularFeature("SourceControl", &Provider);
}

void FLockstepSourceControlModule::SaveSettings()
{
	if (FApp::IsUnattended() || IsRunningCommandlet())
	{
		return;
	}
	Settings.SaveSettings();
}

IMPLEMENT_MODULE(FLockstepSourceControlModule, LockstepSourceControl);

#undef LOCTEXT_NAMESPACE
