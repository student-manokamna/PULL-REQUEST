import { inngest } from "../client";
import { getPullRequestDiff, postReviewComment } from "@/module/github/lib/github";
import { retrieveContext } from "@/module/ai/lib/rag";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import prisma from "@/lib/db";

async function safeGenerateText(prompt: string): Promise<string> {
  try {
    const { text } = await generateText({
      // ✅ FIX: Changed to a valid model name
      model: google("gemini-1.5-flash"), 
      prompt,
    });
    return text;
  } catch (err: any) {
    const msg = err?.message || "";
    if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
      console.error("🚫 Gemini quota exceeded");
      return "⚠️ AI review unavailable due to quota limits.";
    }
    throw err;
  }
}

export const generateReview = inngest.createFunction(
  { id: "generate-review", concurrency: 5 },
  { event: "pr.review.requested" },

  async ({ event, step }) => {
    const { owner, repo, prNumber, userId } = event.data;

    const { diff, title, description, token } = await step.run(
      "fetch-pr-data",
      async () => {
        const account = await prisma.account.findFirst({
          where: { userId: userId, providerId: "github" },
        });

        if (!account?.accessToken) {
          throw new Error("No GitHub access token found");
        }

        const data = await getPullRequestDiff(account.accessToken, owner, repo, prNumber);
        return { ...data, token: account.accessToken };
      }
    );

    const context = await step.run("retrieve-context", async () => {
      const query = `${title}\n${description}`;
      // ✅ FIX: repoId must match exactly what you used in rag.ts.
      // Based on your logs and rag.ts, 'repo' is the correct key.
      try {
        return await retrieveContext(query, repo); 
      } catch (error) {
        console.error("Context retrieval failed:", error);
        return []; // Return empty array so the review can still proceed
      }
    });

    const review = await step.run("generate-ai-review", async () => {
      const prompt = `You are an expert code reviewer. Analyze the following pull request.

PR Title: ${title}
PR Description: ${description || "No description provided"}

Context from Codebase:
${context.length > 0 ? context.join("\n\n") : "No specific context found."}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Please provide a detailed walkthrough, summary, strengths, issues, suggestions, and a creative poem summarizing the changes.
Format your response in markdown.`;

      return await safeGenerateText(prompt);
    });

    await step.run("post-comment", async () => {
      // ✅ FIX: This now correctly uses the token to post to GitHub
      await postReviewComment(token, owner, repo, prNumber, review);
    });

    await step.run("save-review", async () => {
      const repository = await prisma.repository.findFirst({
        where: { owner, name: repo },
      });

      if (repository) {
        await prisma.review.create({
          data: {
            repositoryId: repository.id,
            prNumber,
            prTitle: title,
            prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
            review,
            status: "completed",
          },
        });
      }
    });

    return { success: true };
  }
);