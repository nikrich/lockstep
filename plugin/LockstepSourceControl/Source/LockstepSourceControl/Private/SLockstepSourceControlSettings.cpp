// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "SLockstepSourceControlSettings.h"
#include "LockstepSourceControlModule.h"
#include "LockstepAuth.h"
#include "LockstepCredentials.h"

#include "Widgets/SBoxPanel.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SButton.h"
#include "Internationalization/Internationalization.h"

#define LOCTEXT_NAMESPACE "LockstepSourceControlSettings"

void SLockstepSourceControlSettings::Construct(const FArguments& InArgs)
{
	const float Pad = 4.0f;
	RefreshAuthStatus();

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

		// --- Account ---
		+ SVerticalBox::Slot().AutoHeight().Padding(Pad, 12, Pad, 2)
		[
			SNew(STextBlock)
			.Text(this, &SLockstepSourceControlSettings::GetAuthStatusText)
		]
		+ SVerticalBox::Slot().AutoHeight().Padding(Pad, 2)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)
			[
				SNew(SButton)
				.IsEnabled(this, &SLockstepSourceControlSettings::IsSignInEnabled)
				.OnClicked(this, &SLockstepSourceControlSettings::OnSignInClicked)
				[
					SNew(STextBlock).Text(LOCTEXT("SignIn", "Sign in to Lockstep"))
				]
			]
			+ SHorizontalBox::Slot().AutoWidth()
			[
				SNew(SButton)
				.IsEnabled(this, &SLockstepSourceControlSettings::IsSignedIn)
				.OnClicked(this, &SLockstepSourceControlSettings::OnSignOutClicked)
				[
					SNew(STextBlock).Text(LOCTEXT("SignOut", "Sign out"))
				]
			]
		]
		+ SVerticalBox::Slot().AutoHeight().Padding(Pad, 2)
		[
			SNew(STextBlock)
			.AutoWrapText(true)
			.Text(LOCTEXT("AuthHint", "Sign in opens your browser to authorize this machine. The access token is stored securely in the OS credential manager — never in project settings. (CI can still set the LOCKSTEP_TOKEN env var to override.)"))
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
	RefreshAuthStatus(); // host may have changed
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

bool SLockstepSourceControlSettings::IsSignedIn() const
{
	const FString Host = FLockstepSourceControlModule::Get().AccessSettings().GetApiHost();
	return !Host.IsEmpty() && LockstepCredentials::Has(Host);
}

bool SLockstepSourceControlSettings::IsSignInEnabled() const
{
	return !FLockstepAuth::Get().IsBusy()
		&& !FLockstepSourceControlModule::Get().AccessSettings().GetApiOrigin().IsEmpty();
}

void SLockstepSourceControlSettings::RefreshAuthStatus()
{
	if (FLockstepAuth::Get().IsBusy())
	{
		AuthStatus = LOCTEXT("AuthBusy", "Waiting for browser sign-in…");
	}
	else if (IsSignedIn())
	{
		const FString Host = FLockstepSourceControlModule::Get().AccessSettings().GetApiHost();
		AuthStatus = FText::Format(LOCTEXT("AuthYes", "Signed in to {0}"), FText::FromString(Host));
	}
	else
	{
		AuthStatus = LOCTEXT("AuthNo", "Not signed in.");
	}
}

FReply SLockstepSourceControlSettings::OnSignInClicked()
{
	FLockstepSourceControlModule& Module = FLockstepSourceControlModule::Get();
	const FString Origin = Module.AccessSettings().GetApiOrigin();
	const FString Host = Module.AccessSettings().GetApiHost();
	AuthStatus = LOCTEXT("AuthBusy", "Waiting for browser sign-in…");
	FLockstepAuth::Get().BeginLogin(
		Origin, Host,
		FLockstepLoginComplete::CreateSP(this, &SLockstepSourceControlSettings::OnLoginComplete));
	return FReply::Handled();
}

FReply SLockstepSourceControlSettings::OnSignOutClicked()
{
	const FString Host = FLockstepSourceControlModule::Get().AccessSettings().GetApiHost();
	if (!Host.IsEmpty())
	{
		LockstepCredentials::Delete(Host);
	}
	RefreshAuthStatus();
	return FReply::Handled();
}

void SLockstepSourceControlSettings::OnLoginComplete(bool bSuccess, FString Message)
{
	if (bSuccess)
	{
		RefreshAuthStatus(); // canonical "Signed in to <host>"
	}
	else
	{
		AuthStatus = FText::Format(LOCTEXT("AuthFail", "Sign-in failed: {0}"), FText::FromString(Message));
	}
}

#undef LOCTEXT_NAMESPACE
