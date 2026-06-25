// Copyright Lockstep. Licensed under the Business Source License 1.1 (see repo LICENSE).

#include "LockstepGit.h"
#include "LockstepSourceControlState.h"
#include "HAL/PlatformProcess.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"

DEFINE_LOG_CATEGORY_STATIC(LogLockstepGit, Log, All);

namespace LockstepGit
{
	bool RunCommand(
		const FString& GitBinary,
		const FString& RepoRoot,
		const FString& Command,
		const TArray<FString>& Parameters,
		const TArray<FString>& Files,
		FString& OutStdOut,
		FString& OutStdErr)
	{
		if (GitBinary.IsEmpty())
		{
			OutStdErr = TEXT("git binary path is not set");
			return false;
		}

		FString FullCommand = Command;
		for (const FString& Param : Parameters)
		{
			FullCommand += TEXT(" ");
			FullCommand += Param;
		}
		if (Files.Num() > 0)
		{
			FullCommand += TEXT(" --");
			for (const FString& File : Files)
			{
				FullCommand += FString::Printf(TEXT(" \"%s\""), *File);
			}
		}

		int32 ReturnCode = -1;
		OutStdOut.Reset();
		OutStdErr.Reset();
		const bool bLaunched = FPlatformProcess::ExecProcess(
			*GitBinary, *FullCommand, &ReturnCode, &OutStdOut, &OutStdErr,
			RepoRoot.IsEmpty() ? nullptr : *RepoRoot);

		if (!bLaunched)
		{
			OutStdErr = FString::Printf(TEXT("failed to launch git (%s)"), *GitBinary);
			return false;
		}
		return ReturnCode == 0;
	}

	FString FindGitBinaryPath()
	{
#if PLATFORM_WINDOWS
		const TCHAR* Candidates[] = {
			TEXT("C:/Program Files/Git/bin/git.exe"),
			TEXT("C:/Program Files (x86)/Git/bin/git.exe"),
			TEXT("C:/Program Files/Git/cmd/git.exe"),
		};
#elif PLATFORM_MAC
		const TCHAR* Candidates[] = {
			TEXT("/usr/local/bin/git"),
			TEXT("/opt/homebrew/bin/git"),
			TEXT("/usr/bin/git"),
		};
#else
		const TCHAR* Candidates[] = {
			TEXT("/usr/bin/git"),
			TEXT("/usr/local/bin/git"),
		};
#endif
		for (const TCHAR* Candidate : Candidates)
		{
			if (FPaths::FileExists(Candidate))
			{
				return Candidate;
			}
		}
		// Fall back to PATH resolution by the OS.
		return TEXT("git");
	}

	bool CheckGitAvailability(const FString& GitBinary, FString& OutVersion)
	{
		FString StdOut, StdErr;
		if (RunCommand(GitBinary, FString(), TEXT("version"), {}, {}, StdOut, StdErr))
		{
			OutVersion = StdOut.TrimStartAndEnd();
			return true;
		}
		return false;
	}

	bool FindRepositoryRoot(const FString& InStartDir, FString& OutRepositoryRoot)
	{
		FString Dir = FPaths::ConvertRelativePathToFull(InStartDir);
		FPaths::NormalizeDirectoryName(Dir);

		while (!Dir.IsEmpty())
		{
			const FString DotGit = Dir / TEXT(".git");
			if (IFileManager::Get().DirectoryExists(*DotGit) || FPaths::FileExists(DotGit))
			{
				OutRepositoryRoot = Dir;
				return true;
			}
			FString Parent = FPaths::GetPath(Dir);
			if (Parent == Dir || Parent.IsEmpty())
			{
				break;
			}
			Dir = Parent;
		}
		return false;
	}

	bool GetUserEmail(const FString& GitBinary, const FString& RepoRoot, FString& OutEmail)
	{
		FString StdOut, StdErr;
		if (RunCommand(GitBinary, RepoRoot, TEXT("config"), {TEXT("user.email")}, {}, StdOut, StdErr))
		{
			OutEmail = StdOut.TrimStartAndEnd();
			return !OutEmail.IsEmpty();
		}
		return false;
	}

	FString AbsoluteToRepoRelative(const FString& RepoRoot, const FString& AbsoluteFile)
	{
		FString Relative = AbsoluteFile;
		FPaths::MakePathRelativeTo(Relative, *(RepoRoot / TEXT("")));
		Relative.ReplaceInline(TEXT("\\"), TEXT("/"));
		return Relative;
	}

