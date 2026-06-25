// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// A worker performs one source-control operation. Execute() runs on a worker
// thread (or the game thread for synchronous commands); UpdateStates() applies
// the results to the provider's state cache back on the game thread.
//
// Mirrors the engine GitSourceControl plugin's IGitSourceControlWorker so the
// dispatch model is identical and battle-tested.
#pragma once

#include "Templates/SharedPointer.h"

class ILockstepSourceControlWorker
{
public:
	virtual ~ILockstepSourceControlWorker() {}

	/** Unique name; matches the FName of the ISourceControlOperation it serves. */
	virtual FName GetName() const = 0;

	/** Do the work (may run off the game thread). Returns success. */
	virtual bool Execute(class FLockstepSourceControlCommand& InCommand) = 0;

	/** Apply results to the state cache (always on the game thread). Returns
	 *  true if any state changed (so the provider can broadcast). */
	virtual bool UpdateStates() const = 0;
};

typedef TSharedRef<ILockstepSourceControlWorker, ESPMode::ThreadSafe> FLockstepSourceControlWorkerRef;
