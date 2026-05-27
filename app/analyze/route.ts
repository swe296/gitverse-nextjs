import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import prisma from "@/lib/prisma";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { validateRepoUrl } from "@/utils/repoUrlValidator";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const repositoryIdRaw = body?.repositoryId;
    const url = body?.url;
    const name = body?.name;
    const description = body?.description;

    let repositoryId: number;

    if (repositoryIdRaw != null) {
      repositoryId = Number(repositoryIdRaw);
      if (!Number.isFinite(repositoryId)) {
        return NextResponse.json(
          { error: "Invalid repositoryId" },
          { status: 400 }
        );
      }

      const repo = await prisma.repository.findFirst({
        where: { id: repositoryId, userId: user.userId },
        select: { id: true },
      });

      if (!repo) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }
    } else {
      if (!url || !name) {
        return NextResponse.json(
          { error: "Provide either repositoryId or (name + url)" },
          { status: 400 }
        );
      }

      // Validate URL format using the enhanced validator
      const validation = validateRepoUrl(url);
      if (!validation.isValid) {
        return NextResponse.json(
          { 
            error: validation.error || "Invalid repository URL",
            suggestion: validation.suggestion
          },
          { status: 400 }
        );
      }

      // Use the normalized URL
      const normalizedUrl = validation.parsed!.normalizedUrl;

      const repo = await repositoryService.createRepository({
        name,
        url: normalizedUrl,
        description,
        userId: user.userId,
      });

      repositoryId = repo.id;
    }

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId,
      userId: user.userId,
    });

    return NextResponse.json(
      { jobId: job.id, status: job.status, repositoryId },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("POST /analyze error:", error);
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }
}
