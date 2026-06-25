// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

using UnrealBuildTool;

public class LockstepSourceControl : ModuleRules
{
	public LockstepSourceControl(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"CoreUObject",
			"Engine",
			"InputCore",
			"Slate",
			"SlateCore",
			"Projects",        // IPluginManager — locate our plugin's resources
			"SourceControl",   // ISourceControlProvider / module
			"HTTP",            // talk to the Lockstep lock API
			"Json",
			"JsonUtilities",
		});

		// Editor-only UI helpers. Module names shifted across UE5: "EditorStyle"
		// was folded into ToolWidgets/EditorWidgets around 5.1. Depend on what the
		// target engine actually ships so the plugin builds on every 5.x.
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.AddRange(new string[]
			{
				"UnrealEd",
				"DesktopWidgets",
				"DesktopPlatform",
			});

			bool bHasToolWidgets =
				(Target.Version.MajorVersion > 5) ||
				(Target.Version.MajorVersion == 5 && Target.Version.MinorVersion >= 1);

			if (bHasToolWidgets)
			{
				PrivateDependencyModuleNames.Add("ToolWidgets");
			}
			else
			{
				PrivateDependencyModuleNames.Add("EditorStyle");
			}
		}
	}
}
