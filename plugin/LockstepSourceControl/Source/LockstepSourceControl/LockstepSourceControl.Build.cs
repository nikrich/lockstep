// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

using UnrealBuildTool;

public class LockstepSourceControl : ModuleRules
{
	public LockstepSourceControl(ReadOnlyTargetRules Target) : base(Target)
	{
		PrivateDependencyModuleNames.AddRange(
			new string[] {
				"Core",
				"Slate",
				"SlateCore",
				"InputCore",
				"DesktopWidgets",
				"SourceControl",  // ISourceControlProvider, FMessageLog, progress, helpers
				"HTTP",           // direct client to the Lockstep lock API
				"HTTPServer",     // loopback listener for browser sign-in
				"Json",           // parse the lock API responses
			}
		);

		if (Target.bBuildEditor == true)
		{
			PrivateDependencyModuleNames.Add("CoreUObject");
			PrivateDependencyModuleNames.Add("EditorFramework");
			PrivateDependencyModuleNames.Add("UnrealEd");
		}

		// Windows Credential Manager (DPAPI-backed) for secure token storage.
		if (Target.Platform == UnrealTargetPlatform.Win64)
		{
			PublicSystemLibraries.Add("Advapi32.lib");
		}
	}
}
