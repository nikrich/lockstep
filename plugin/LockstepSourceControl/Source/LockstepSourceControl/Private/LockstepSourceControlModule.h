// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// Module entry point: owns the provider + settings, registers the per-operation
// workers, and binds the provider as the "SourceControl" modular feature so the
// editor can select "Lockstep" in Revision Control settings.
#pragma once

#include "Modules/ModuleManager.h"
#include "LockstepSourceControlSettings.h"
#include "LockstepSourceControlProvider.h"

class FLockstepSourceControlModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

	FLockstepSourceControlSettings& AccessSettings() { return Settings; }
	void SaveSettings();

	FLockstepSourceControlProvider& GetProvider() { return Provider; }

	/** Convenience accessor for workers running on the game thread. */
	static FLockstepSourceControlModule& Get()
	{
		return FModuleManager::LoadModuleChecked<FLockstepSourceControlModule>("LockstepSourceControl");
	}

private:
	FLockstepSourceControlProvider Provider;
	FLockstepSourceControlSettings Settings;
};
