// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepSourceControlSettings.h"

#include "SourceControlHelpers.h"

namespace
{
	const TCHAR* SettingsSection = TEXT("LockstepSourceControl.LockstepSourceControlSettings");
}

FString FLockstepSourceControlSettings::GetServerUrl() const
{
	FScopeLock Lock(&CriticalSection);
	return ServerUrl;
}

void FLockstepSourceControlSettings::SetServerUrl(const FString& InServerUrl)
{
	FScopeLock Lock(&CriticalSection);
	// Normalise: drop a trailing slash so {ServerUrl}/locks is well-formed.
	ServerUrl = InServerUrl;
	while (ServerUrl.EndsWith(TEXT("/")))
	{
		ServerUrl.LeftChopInline(1);
	}
}

FString FLockstepSourceControlSettings::GetGitBinaryPath() const
{
	FScopeLock Lock(&CriticalSection);
	return GitBinaryPath;
}

void FLockstepSourceControlSettings::SetGitBinaryPath(const FString& InGitBinaryPath)
{
	FScopeLock Lock(&CriticalSection);
	GitBinaryPath = InGitBinaryPath;
}

FString FLockstepSourceControlSettings::GetRepoSlug() const
{
	FScopeLock Lock(&CriticalSection);
	// The slug is the final non-empty path segment of the server URL:
	//   https://api.lockstepcloud.com/my-repo  ->  "my-repo"
	FString Slug = ServerUrl;
	int32 SchemeEnd = INDEX_NONE;
	if (Slug.FindChar(TEXT(':'), SchemeEnd))
	{
		// Skip "://" so we don't treat the scheme separator as a path slash.
		Slug = Slug.Mid(SchemeEnd + 1).TrimStartAndEnd();
		while (Slug.StartsWith(TEXT("/")))
		{
			Slug.RightChopInline(1);
		}
	}
	int32 LastSlash = INDEX_NONE;
	if (Slug.FindLastChar(TEXT('/'), LastSlash))
	{
		Slug = Slug.Mid(LastSlash + 1);
	}
	return Slug;
}

FString FLockstepSourceControlSettings::GetApiOrigin() const
{
	FScopeLock Lock(&CriticalSection);
	// "https://api.lockstepcloud.com/the-club" -> "https://api.lockstepcloud.com"
	int32 SchemeEnd = ServerUrl.Find(TEXT("://"));
	if (SchemeEnd == INDEX_NONE)
	{
		return FString();
	}
	int32 PathStart = ServerUrl.Find(TEXT("/"), ESearchCase::IgnoreCase, ESearchDir::FromStart, SchemeEnd + 3);
	return PathStart == INDEX_NONE ? ServerUrl : ServerUrl.Left(PathStart);
}

FString FLockstepSourceControlSettings::GetApiHost() const
{
	const FString Origin = GetApiOrigin();
	int32 SchemeEnd = Origin.Find(TEXT("://"));
	return SchemeEnd == INDEX_NONE ? Origin : Origin.Mid(SchemeEnd + 3);
}

FString FLockstepSourceControlSettings::GetWorkingCopyRoot() const
{
	FScopeLock Lock(&CriticalSection);
	return WorkingCopyRoot;
}

void FLockstepSourceControlSettings::SetWorkingCopyRoot(const FString& InRoot)
{
	FScopeLock Lock(&CriticalSection);
	WorkingCopyRoot = InRoot;
}

bool FLockstepSourceControlSettings::IsSoftLockMode() const
{
	FScopeLock Lock(&CriticalSection);
	return bSoftLockMode;
}

void FLockstepSourceControlSettings::SetSoftLockMode(bool bInSoft)
{
	FScopeLock Lock(&CriticalSection);
	bSoftLockMode = bInSoft;
}

void FLockstepSourceControlSettings::LoadSettings()
{
	FScopeLock Lock(&CriticalSection);
	const FString& Ini = SourceControlHelpers::GetSettingsIni();
	GConfig->GetString(SettingsSection, TEXT("ServerUrl"), ServerUrl, Ini);
	GConfig->GetString(SettingsSection, TEXT("GitBinaryPath"), GitBinaryPath, Ini);
	GConfig->GetString(SettingsSection, TEXT("WorkingCopyRoot"), WorkingCopyRoot, Ini);
	GConfig->GetBool(SettingsSection, TEXT("SoftLockMode"), bSoftLockMode, Ini);
}

void FLockstepSourceControlSettings::SaveSettings() const
{
	FScopeLock Lock(&CriticalSection);
	const FString& Ini = SourceControlHelpers::GetSettingsIni();
	GConfig->SetString(SettingsSection, TEXT("ServerUrl"), *ServerUrl, Ini);
	GConfig->SetString(SettingsSection, TEXT("GitBinaryPath"), *GitBinaryPath, Ini);
	GConfig->SetString(SettingsSection, TEXT("WorkingCopyRoot"), *WorkingCopyRoot, Ini);
	GConfig->SetBool(SettingsSection, TEXT("SoftLockMode"), bSoftLockMode, Ini);
}
