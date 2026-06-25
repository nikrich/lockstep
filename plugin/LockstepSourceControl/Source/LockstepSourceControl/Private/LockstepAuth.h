// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).
//
// Browser-based sign-in for the editor (the loopback OAuth flow): open the
// system browser to /auth/plugin/start, listen on 127.0.0.1 for the redirect,
// exchange the one-time code for a PAT, and store it in the OS credential store.
// No env vars, no copy-pasting tokens.
#pragma once

#include "CoreMinimal.h"
#include "Containers/Ticker.h"
#include "IHttpRouter.h"
#include "Interfaces/IHttpRequest.h"

struct FHttpServerRequest;

DECLARE_DELEGATE_TwoParams(FLockstepLoginComplete, bool /*bSuccess*/, FString /*Message*/);

class FLockstepAuth
{
public:
	static FLockstepAuth& Get();

	bool IsBusy() const { return bBusy; }

	/** Start the browser sign-in. ApiOrigin = scheme+host (no path); ApiHost =
	 *  host used as the credential-store key. */
	void BeginLogin(const FString& InApiOrigin, const FString& InApiHost, FLockstepLoginComplete InOnComplete);

	void Cancel();

private:
	bool HandleCallback(const FHttpServerRequest& Request, const FHttpResultCallback& OnComplete);
	void OnExchangeComplete(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully);
	bool Tick(float DeltaTime);
	void Finish(bool bSuccess, const FString& Message);

	bool bBusy = false;
	bool bDone = false;
	bool bResultSuccess = false;
	FString ResultMessage;

	FString ApiOrigin;
	FString ApiHost;
	FString ExpectedState;
	uint32 BoundPort = 0;

	TSharedPtr<IHttpRouter> Router;
	FHttpRouteHandle RouteHandle;
	FLockstepLoginComplete OnComplete;
	FTSTicker::FDelegateHandle TickerHandle;
	double StartTime = 0.0;
};
