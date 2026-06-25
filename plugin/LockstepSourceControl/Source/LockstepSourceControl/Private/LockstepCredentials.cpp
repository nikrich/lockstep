// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepCredentials.h"

#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include <windows.h>
#include <wincred.h>
#include "Windows/HideWindowsPlatformTypes.h"
#endif

namespace LockstepCredentials
{
#if PLATFORM_WINDOWS
	static FString TargetName(const FString& Host)
	{
		// Generic credential target; namespaced so it's recognisable in
		// Control Panel → Credential Manager.
		return FString::Printf(TEXT("Lockstep:%s"), *Host);
	}

	bool Save(const FString& Host, const FString& Token)
	{
		if (Host.IsEmpty() || Token.IsEmpty())
		{
			return false;
		}
		const FString Target = TargetName(Host);

		// Credential blob is the token bytes (UTF-8).
		FTCHARToUTF8 Utf8(*Token);
		CREDENTIALW Cred;
		FMemory::Memzero(&Cred, sizeof(Cred));
		Cred.Type = CRED_TYPE_GENERIC;
		Cred.TargetName = const_cast<LPWSTR>(reinterpret_cast<const WCHAR*>(*Target));
		Cred.CredentialBlobSize = (DWORD)Utf8.Length();
		Cred.CredentialBlob = (LPBYTE)Utf8.Get();
		Cred.Persist = CRED_PERSIST_LOCAL_MACHINE;
		Cred.UserName = const_cast<LPWSTR>(TEXT("lockstep"));

		return ::CredWriteW(&Cred, 0) != 0;
	}

	bool Load(const FString& Host, FString& OutToken)
	{
		if (Host.IsEmpty())
		{
			return false;
		}
		const FString Target = TargetName(Host);
		PCREDENTIALW Cred = nullptr;
		if (::CredReadW(reinterpret_cast<LPCWSTR>(*Target), CRED_TYPE_GENERIC, 0, &Cred) == 0 || !Cred)
		{
			return false;
		}
		const int32 NumBytes = (int32)Cred->CredentialBlobSize;
		FUTF8ToTCHAR Conv(reinterpret_cast<const ANSICHAR*>(Cred->CredentialBlob), NumBytes);
		OutToken = FString(Conv.Length(), Conv.Get());
		::CredFree(Cred);
		return !OutToken.IsEmpty();
	}

	bool Delete(const FString& Host)
	{
		if (Host.IsEmpty())
		{
			return false;
		}
		const FString Target = TargetName(Host);
		return ::CredDeleteW(reinterpret_cast<LPCWSTR>(*Target), CRED_TYPE_GENERIC, 0) != 0;
	}
#else
	bool Save(const FString&, const FString&) { return false; }
	bool Load(const FString&, FString&) { return false; }
	bool Delete(const FString&) { return false; }
#endif

	bool Has(const FString& Host)
	{
		FString Unused;
		return Load(Host, Unused);
	}
}
