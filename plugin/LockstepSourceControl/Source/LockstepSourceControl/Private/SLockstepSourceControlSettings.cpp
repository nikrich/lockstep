// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "SLockstepSourceControlSettings.h"
#include "LockstepSourceControlModule.h"

#include "Widgets/SBoxPanel.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Layout/SBox.h"
#include "Internationalization/Internationalization.h"

#define LOCTEXT_NAMESPACE "LockstepSourceControlSettings"

void SLockstepSourceControlSettings::Construct(const FArguments& InArgs)
{
	const float Pad = 4.0f;

	ChildSlot
	[
		SNew(SVerticalBox)

		// Server URL
		+ SVerticalBox::Slot().AutoHeight().Padding(Pad)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().FillWidth(0.4f).VAlign(VAlign_Center)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("ServerUrlLabel", "Server URL"))
				.ToolTipText(LOCTEXT("ServerUrlTip", "The Lockstep API base for this repo — the same value as lfs.url in your .lfsconfig, e.g. https://api.lockstepcloud.com/your-repo"))
			]
			+ SHorizontalBox::Slot().FillWidth(0.6f)
			[
				SNew(SEditableTextBox)
				.Text(this, &SLockstepSourceControlSettings::GetServerUrl)
				.HintText(LOCTEXT("ServerUrlHint", "https://api.lockstepcloud.com/your-repo"))
				.OnTextCommitted(this, &SLockstepSourceControlSettings::OnServerUrlCommitted)
			]
		]

		// Git binary path
		+ SVerticalBox::Slot().AutoHeight().Padding(Pad)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().FillWidth(0.4f).VAlign(VAlign_Center)
			[
				SNew(STextBlock).Text(LOCTEXT("GitPathLabel", "Git path"))
			]
			+ SHorizontalBox::Slot().FillWidth(0.6f)
			[
				SNew(SEditableTextBox)
				.Text(this, &SLockstepSourceControlSettings::GetGitBinaryPath)
				.OnTextCommitted(this, &SLockstepSourceControlSettings::OnGitBinaryPathCommitted)
			]
		]

		// Soft-lock toggle
		+ SVerticalBox::Slot().AutoHeight().Padding(Pad)
		[
			SNew(SCheckBox)
			.IsChecked(this, &SLockstepSourceControlSettings::GetSoftLockState)
			.OnCheckStateChanged(this, &SLockstepSourceControlSettings::OnSoftLockChanged)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("SoftLockLabel", "Advisory (soft) locking — warn on collision instead of blocking"))
			]
		]

		// Token hint
		+ SVerticalBox::Slot().AutoHeight().Padding(Pad)
		[
			SNew(STextBlock)
			.AutoWrapText(true)
			.Text(LOCTEXT("TokenHint", "Access token: set the LOCKSTEP_TOKEN environment variable to your lsk_… Personal Access Token (minted in the Lockstep dashboard). The token is never stored in project settings."))
		]
	];
}

FText SLockstepSourceControlSettings::GetServerUrl() const
{
	return FText::FromString(FLockstepSourceControlModule::Get().AccessSettings().GetServerUrl());
}

void SLockstepSourceControlSettings::OnServerUrlCommitted(const FText& InText, ETextCommit::Type)
{
	FLockstepSourceControlModule& Module = FLockstepSourceControlModule::Get();
	Module.AccessSettings().SetServerUrl(InText.ToString().TrimStartAndEnd());
	Module.SaveSettings();
}

FText SLockstepSourceControlSettings::GetGitBinaryPath() const
{
	return FText::FromString(FLockstepSourceControlModule::Get().AccessSettings().GetGitBinaryPath());
}

void SLockstepSourceControlSettings::OnGitBinaryPathCommitted(const FText& InText, ETextCommit::Type)
{
	FLockstepSourceControlModule& Module = FLockstepSourceControlModule::Get();
	Module.AccessSettings().SetGitBinaryPath(InText.ToString().TrimStartAndEnd());
	Module.SaveSettings();
}

ECheckBoxState SLockstepSourceControlSettings::GetSoftLockState() const
{
	return FLockstepSourceControlModule::Get().AccessSettings().IsSoftLockMode()
		? ECheckBoxState::Checked : ECheckBoxState::Unchecked;
}

void SLockstepSourceControlSettings::OnSoftLockChanged(ECheckBoxState NewState)
{
	FLockstepSourceControlModule& Module = FLockstepSourceControlModule::Get();
	Module.AccessSettings().SetSoftLockMode(NewState == ECheckBoxState::Checked);
	Module.SaveSettings();
}

#undef LOCTEXT_NAMESPACE
