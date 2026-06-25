// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// The settings panel shown in the editor's Revision Control login window when
// "Lockstep" is the selected provider. Includes browser-based sign-in.
#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"

class SLockstepSourceControlSettings : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SLockstepSourceControlSettings) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	FText GetServerUrl() const;
	void OnServerUrlCommitted(const FText& InText, ETextCommit::Type InCommitType);

	FText GetGitBinaryPath() const;
	void OnGitBinaryPathCommitted(const FText& InText, ETextCommit::Type InCommitType);

	ECheckBoxState GetSoftLockState() const;
	void OnSoftLockChanged(ECheckBoxState NewState);

	// --- Sign-in ---
	FText GetAuthStatusText() const { return AuthStatus; }
	bool IsSignInEnabled() const;
	bool IsSignedIn() const;
	FReply OnSignInClicked();
	FReply OnSignOutClicked();
	void OnLoginComplete(bool bSuccess, FString Message);
	void RefreshAuthStatus();

	FText AuthStatus;
};
