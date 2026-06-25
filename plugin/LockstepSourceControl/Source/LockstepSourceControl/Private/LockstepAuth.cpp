// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepAuth.h"
#include "LockstepCredentials.h"

#include "HttpServerModule.h"
#include "HttpServerRequest.h"
#include "HttpServerResponse.h"
#include "HttpResultCallback.h"
#include "HttpPath.h"
#include "HttpServerConstants.h"

#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "GenericPlatform/GenericPlatformHttp.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/Guid.h"
#include "HAL/PlatformProcess.h"
#include "HAL/PlatformTime.h"

DEFINE_LOG_CATEGORY_STATIC(LogLockstepAuth, Log, All);

namespace
{
	constexpr double LoginTimeoutSeconds = 180.0;
	// Loopback ports tried in order until one is free.
	const uint32 CandidatePorts[] = {53701, 53702, 53703, 53704, 53705, 53706, 53707, 53708};

	const TCHAR* DonePage =
		TEXT("<!doctype html><meta charset=\"utf-8\"><title>Lockstep</title>")
		TEXT("<body style=\"margin:0;background:#0f141a;color:#eef2f6;font:400 16px/1.6 system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center\">")
		TEXT("<div style=\"text-align:center\"><div style=\"font-size:22px;margin-bottom:8px\">&#10003; Signed in to Lockstep</div>")
		TEXT("<div style=\"color:#bcc6d1;font-size:14px\">You can close this tab and return to Unreal.</div></div></body>");

	const TCHAR* FailPage =
		TEXT("<!doctype html><meta charset=\"utf-8\"><title>Lockstep</title>")
		TEXT("<body style=\"font:400 16px system-ui,sans-serif\"><h2>Sign-in failed</h2><p>Please retry from the editor.</p></body>");
}

FLockstepAuth& FLockstepAuth::Get()
{
	static FLockstepAuth Instance;
	return Instance;
}

void FLockstepAuth::BeginLogin(const FString& InApiOrigin, const FString& InApiHost, FLockstepLoginComplete InOnComplete)
{
	if (bBusy)
	{
		InOnComplete.ExecuteIfBound(false, TEXT("Sign-in is already in progress."));
		return;
	}
	if (InApiOrigin.IsEmpty())
	{
		InOnComplete.ExecuteIfBound(false, TEXT("Set the Server URL before signing in."));
		return;
	}

	bBusy = true;
	bDone = false;
	ApiOrigin = InApiOrigin;
	ApiHost = InApiHost;
	OnComplete = InOnComplete;
	ExpectedState = FGuid::NewGuid().ToString(EGuidFormats::DigitsLower);

	// Bind a loopback listener on the first free candidate port.
	FHttpServerModule& HttpServer = FHttpServerModule::Get();
	Router.Reset();
	for (uint32 Port : CandidatePorts)
	{
		TSharedPtr<IHttpRouter> Candidate = HttpServer.GetHttpRouter(Port, /*bFailOnBindFailure=*/true);
		if (Candidate.IsValid())
		{
			Router = Candidate;
			BoundPort = Port;
			break;
		}
	}
	if (!Router.IsValid())
	{
		Finish(false, TEXT("Couldn't open a local sign-in port (53701-53708)."));
		return;
	}

	RouteHandle = Router->BindRoute(
		FHttpPath(TEXT("/cb")),
		EHttpServerRequestVerbs::VERB_GET,
		FHttpRequestHandler::CreateRaw(this, &FLockstepAuth::HandleCallback));
	HttpServer.StartAllListeners();

	const FString RedirectUri = FString::Printf(TEXT("http://127.0.0.1:%u/cb"), BoundPort);
	const FString Url = FString::Printf(
		TEXT("%s/auth/plugin/start?redirect_uri=%s&state=%s"),
		*ApiOrigin,
		*FGenericPlatformHttp::UrlEncode(RedirectUri),
		*FGenericPlatformHttp::UrlEncode(ExpectedState));

	UE_LOG(LogLockstepAuth, Log, TEXT("Opening browser for Lockstep sign-in: %s"), *Url);
	FPlatformProcess::LaunchURL(*Url, nullptr, nullptr);

	StartTime = FPlatformTime::Seconds();
	TickerHandle = FTSTicker::GetCoreTicker().AddTicker(
		FTickerDelegate::CreateRaw(this, &FLockstepAuth::Tick), 0.5f);
}

