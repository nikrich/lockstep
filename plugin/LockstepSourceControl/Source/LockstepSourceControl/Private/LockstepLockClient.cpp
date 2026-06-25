// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepLockClient.h"

#include "HttpModule.h"
#include "HttpManager.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Templates/Atomic.h"
#include "HAL/PlatformTime.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "HAL/Event.h"
#include "HAL/PlatformProcess.h"
#include "Misc/DateTime.h"

DEFINE_LOG_CATEGORY_STATIC(LogLockstepLocks, Log, All);

namespace
{
	// Generous overall ceiling; the HTTP layer's own timeout will normally fire
	// first and complete the request with bConnectedSuccessfully == false.
	constexpr float HttpTimeoutSeconds = 30.0f;

	FLockstepLock ParseLock(const TSharedPtr<FJsonObject>& Obj)
	{
		FLockstepLock Lock;
		if (!Obj.IsValid())
		{
			return Lock;
		}
		Obj->TryGetStringField(TEXT("id"), Lock.Id);
		Obj->TryGetStringField(TEXT("path"), Lock.Path);

		const TSharedPtr<FJsonObject>* Owner = nullptr;
		if (Obj->TryGetObjectField(TEXT("owner"), Owner) && Owner && (*Owner).IsValid())
		{
			(*Owner)->TryGetStringField(TEXT("name"), Lock.OwnerName);
		}

		FString LockedAtIso;
		if (Obj->TryGetStringField(TEXT("locked_at"), LockedAtIso) && !LockedAtIso.IsEmpty())
		{
			FDateTime::ParseIso8601(*LockedAtIso, Lock.LockedAt);
		}
		return Lock;
	}

	void ParseLockArray(const TSharedPtr<FJsonObject>& Root, const TCHAR* Field, bool bOurs, TArray<FLockstepLock>& Out)
	{
		const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
		if (!Root->TryGetArrayField(Field, Arr) || !Arr)
		{
			return;
		}
		for (const TSharedPtr<FJsonValue>& V : *Arr)
		{
			const TSharedPtr<FJsonObject>& O = V->AsObject();
			if (O.IsValid())
			{
				FLockstepLock Lock = ParseLock(O);
				Lock.bIsOurs = bOurs;
				if (Lock.IsValid())
				{
					Out.Add(MoveTemp(Lock));
				}
			}
		}
	}
}

FLockstepLockClient::FLockstepLockClient(const FString& InServerUrl, const FString& InToken)
	: ServerUrl(InServerUrl)
	, Token(InToken)
{
	while (ServerUrl.EndsWith(TEXT("/")))
	{
		ServerUrl.LeftChopInline(1);
	}
}

bool FLockstepLockClient::SendBlocking(
	const FString& Verb,
	const FString& Url,
	const FString& JsonBody,
	int32& OutStatusCode,
	FString& OutResponseBody,
	FString& OutError) const
{
	if (!IsConfigured())
	{
		OutError = TEXT("Lockstep is not configured (missing server URL or access token).");
		return false;
	}

	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Url);
	Request->SetVerb(Verb);
	Request->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *Token));
	Request->SetHeader(TEXT("Accept"), TEXT("application/vnd.git-lfs+json"));
	if (!JsonBody.IsEmpty())
	{
		Request->SetHeader(TEXT("Content-Type"), TEXT("application/vnd.git-lfs+json"));
		Request->SetContentAsString(JsonBody);
	}
	Request->SetTimeout(HttpTimeoutSeconds); // IHttpRequest::SetTimeout exists across all UE5

	TAtomic<bool> bCompleted(false);
	FEvent* Done = FPlatformProcess::GetSynchEventFromPool(/*bIsManualReset=*/true);
	bool bTransportOk = false;
	int32 LocalStatus = 0;
	FString LocalBody;

	Request->OnProcessRequestComplete().BindLambda(
		[&bTransportOk, &LocalStatus, &LocalBody, &bCompleted, Done](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnectedSuccessfully)
		{
			if (bConnectedSuccessfully && Response.IsValid())
			{
				bTransportOk = true;
				LocalStatus = Response->GetResponseCode();
				LocalBody = Response->GetContentAsString();
			}
			bCompleted = true;
			Done->Trigger();
		});

	if (!Request->ProcessRequest())
	{
		FPlatformProcess::ReturnSynchEventToPool(Done);
		OutError = TEXT("Failed to dispatch HTTP request.");
		return false;
	}

	// Completion fires from FHttpManager::Tick on the game thread. On a worker
	// thread we can simply wait; on the game thread we must drive the manager
	// ourselves or the request would never complete (deadlock).
	if (IsInGameThread())
	{
		FHttpManager& HttpManager = FHttpModule::Get().GetHttpManager();
		const double Start = FPlatformTime::Seconds();
		while (!bCompleted.Load() && (FPlatformTime::Seconds() - Start) < HttpTimeoutSeconds)
		{
			HttpManager.Tick(0.0f);
			FPlatformProcess::Sleep(0.005f);
		}
		if (!bCompleted.Load())
		{
			Request->CancelRequest();
		}
	}
	else
	{
		Done->Wait();
	}
	FPlatformProcess::ReturnSynchEventToPool(Done);

	if (!bTransportOk)
	{
		OutError = FString::Printf(TEXT("Network error talking to %s"), *Url);
		return false;
	}

	OutStatusCode = LocalStatus;
	OutResponseBody = LocalBody;
	return true;
}