	FString RepoRelativeToAbsolute(const FString& RepoRoot, const FString& RelativePath)
	{
		return FPaths::ConvertRelativePathToFull(RepoRoot / RelativePath);
	}

	static ELockstepWorkingState ParsePorcelainCode(TCHAR IndexStatus, TCHAR WorkStatus)
	{
		// `git status --porcelain` XY codes. Untracked is "??".
		if (IndexStatus == TEXT('?') || WorkStatus == TEXT('?'))
		{
			return ELockstepWorkingState::Untracked;
		}
		if (IndexStatus == TEXT('!') || WorkStatus == TEXT('!'))
		{
			return ELockstepWorkingState::Ignored;
		}
		if (IndexStatus == TEXT('A'))
		{
			return ELockstepWorkingState::Added;
		}
		if (IndexStatus == TEXT('D') || WorkStatus == TEXT('D'))
		{
			return ELockstepWorkingState::Deleted;
		}
		if (IndexStatus == TEXT('M') || WorkStatus == TEXT('M') ||
			IndexStatus == TEXT('R') || IndexStatus == TEXT('C'))
		{
			return ELockstepWorkingState::Modified;
		}
		return ELockstepWorkingState::Unmodified;
	}

	bool RunStatus(
		const FString& GitBinary,
		const FString& RepoRoot,
		const TArray<FString>& InAbsoluteFiles,
		TMap<FString, ELockstepWorkingState>& OutStates,
		TArray<FString>& OutErrors)
	{
		// Default every requested file to clean-tracked; porcelain output below
		// overrides those that actually changed.
		for (const FString& Abs : InAbsoluteFiles)
		{
			OutStates.Add(Abs, ELockstepWorkingState::Unmodified);
		}

		FString StdOut, StdErr;
		const bool bOk = RunCommand(
			GitBinary, RepoRoot, TEXT("status"),
			{TEXT("--porcelain"), TEXT("--untracked-files=all")},
			InAbsoluteFiles, StdOut, StdErr);
		if (!bOk)
		{
			if (!StdErr.IsEmpty())
			{
				OutErrors.Add(StdErr.TrimStartAndEnd());
			}
			return false;
		}

		TArray<FString> Lines;
		StdOut.ParseIntoArrayLines(Lines, /*bCullEmpty=*/true);
		for (const FString& Line : Lines)
		{
			if (Line.Len() < 4)
			{
				continue;
			}
			const TCHAR IndexStatus = Line[0];
			const TCHAR WorkStatus = Line[1];
			// Path begins at index 3 (after "XY "); handle rename "old -> new".
			FString RelPath = Line.Mid(3).TrimStartAndEnd();
			int32 ArrowIdx = INDEX_NONE;
			if (RelPath.FindLastChar(TEXT('>'), ArrowIdx) && RelPath.Contains(TEXT("->")))
			{
				RelPath = RelPath.Mid(ArrowIdx + 1).TrimStartAndEnd();
			}
			RelPath = RelPath.TrimQuotes();
			const FString Abs = RepoRelativeToAbsolute(RepoRoot, RelPath);
			OutStates.Add(Abs, ParsePorcelainCode(IndexStatus, WorkStatus));
		}
		return true;
	}

	bool IsFileLockable(const FString& GitBinary, const FString& RepoRoot, const FString& AbsoluteFile)
	{
		// `git check-attr lockable -- <file>` => "<file>: lockable: set"
		FString StdOut, StdErr;
		const FString Rel = AbsoluteToRepoRelative(RepoRoot, AbsoluteFile);
		if (RunCommand(GitBinary, RepoRoot, TEXT("check-attr"), {TEXT("lockable")}, {Rel}, StdOut, StdErr))
		{
			return StdOut.Contains(TEXT("lockable: set"));
		}
		return false;
	}

	FString ResolveAccessToken(const FString& GitBinary, const FString& RepoRoot, const FString& ServerUrl)
	{
		// 1) Explicit env var wins (CI / power users).
		FString FromEnv = FPlatformMisc::GetEnvironmentVariable(TEXT("LOCKSTEP_TOKEN"));
		if (!FromEnv.IsEmpty())
		{
			return FromEnv.TrimStartAndEnd();
		}

		// 2) TODO: query the git credential helper (`git credential fill`) for the
		//    server host, the same store git-lfs already populated. That needs a
		//    piped-stdin child process; tracked as a follow-up. For now, settings
		//    panel / env var supply the token.
		return FString();
	}
}