bool FLockstepAuth::HandleCallback(const FHttpServerRequest& Request, const FHttpResultCallback& OnCompleteHttp)
{
	const FString* Code = Request.QueryParams.Find(TEXT("code"));
	const FString* State = Request.QueryParams.Find(TEXT("state"));
	const bool bValid = Code && State && (*State == ExpectedState) && !Code->IsEmpty();

	// Respond to the browser immediately; never block a server handler.
	OnCompleteHttp(FHttpServerResponse::Create(FString(bValid ? DonePage : FailPage), TEXT("text/html")));

	if (!bValid)
	{
		// Defer teardown to the ticker (don't mutate the router mid-dispatch).
		bResultSuccess = false;
		ResultMessage = TEXT("Sign-in could not be verified (state mismatch).");
		bDone = true;
		return true;
	}

	// Exchange the one-time code for the PAT (async; completes on the game thread).
	const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
	Req->SetURL(ApiOrigin + TEXT("/auth/plugin/exchange"));
	Req->SetVerb(TEXT("POST"));
	Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Req->SetContentAsString(FString::Printf(TEXT("{\"code\":\"%s\"}"), **Code));
	Req->OnProcessRequestComplete().BindRaw(this, &FLockstepAuth::OnExchangeComplete);
	Req->ProcessRequest();
	return true;
}

void FLockstepAuth::OnExchangeComplete(FHttpRequestPtr /*Request*/, FHttpResponsePtr Response, bool bConnectedSuccessfully)
{
	FString Token;
	if (bConnectedSuccessfully && Response.IsValid() && Response->GetResponseCode() == 200)
	{
		TSharedPtr<FJsonObject> Root;
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
		if (FJsonSerializer::Deserialize(Reader, Root) && Root.IsValid())
		{
			Root->TryGetStringField(TEXT("token"), Token);
		}
	}

	if (!Token.IsEmpty() && LockstepCredentials::Save(ApiHost, Token))
	{
		bResultSuccess = true;
		ResultMessage = TEXT("Signed in to Lockstep.");
	}
	else
	{
		bResultSuccess = false;
		ResultMessage = Token.IsEmpty()
			? TEXT("Sign-in failed: token exchange was rejected.")
			: TEXT("Signed in, but couldn't store the token securely.");
	}
	bDone = true;
}

bool FLockstepAuth::Tick(float /*DeltaTime*/)
{
	if (!bBusy)
	{
		return false; // self-remove after Finish()
	}
	if (bDone)
	{
		Finish(bResultSuccess, ResultMessage);
		return false;
	}
	if (FPlatformTime::Seconds() - StartTime > LoginTimeoutSeconds)
	{
		Finish(false, TEXT("Sign-in timed out. Please try again."));
		return false;
	}
	return true;
}

void FLockstepAuth::Finish(bool bSuccess, const FString& Message)
{
	if (!bBusy)
	{
		return;
	}
	if (Router.IsValid() && RouteHandle.IsValid())
	{
		Router->UnbindRoute(RouteHandle);
	}
	RouteHandle.Reset();
	Router.Reset();
	bBusy = false;

	FLockstepLoginComplete Callback = OnComplete;
	OnComplete.Unbind();
	Callback.ExecuteIfBound(bSuccess, Message);
}

void FLockstepAuth::Cancel()
{
	if (bBusy)
	{
		Finish(false, TEXT("Sign-in cancelled."));
	}
}