// Extracts the server's { "message": "..." } error text, falling back to a
// generic status line.
static FString ServerMessageOr(const FString& Body, int32 Status, const TCHAR* Fallback)
{
	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Body);
	if (FJsonSerializer::Deserialize(Reader, Root) && Root.IsValid())
	{
		FString Message;
		if (Root->TryGetStringField(TEXT("message"), Message) && !Message.IsEmpty())
		{
			return Message;
		}
	}
	return FString::Printf(TEXT("%s (HTTP %d)"), Fallback, Status);
}

bool FLockstepLockClient::ListLocks(TArray<FLockstepLock>& OutLocks, FString& OutError) const
{
	OutLocks.Reset();
	int32 Status = 0;
	FString Body;
	if (!SendBlocking(TEXT("GET"), LocksUrl(), FString(), Status, Body, OutError))
	{
		return false;
	}
	if (Status != 200)
	{
		OutError = ServerMessageOr(Body, Status, TEXT("Failed to list locks"));
		return false;
	}

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Body);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		OutError = TEXT("Malformed locks response.");
		return false;
	}
	ParseLockArray(Root, TEXT("locks"), /*bOurs=*/false, OutLocks);
	return true;
}

bool FLockstepLockClient::VerifyLocks(TArray<FLockstepLock>& OutLocks, FString& OutError) const
{
	OutLocks.Reset();
	int32 Status = 0;
	FString Body;
	if (!SendBlocking(TEXT("POST"), LocksUrl() + TEXT("/verify"), TEXT("{}"), Status, Body, OutError))
	{
		return false;
	}
	if (Status != 200)
	{
		OutError = ServerMessageOr(Body, Status, TEXT("Failed to verify locks"));
		return false;
	}

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Body);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		OutError = TEXT("Malformed verify response.");
		return false;
	}
	ParseLockArray(Root, TEXT("ours"), /*bOurs=*/true, OutLocks);
	ParseLockArray(Root, TEXT("theirs"), /*bOurs=*/false, OutLocks);
	return true;
}

bool FLockstepLockClient::AcquireLock(const FString& Path, FLockstepLock& OutLock, FLockstepLock& OutExisting, FString& OutError) const
{
	// Body: { "path": "<repo-relative posix path>" }
	FString JsonBody;
	{
		const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonBody);
		Writer->WriteObjectStart();
		Writer->WriteValue(TEXT("path"), Path);
		Writer->WriteObjectEnd();
		Writer->Close();
	}

	int32 Status = 0;
	FString Body;
	if (!SendBlocking(TEXT("POST"), LocksUrl(), JsonBody, Status, Body, OutError))
	{
		return false;
	}

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Body);
	FJsonSerializer::Deserialize(Reader, Root);

	if (Status == 201 && Root.IsValid())
	{
		const TSharedPtr<FJsonObject>* LockObj = nullptr;
		if (Root->TryGetObjectField(TEXT("lock"), LockObj) && LockObj)
		{
			OutLock = ParseLock(*LockObj);
			OutLock.bIsOurs = true;
		}
		return true;
	}

	if (Status == 409 && Root.IsValid())
	{
		const TSharedPtr<FJsonObject>* LockObj = nullptr;
		if (Root->TryGetObjectField(TEXT("lock"), LockObj) && LockObj)
		{
			OutExisting = ParseLock(*LockObj);
		}
		OutError = OutExisting.IsValid()
			? FString::Printf(TEXT("Already locked by %s"), *OutExisting.OwnerName)
			: TEXT("Already locked by another user");
		return false;
	}

	OutError = ServerMessageOr(Body, Status, TEXT("Failed to acquire lock"));
	return false;
}

bool FLockstepLockClient::ReleaseLock(const FString& LockId, bool bForce, FString& OutError) const
{
	FString JsonBody;
	{
		const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonBody);
		Writer->WriteObjectStart();
		Writer->WriteValue(TEXT("force"), bForce);
		Writer->WriteObjectEnd();
		Writer->Close();
	}

	int32 Status = 0;
	FString Body;
	const FString Url = FString::Printf(TEXT("%s/%s/unlock"), *LocksUrl(), *LockId);
	if (!SendBlocking(TEXT("POST"), Url, JsonBody, Status, Body, OutError))
	{
		return false;
	}
	if (Status == 200)
	{
		return true;
	}
	OutError = ServerMessageOr(Body, Status, TEXT("Failed to release lock"));
	return false;
}
