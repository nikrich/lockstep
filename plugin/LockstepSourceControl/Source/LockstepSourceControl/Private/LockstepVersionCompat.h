// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// One plugin, every UE5. The ISourceControlProvider / ISourceControlState
// interfaces gained and reshaped pure-virtual methods across 5.0 -> 5.6, so the
// provider implementation is gated on the engine version. Use the macro below
// rather than raw ENGINE_*_VERSION checks so the intent reads clearly at the
// call site.
#pragma once

#include "Runtime/Launch/Resources/Version.h"

// True when the compiling engine is >= the given (Major, Minor).
#define LOCKSTEP_UE_VERSION_AT_LEAST(Major, Minor) \
	(ENGINE_MAJOR_VERSION > (Major) || (ENGINE_MAJOR_VERSION == (Major) && ENGINE_MINOR_VERSION >= (Minor)))

#define LOCKSTEP_UE_VERSION_BEFORE(Major, Minor) (!LOCKSTEP_UE_VERSION_AT_LEAST(Major, Minor))

// Notable interface inflection points we branch on (documented here so the
// guards elsewhere are self-explanatory):
//   5.0  changelists land: ISourceControlChangelist / *State, Execute() gains a
//        changelist-aware overload.
//   5.1  ISourceControlProvider::CanExecuteOperation +
//        TryToDownloadFileFromBackgroundThread become part of the interface.
//   5.3  Execute() changelist overload signature settles; GetState changelist.
//   5.4  QueryStateBranchConfig / state-branch plumbing tweaks.
// Keep additions consolidated to this header where possible.
